// Config de canales del VMS.
// Fuente canónica: public/config/channels.json (carpeta del proyecto, versionable).
// La UI lee ese JSON y, si la mini-API (server/vms-config-server.mjs) está corriendo,
// guarda ahí mismo vía PUT /api/channels. Sin API, los cambios quedan en localStorage
// como override local + opción de descargar el JSON.

export type ChannelId = 1 | 2 | 3 | 4;

export interface ChannelConfig {
  id: ChannelId;
  name: string;
  host: string;
  port: number;
  /** Path del signalling, normalmente "/janus" */
  path: string;
  streamId: number;
  enabled: boolean;
}

export const CHANNELS_JSON_URL = "/config/channels.json";
export const CHANNELS_API_URL = "/api/channels";
const LOCAL_OVERRIDE_KEY = "vms-channels-local-v1";

export const LAYOUT_STORAGE_KEY = "vms-layout-v1";
export const FOCUSED_STORAGE_KEY = "vms-focused-v1";

export type VmsLayout = "1x1" | "2x1" | "2x2";
export type ChannelsSource = "api" | "file" | "file+local" | "defaults";

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizePath = (path: string): string => {
  if (!path) return "/janus";
  return path.startsWith("/") ? path : `/${path}`;
};

/** Extrae host/port/path de una URL completa tipo http://192.168.0.197:8088/janus */
const parseJanusUrl = (url: string | undefined, fallbackHost: string): { host: string; port: number; path: string } => {
  if (!url) return { host: fallbackHost, port: 8088, path: "/janus" };
  try {
    const u = new URL(url);
    return {
      host: u.hostname || fallbackHost,
      port: u.port ? Number(u.port) : 8088,
      path: u.pathname || "/janus",
    };
  } catch {
    return { host: fallbackHost, port: 8088, path: "/janus" };
  }
};

export const buildJanusUrl = (ch: Pick<ChannelConfig, "host" | "port" | "path">): string => {
  const host = ch.host.trim();
  const path = normalizePath(ch.path);
  return `http://${host}:${ch.port}${path}`;
};

const env = import.meta.env;

const defaultChannel = (
  id: ChannelId,
  legacyUrl: string | undefined,
  legacyStreamId: number,
  fallbackHost: string,
  fallbackName: string,
): ChannelConfig => {
  const parsed = parseJanusUrl(legacyUrl, fallbackHost);
  const host = (env[`VITE_CAM${id}_HOST`] as string | undefined) ?? parsed.host;
  const port = toNumber(env[`VITE_CAM${id}_PORT`], parsed.port);
  const path = normalizePath((env[`VITE_CAM${id}_PATH`] as string | undefined) ?? parsed.path);
  const streamId = toNumber(env[`VITE_CAM${id}_STREAM_ID`], legacyStreamId);
  const name = (env[`VITE_CAM${id}_NAME`] as string | undefined) ?? fallbackName;
  return { id, name, host, port, path, streamId, enabled: true };
};

/** Defaults compilados (fallback si el JSON no carga). Sincronizados con public/config/channels.json */
export const defaultChannels = (): ChannelConfig[] => [
  defaultChannel(1, env.VITE_JANUS_SERVER_FRONT_URL ?? env.VITE_JANUS_SERVER_URL, toNumber(env.VITE_STREAM_FRONT_ID, 99), "192.168.0.197", "Cámara 1"),
  defaultChannel(2, env.VITE_JANUS_SERVER_REAR_URL ?? env.VITE_JANUS_SERVER_URL, toNumber(env.VITE_STREAM_REAR_ID, 100), "192.168.0.199", "Cámara 2"),
  defaultChannel(3, undefined, toNumber(env.VITE_CAM3_STREAM_ID, 101), "192.168.0.198", "Cámara 3"),
  defaultChannel(4, undefined, toNumber(env.VITE_CAM4_STREAM_ID, 102), "192.168.0.200", "Cámara 4"),
];

export const isValidChannelShape = (c: unknown): c is ChannelConfig => {
  if (typeof c !== "object" || c === null) return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.id === "number" &&
    o.id >= 1 &&
    o.id <= 4 &&
    typeof o.name === "string" &&
    typeof o.host === "string" &&
    typeof o.port === "number" &&
    typeof o.path === "string" &&
    typeof o.streamId === "number" &&
    typeof o.enabled === "boolean"
  );
};

const sanitizeChannels = (input: unknown, base: ChannelConfig[]): ChannelConfig[] | null => {
  const list = Array.isArray(input) ? input : (input as { channels?: unknown })?.channels;
  if (!Array.isArray(list)) return null;
  const merged = base.map((d) => {
    const found = list.find((c) => isValidChannelShape(c) && c.id === d.id) as ChannelConfig | undefined;
    if (!found) return d;
    return { ...d, ...found, id: d.id, path: normalizePath(String(found.path ?? d.path)) };
  });
  return merged.length === 4 ? merged : null;
};

const fetchJson = async (url: string): Promise<unknown> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
};

export const getLocalOverride = (): ChannelConfig[] | null => {
  try {
    const raw = localStorage.getItem(LOCAL_OVERRIDE_KEY);
    if (!raw) return null;
    return sanitizeChannels(JSON.parse(raw), defaultChannels());
  } catch {
    return null;
  }
};

export const setLocalOverride = (channels: ChannelConfig[]): void => {
  localStorage.setItem(LOCAL_OVERRIDE_KEY, JSON.stringify(channels));
};

export const clearLocalOverride = (): void => {
  localStorage.removeItem(LOCAL_OVERRIDE_KEY);
};

/**
 * Carga canales con prioridad: API (JSON en disco vía server) > JSON estático > defaults.
 * Si la API no está disponible pero hay override local, se aplica encima del JSON.
 */
export const resolveChannels = async (): Promise<{ channels: ChannelConfig[]; source: ChannelsSource; apiAvailable: boolean }> => {
  const defaults = defaultChannels();

  try {
    const apiData = await fetchJson(CHANNELS_API_URL);
    const fromApi = sanitizeChannels(apiData, defaults);
    if (fromApi) {
      clearLocalOverride();
      return { channels: fromApi, source: "api", apiAvailable: true };
    }
  } catch {
    /* API no disponible, seguimos al JSON estático */
  }

  try {
    const fileData = await fetchJson(CHANNELS_JSON_URL);
    const fromFile = sanitizeChannels(fileData, defaults);
    if (fromFile) {
      const local = getLocalOverride();
      if (local) return { channels: local, source: "file+local", apiAvailable: false };
      return { channels: fromFile, source: "file", apiAvailable: false };
    }
  } catch {
    /* JSON no accesible */
  }

  const local = getLocalOverride();
  if (local) return { channels: local, source: "file+local", apiAvailable: false };
  return { channels: defaults, source: "defaults", apiAvailable: false };
};

/**
 * Guarda canales. Intenta PUT /api/channels (escribe public/config/channels.json en disco).
 * Si la API no responde, guarda override en localStorage y lanza error para avisar.
 */
export const persistChannels = async (channels: ChannelConfig[]): Promise<{ savedToFile: boolean }> => {
  const sorted = [...channels].sort((a, b) => a.id - b.id);
  try {
    const res = await fetch(CHANNELS_API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels: sorted }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    clearLocalOverride();
    return { savedToFile: true };
  } catch (err) {
    setLocalOverride(sorted);
    throw new Error(
      "Sin conexión a la mini-API: cambios guardados solo en este navegador (localStorage). Corre `npm run server` junto a `npm run dev` para escribir en public/config/channels.json.",
      { cause: err },
    );
  }
};

/** Valida IP/hostname simple + puerto + streamId. Devuelve mensaje o null si ok. */
export const validateChannel = (ch: ChannelConfig): string | null => {
  const host = ch.host.trim();
  if (!host) return "El host/IP no puede estar vacío.";
  const hostOk = /^(?=.{1,253}$)(([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*|(\d{1,3}\.){3}\d{1,3})$/.test(host);
  if (!hostOk) return "Host/IP inválido.";
  if (!Number.isInteger(ch.port) || ch.port < 1 || ch.port > 65535) return "Puerto inválido (1-65535).";
  if (!Number.isInteger(ch.streamId) || ch.streamId <= 0) return "Stream ID debe ser un entero positivo.";
  if (!ch.name.trim()) return "El nombre no puede estar vacío.";
  return null;
};

export const RECONNECT = {
  BASE_MS: toNumber(env.VITE_RECONNECT_BASE_MS, 1000),
  MAX_MS: toNumber(env.VITE_RECONNECT_MAX_MS, 10000),
};
