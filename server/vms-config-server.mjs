// Mini-API sin dependencias para persistir la config del VMS en un JSON del proyecto.
// Fuente canónica: public/config/channels.json
//
// Se usa de dos formas:
//   1. Integrada en Vite (recomendado): vite.config.ts la monta como middleware.
//      -> `npm run dev` / `npm run preview` ya escriben en el JSON, sin proceso extra.
//   2. Servidor standalone (opcional):
//      node server/vms-config-server.mjs [--port 3001]
//
// Endpoints:
//   GET  /api/health    -> { ok: true, file }
//   GET  /api/channels  -> contenido de channels.json
//   PUT  /api/channels  -> valida y sobrescribe channels.json. Body: { channels: [...] }

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export const CONFIG_FILE = path.join(ROOT, "public", "config", "channels.json");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const sendJson = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body), ...CORS_HEADERS });
  res.end(body);
};

export const isValidChannel = (c) =>
  typeof c === "object" &&
  c !== null &&
  [1, 2, 3, 4].includes(c.id) &&
  typeof c.name === "string" &&
  c.name.trim().length > 0 &&
  typeof c.host === "string" &&
  c.host.trim().length > 0 &&
  Number.isInteger(c.port) &&
  c.port >= 1 &&
  c.port <= 65535 &&
  typeof c.path === "string" &&
  Number.isInteger(c.streamId) &&
  c.streamId > 0 &&
  typeof c.enabled === "boolean" &&
  (c.transport === undefined || c.transport === "ws" || c.transport === "http");

const normalizeChannel = (c) => ({
  id: c.id,
  name: c.name.trim(),
  host: c.host.trim(),
  port: c.port,
  path: c.path.startsWith("/") ? c.path : `/${c.path}`,
  streamId: c.streamId,
  transport: c.transport === "http" ? "http" : "ws",
  enabled: c.enabled,
});

const readBody = (req, limitBytes = 64 * 1024) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("Body demasiado grande"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });

/**
 * Maneja una request de la API de config.
 * @returns {Promise<boolean>} true si la request fue manejada (para encadenar middleware).
 */
export async function handleConfigRequest(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname !== "/api/health" && url.pathname !== "/api/channels") {
    return false;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, file: CONFIG_FILE });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/channels") {
    try {
      const raw = await fs.readFile(CONFIG_FILE, "utf-8");
      sendJson(res, 200, JSON.parse(raw));
    } catch (err) {
      if (err?.code === "ENOENT") {
        sendJson(res, 404, { error: `No existe ${CONFIG_FILE}` });
      } else {
        sendJson(res, 500, { error: `No se pudo leer ${CONFIG_FILE}: ${String(err)}` });
      }
    }
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/channels") {
    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      const channels = Array.isArray(parsed) ? parsed : parsed.channels;
      if (!Array.isArray(channels) || channels.length !== 4 || !channels.every(isValidChannel)) {
        sendJson(res, 400, { error: "Body inválido: se esperan 4 canales con id/name/host/port/path/streamId/enabled (transport opcional)." });
        return true;
      }
      const sorted = channels.map(normalizeChannel).sort((a, b) => a.id - b.id);
      await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
      await fs.writeFile(CONFIG_FILE, `${JSON.stringify({ channels: sorted }, null, 2)}\n`, "utf-8");
      sendJson(res, 200, { ok: true, file: CONFIG_FILE, channels: sorted });
    } catch (err) {
      sendJson(res, 400, { error: `No se pudo guardar: ${String(err)}` });
    }
    return true;
  }

  sendJson(res, 405, { error: `Método ${req.method} no permitido en ${url.pathname}` });
  return true;
}

/** Servidor standalone opcional. */
export function startConfigServer({ port = Number(process.env.PORT ?? 3001), host = "127.0.0.1" } = {}) {
  const server = http.createServer(async (req, res) => {
    const handled = await handleConfigRequest(req, res);
    if (!handled) sendJson(res, 404, { error: "Not found" });
  });

  server.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
      console.warn(`[vms-config] Puerto ${port} ocupado: se asume que la API ya está corriendo.`);
    } else {
      console.error(`[vms-config] Error: ${String(err)}`);
    }
  });

  server.listen(port, host, () => {
    console.log(`[vms-config] API escuchando en http://${host}:${port}`);
    console.log(`[vms-config] Archivo: ${CONFIG_FILE}`);
  });

  return server;
}

// Ejecución directa: node server/vms-config-server.mjs [--port 3001]
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const portFlagIndex = process.argv.indexOf("--port");
  const port = portFlagIndex !== -1 ? Number(process.argv[portFlagIndex + 1]) : Number(process.env.PORT ?? 3001);
  startConfigServer({ port });
}
