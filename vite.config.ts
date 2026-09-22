import { defineConfig, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { CONFIG_FILE, handleConfigRequest } from './server/vms-config-server.mjs'

type NextFn = (err?: unknown) => void

const sendText = (res: ServerResponse, status: number, message: string) => {
  if (!res.headersSent && !res.writableEnded) {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(message)
  }
}

// --- API de configuración (escribe public/config/channels.json) ---
const vmsConfigApi = (): Plugin => {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: NextFn) => {
    handleConfigRequest(req, res)
      .then((handled) => {
        if (!handled) next()
      })
      .catch((err: unknown) => next(err))
  }

  return {
    name: 'vms-config-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// --- Reverse proxy de signalling Janus ---
// El navegador llama al mismo origen (/janus-api/<canal>/janus) y reenviamos al Janus
// de cada Raspberry. Evita el bloqueo CORS del Janus remoto. El destino se lee del JSON
// en cada request, así los cambios de IP aplican sin reiniciar Vite.
const JANUS_PROXY_PREFIX = '/janus-api'

const readChannelTarget = (channelId: number): string | null => {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as { channels?: Array<{ id: number; host: string; port: number }> }
    const ch = parsed.channels?.find((c) => c.id === channelId)
    if (!ch?.host) return null
    return `http://${ch.host}:${ch.port}`
  } catch {
    return null
  }
}

const handleJanusProxy = (req: IncomingMessage, res: ServerResponse): boolean => {
  const rawUrl = req.url ?? ''
  const match = rawUrl.match(new RegExp(`^${JANUS_PROXY_PREFIX}/(\\d+)(/.*)?$`))
  if (!match) return false

  const rest = match[2] ?? '/'
  const target = readChannelTarget(Number(match[1]))
  if (!target) {
    sendText(res, 502, `Canal ${match[1]} sin IP configurada en channels.json`)
    return true
  }

  let targetUrl: URL
  try {
    targetUrl = new URL(rest, target)
  } catch {
    sendText(res, 502, `Destino inválido: ${target}`)
    return true
  }

  const isHttps = targetUrl.protocol === 'https:'
  const headers: http.OutgoingHttpHeaders = { ...req.headers }
  headers.host = targetUrl.host
  // Quitar cabeceras de origen: la petición al Janus remoto debe verse como del proxy.
  delete headers.origin
  delete headers.referer
  delete headers['accept-encoding']

  const proxyReq = (isHttps ? https : http).request(
    {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      method: req.method,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
      proxyRes.pipe(res)
    },
  )

  proxyReq.on('error', (err) => {
    sendText(res, 502, `No se pudo conectar a ${targetUrl.origin}: ${err.message}`)
  })

  req.pipe(proxyReq)
  return true
}

const janusProxyPlugin = (): Plugin => ({
  name: 'vms-janus-proxy',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (handleJanusProxy(req, res)) return
      next()
    })
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      if (handleJanusProxy(req, res)) return
      next()
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), vmsConfigApi(), janusProxyPlugin()],
  server: {
    watch: {
      // No recargar la página cuando la app guarda la config.
      ignored: [CONFIG_FILE, `**${CONFIG_FILE}`],
    },
  },
})
