const toNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const JANUS_CONFIG = {
  JANUS_SERVER_FRONT_URL: import.meta.env.VITE_JANUS_SERVER_FRONT_URL ?? import.meta.env.VITE_JANUS_SERVER_URL ?? "http://192.168.1.50:8088/janus",
  JANUS_SERVER_REAR_URL: import.meta.env.VITE_JANUS_SERVER_REAR_URL ?? import.meta.env.VITE_JANUS_SERVER_URL ?? "http://192.168.1.51:8088/janus",
  STREAM_FRONT_ID: toNumber(import.meta.env.VITE_STREAM_FRONT_ID, 99),
  STREAM_REAR_ID: toNumber(import.meta.env.VITE_STREAM_REAR_ID, 100),
  RECONNECT_BASE_MS: toNumber(import.meta.env.VITE_RECONNECT_BASE_MS, 1000),
  RECONNECT_MAX_MS: toNumber(import.meta.env.VITE_RECONNECT_MAX_MS, 10000),
};

export const validateJanusConfig = (): string | null => {
  const errors: string[] = [];

  if (!JANUS_CONFIG.JANUS_SERVER_FRONT_URL.startsWith("http")) {
    errors.push("JANUS_SERVER_FRONT_URL invalido. Debe iniciar con http:// o https://.");
  }

  if (!JANUS_CONFIG.JANUS_SERVER_REAR_URL.startsWith("http")) {
    errors.push("JANUS_SERVER_REAR_URL invalido. Debe iniciar con http:// o https://.");
  }

  if (JANUS_CONFIG.STREAM_FRONT_ID <= 0 || JANUS_CONFIG.STREAM_REAR_ID <= 0) {
    errors.push("Los IDs de stream deben ser numeros positivos.");
  }

  return errors.length > 0 ? errors.join(" ") : null;
};
