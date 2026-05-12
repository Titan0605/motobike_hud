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
const parseBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
};

const parseBitrateKbps = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
};

export const JANUS_CONFIG = {
  JANUS_HTTP_SERVER_FRONT_URL: import.meta.env.VITE_JANUS_HTTP_SERVER_FRONT_URL ?? legacyFrontUrl,
  JANUS_HTTP_SERVER_REAR_URL: import.meta.env.VITE_JANUS_HTTP_SERVER_REAR_URL ?? legacyRearUrl,
  JANUS_WS_SERVER_FRONT_URL: import.meta.env.VITE_JANUS_WS_SERVER_FRONT_URL ?? resolveJanusServerUrlSafe(legacyFrontUrl, "ws"),
  JANUS_WS_SERVER_REAR_URL: import.meta.env.VITE_JANUS_WS_SERVER_REAR_URL ?? resolveJanusServerUrlSafe(legacyRearUrl, "ws"),
  SHOW_TRANSPORT_SELECTOR: parseBoolean(import.meta.env.VITE_SHOW_TRANSPORT_SELECTOR, false),
  FORCE_SDP_VIDEO_BITRATE: parseBoolean(import.meta.env.VITE_FORCE_SDP_VIDEO_BITRATE, false),
  SDP_VIDEO_BITRATE_KBPS: parseBitrateKbps(import.meta.env.VITE_SDP_VIDEO_BITRATE_KBPS, 4000),
  STREAM_FRONT_ID: toNumber(import.meta.env.VITE_STREAM_FRONT_ID, 99),
  STREAM_REAR_ID: toNumber(import.meta.env.VITE_STREAM_REAR_ID, 100),
  RECONNECT_BASE_MS: toNumber(import.meta.env.VITE_RECONNECT_BASE_MS, 1000),
  RECONNECT_MAX_MS: toNumber(import.meta.env.VITE_RECONNECT_MAX_MS, 10000),
};

const applyBitrateToVideoSection = (section: string, bitrateKbps: number): string => {
  if (bitrateKbps <= 0) {
    return section;
  }

  const lines = section.split("\n");
  const hasBandwidthLine = lines.some((line) => line.startsWith("b=AS:") || line.startsWith("b=TIAS:"));
  if (hasBandwidthLine) {
    return section;
  }

  const insertionIndex = lines.findIndex((line) => line.startsWith("c="));
  if (insertionIndex === -1) {
    return section;
  }

  const bandwidthBitsPerSecond = bitrateKbps * 1000;
  lines.splice(insertionIndex + 1, 0, `b=AS:${bitrateKbps}`, `b=TIAS:${bandwidthBitsPerSecond}`);
  return lines.join("\n");
};

export const patchAnswerSdpWithVideoBitrate = (sdp: string, bitrateKbps = JANUS_CONFIG.SDP_VIDEO_BITRATE_KBPS): string => {
  if (!JANUS_CONFIG.FORCE_SDP_VIDEO_BITRATE || bitrateKbps <= 0) {
    return sdp;
  }

  const sections = sdp.split(/\r?\nm=/);
  if (sections.length <= 1) {
    return sdp;
  }

  const patchedSections = sections.map((section, index) => {
    if (index === 0) {
      return section;
    }

    const sectionWithPrefix = `m=${section}`;
    if (!sectionWithPrefix.startsWith("m=video")) {
      return sectionWithPrefix;
    }

    const lines = sectionWithPrefix.split(/\r?\n/);
    const head = lines.shift() ?? "";
    const patchedBody = applyBitrateToVideoSection(lines.join("\n"), bitrateKbps);
    return [head, patchedBody].filter(Boolean).join("\n");
  });

  return patchedSections.map((section, index) => (index === 0 ? section : `\n${section}`)).join("");
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
