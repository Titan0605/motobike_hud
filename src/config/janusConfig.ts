const toNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export type JanusTransport = "http" | "ws";
export type StreamRole = "front" | "rear";

const SUPPORTED_PROTOCOLS = ["http:", "ws:"] as const;

const isSupportedProtocol = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return SUPPORTED_PROTOCOLS.includes(parsed.protocol as (typeof SUPPORTED_PROTOCOLS)[number]);
  } catch {
    return false;
  }
};

const resolveJanusServerUrl = (baseUrl: string, transport: JanusTransport): string => {
  const parsed = new URL(baseUrl);
  parsed.protocol = transport === "http" ? "http:" : "ws:";
  return parsed.toString();
};

const resolveJanusServerUrlSafe = (baseUrl: string, transport: JanusTransport): string => {
  try {
    return resolveJanusServerUrl(baseUrl, transport);
  } catch {
    return baseUrl;
  }
};

const legacyFrontUrl = import.meta.env.VITE_JANUS_SERVER_FRONT_URL ?? import.meta.env.VITE_JANUS_SERVER_URL ?? "http://192.168.1.50:8088/janus";
const legacyRearUrl = import.meta.env.VITE_JANUS_SERVER_REAR_URL ?? import.meta.env.VITE_JANUS_SERVER_URL ?? "http://192.168.1.51:8088/janus";

export const JANUS_CONFIG = {
  JANUS_HTTP_SERVER_FRONT_URL: import.meta.env.VITE_JANUS_HTTP_SERVER_FRONT_URL ?? legacyFrontUrl,
  JANUS_HTTP_SERVER_REAR_URL: import.meta.env.VITE_JANUS_HTTP_SERVER_REAR_URL ?? legacyRearUrl,
  JANUS_WS_SERVER_FRONT_URL: import.meta.env.VITE_JANUS_WS_SERVER_FRONT_URL ?? resolveJanusServerUrlSafe(legacyFrontUrl, "ws"),
  JANUS_WS_SERVER_REAR_URL: import.meta.env.VITE_JANUS_WS_SERVER_REAR_URL ?? resolveJanusServerUrlSafe(legacyRearUrl, "ws"),
  STREAM_FRONT_ID: toNumber(import.meta.env.VITE_STREAM_FRONT_ID, 99),
  STREAM_REAR_ID: toNumber(import.meta.env.VITE_STREAM_REAR_ID, 100),
  RECONNECT_BASE_MS: toNumber(import.meta.env.VITE_RECONNECT_BASE_MS, 1000),
  RECONNECT_MAX_MS: toNumber(import.meta.env.VITE_RECONNECT_MAX_MS, 10000),
};

export const getJanusServerUrl = (role: StreamRole, transport: JanusTransport): string => {
  if (role === "front") {
    return transport === "http" ? JANUS_CONFIG.JANUS_HTTP_SERVER_FRONT_URL : JANUS_CONFIG.JANUS_WS_SERVER_FRONT_URL;
  }

  return transport === "http" ? JANUS_CONFIG.JANUS_HTTP_SERVER_REAR_URL : JANUS_CONFIG.JANUS_WS_SERVER_REAR_URL;
};

export const validateJanusConfig = (): string | null => {
  const errors: string[] = [];

  if (!isSupportedProtocol(JANUS_CONFIG.JANUS_HTTP_SERVER_FRONT_URL)) {
    errors.push("JANUS_HTTP_SERVER_FRONT_URL invalido. Debe usar protocolo http:// o ws://.");
  }

  if (!isSupportedProtocol(JANUS_CONFIG.JANUS_HTTP_SERVER_REAR_URL)) {
    errors.push("JANUS_HTTP_SERVER_REAR_URL invalido. Debe usar protocolo http:// o ws://.");
  }

  if (!isSupportedProtocol(JANUS_CONFIG.JANUS_WS_SERVER_FRONT_URL)) {
    errors.push("JANUS_WS_SERVER_FRONT_URL invalido. Debe usar protocolo http:// o ws://.");
  }

  if (!isSupportedProtocol(JANUS_CONFIG.JANUS_WS_SERVER_REAR_URL)) {
    errors.push("JANUS_WS_SERVER_REAR_URL invalido. Debe usar protocolo http:// o ws://.");
  }

  if (JANUS_CONFIG.STREAM_FRONT_ID <= 0 || JANUS_CONFIG.STREAM_REAR_ID <= 0) {
    errors.push("Los IDs de stream deben ser numeros positivos.");
  }

  return errors.length > 0 ? errors.join(" ") : null;
};
