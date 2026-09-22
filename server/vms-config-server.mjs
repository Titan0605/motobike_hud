// Mini-API sin dependencias para persistir la config del VMS en un JSON del proyecto.
// Sirve/actualiza public/config/channels.json para que la UI pueda guardar IPs en disco.
//
// Uso:
//   node server/vms-config-server.mjs            (puerto 3001 por defecto)
//   PORT=3001 node server/vms-config-server.mjs
//
// Endpoints:
//   GET  /api/health    -> { ok: true }
//   GET  /api/channels  -> contenido de channels.json
//   PUT  /api/channels  -> valida y sobrescribe channels.json. Body: { channels: [...] }

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONFIG_FILE = path.join(ROOT, "public", "config", "channels.json");
const PORT = Number(process.env.PORT ?? 3001);

const sendJson = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
};

const isValidChannel = (c) =>
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
  typeof c.enabled === "boolean";

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, file: CONFIG_FILE });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/channels") {
    try {
      const raw = await fs.readFile(CONFIG_FILE, "utf-8");
      sendJson(res, 200, JSON.parse(raw));
    } catch (err) {
      sendJson(res, 500, { error: `No se pudo leer ${CONFIG_FILE}: ${String(err)}` });
    }
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/channels") {
    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      const channels = Array.isArray(parsed) ? parsed : parsed.channels;
      if (!Array.isArray(channels) || channels.length !== 4 || !channels.every(isValidChannel)) {
        sendJson(res, 400, { error: "Body inválido: se esperan 4 canales con id/name/host/port/path/streamId/enabled." });
        return;
      }
      const sorted = [...channels].sort((a, b) => a.id - b.id);
      await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
      await fs.writeFile(CONFIG_FILE, `${JSON.stringify({ channels: sorted }, null, 2)}\n`, "utf-8");
      sendJson(res, 200, { ok: true, channels: sorted });
    } catch (err) {
      sendJson(res, 400, { error: `No se pudo guardar: ${String(err)}` });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`[vms-config] API escuchando en http://localhost:${PORT}`);
  console.log(`[vms-config] Archivo: ${CONFIG_FILE}`);
});
