import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JanusJsep, JanusMessage, JanusPluginHandle } from "janus-gateway/npm/dist/janus.es.js";
import { buildJanusUrl, RECONNECT, type ChannelConfig } from "../config/channels";
import { ensureJanusInit, isWebrtcSupported, Janus } from "../lib/janusInit";

export type ChannelStatus = "connecting" | "online" | "error" | "disabled";

export interface JanusChannelState {
  stream: MediaStream | null;
  status: ChannelStatus;
  error: string | null;
  attempts: number;
  isOnline: boolean;
  retry: () => void;
}

const STREAMING_PLUGIN = "janus.plugin.streaming";

type JanusSession = InstanceType<typeof Janus>;

export const useJanusChannel = (config: ChannelConfig): JanusChannelState => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<ChannelStatus>(config.enabled ? "connecting" : "disabled");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [nonce, setNonce] = useState(0);

  const sessionRef = useRef<JanusSession | null>(null);
  const handleRef = useRef<JanusPluginHandle | null>(null);
  const timerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(false);

  const serverUrl = useMemo(() => buildJanusUrl(config), [config]);
  const { streamId, enabled } = config;

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const destroySession = useCallback(() => {
    clearTimer();
    try {
      handleRef.current?.hangup();
    } catch {
      /* noop */
    }
    try {
      handleRef.current?.detach();
    } catch {
      /* noop */
    }
    handleRef.current = null;
    try {
      sessionRef.current?.destroy();
    } catch {
      /* noop */
    }
    sessionRef.current = null;
  }, [clearTimer]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      destroySession();
      // Sincronización intencional con el sistema externo Janus (sin sesión = sin estado).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStream(null);
      setStatus("disabled");
      setError(null);
      setAttempts(0);
      attemptRef.current = 0;
      return;
    }

    let cancelled = false;
    setStatus("connecting");
    setError(null);

    const markOnline = (media: MediaStream) => {
      if (cancelled || !mountedRef.current) return;
      setStream(media);
      setStatus("online");
      setError(null);
      attemptRef.current = 0;
      setAttempts(0);
    };

    const scheduleReconnect = (reason: string) => {
      if (cancelled || !mountedRef.current) return;
      if (timerRef.current !== null) return;
      setStatus("error");
      setError(reason);
      const next = attemptRef.current + 1;
      attemptRef.current = next;
      setAttempts(next);
      const delay = Math.min(RECONNECT.BASE_MS * 2 ** (next - 1), RECONNECT.MAX_MS);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (cancelled || !mountedRef.current) return;
        destroySession();
        connect();
      }, delay);
    };

    const attach = (session: JanusSession) => {
      let pluginHandle: JanusPluginHandle | null = null;
      const trackStream = new MediaStream();

      session.attach({
        plugin: STREAMING_PLUGIN,
        success: (attached) => {
          if (cancelled) return;
          pluginHandle = attached;
          handleRef.current = attached;
          attached.send({ message: { request: "watch", id: streamId } });
        },
        error: (attachError) => {
          scheduleReconnect(`No se pudo adjuntar al plugin: ${String(attachError)}`);
        },
        onmessage: (msg: JanusMessage, jsep?: JanusJsep) => {
          if (cancelled) return;
          if (msg.error) {
            scheduleReconnect(`Error de stream: ${String(msg.error)}`);
            return;
          }
          if (!jsep || !pluginHandle) return;
          const handle = pluginHandle;
          handle.createAnswer({
            jsep,
            media: { audioSend: false, videoSend: false, data: false },
            success: (localJsep) => {
              if (cancelled) return;
              handle.send({ message: { request: "start" }, jsep: localJsep });
            },
            error: (e) => {
              scheduleReconnect(`Error SDP: ${String(e)}`);
            },
          });
        },
        onremotetrack: (track, _mid, on) => {
          if (!on) {
            trackStream.removeTrack(track);
            return;
          }
          trackStream.addTrack(track);
          markOnline(trackStream);
        },
        onremotestream: (remote) => {
          markOnline(remote);
        },
        webrtcState: (isUp: boolean) => {
          if (!isUp) scheduleReconnect("Conexión WebRTC caída.");
        },
        oncleanup: () => {
          if (cancelled || !mountedRef.current) return;
          setStream(null);
          setStatus((s) => (s === "online" ? "connecting" : s));
        },
      });
    };

    const connect = () => {
      if (cancelled || !mountedRef.current) return;
      setStatus("connecting");
      const session = new Janus({
        server: serverUrl,
        success: () => {
          if (cancelled) return;
          attach(session);
        },
        error: (e) => {
          scheduleReconnect(`No se pudo crear sesión Janus: ${String(e)}`);
        },
        destroyed: () => {
          if (!cancelled && mountedRef.current) {
            scheduleReconnect("Sesión Janus destruida.");
          }
        },
      });
      sessionRef.current = session;
    };

    if (!isWebrtcSupported()) {
      setStatus("error");
      setError("WebRTC no soportado en este navegador.");
      return () => {
        cancelled = true;
      };
    }

    if (!serverUrl.startsWith("http")) {
      setStatus("error");
      setError("URL de Janus inválida.");
      return () => {
        cancelled = true;
      };
    }

    ensureJanusInit().then(() => {
      if (!cancelled && mountedRef.current) connect();
    });

    return () => {
      cancelled = true;
      destroySession();
      setStream(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl, streamId, enabled, nonce]);

  return { stream, status, error, attempts, isOnline: status === "online", retry };
};
