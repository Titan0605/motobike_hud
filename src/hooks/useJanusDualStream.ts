import { useCallback, useEffect, useRef, useState } from "react";
import Janus, { type JanusJsep, type JanusMessage, type JanusPluginHandle } from "janus-gateway/npm/dist/janus.es.js";
import adapter from "webrtc-adapter";
import { getJanusServerUrl, JANUS_CONFIG, patchAnswerSdpWithVideoBitrate, type JanusTransport, validateJanusConfig } from "../config/janusConfig";

type CameraStatus = "connecting" | "online" | "error";
type ConnectionStatus = "connecting" | "partial" | "online" | "error";
type StreamRole = "front" | "rear";

type JanusWithDependencies = {
  init: (options: { debug: boolean; callback: () => void; dependencies?: unknown }) => void;
  useDefaultDependencies: (deps?: { adapter?: unknown }) => unknown;
};

type UseJanusDualStreamResult = {
  frontStream: MediaStream | null;
  rearStream: MediaStream | null;
  status: ConnectionStatus;
  frontStatus: CameraStatus;
  rearStatus: CameraStatus;
  error: string | null;
  reconnectAttemptsFront: number;
  reconnectAttemptsRear: number;
  isFrontOnline: boolean;
  isRearOnline: boolean;
  transport: JanusTransport;
  isSwitchingTransport: boolean;
  switchTransport: (nextTransport: JanusTransport) => void;
};

type UseJanusDualStreamOptions = {
  initialTransport: JanusTransport;
  enabled?: boolean;
};

const STREAMING_PLUGIN = "janus.plugin.streaming";
const MAX_SWITCH_RETRIES = 3;
const janusWithDependencies = Janus as unknown as JanusWithDependencies;

export const useJanusDualStream = ({ initialTransport, enabled = true }: UseJanusDualStreamOptions): UseJanusDualStreamResult => {
  const [frontStream, setFrontStream] = useState<MediaStream | null>(null);
  const [rearStream, setRearStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [frontStatus, setFrontStatus] = useState<CameraStatus>("connecting");
  const [rearStatus, setRearStatus] = useState<CameraStatus>("connecting");
  const [errorFront, setErrorFront] = useState<string | null>(null);
  const [errorRear, setErrorRear] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttemptsFront, setReconnectAttemptsFront] = useState(0);
  const [reconnectAttemptsRear, setReconnectAttemptsRear] = useState(0);
  const [isFrontOnline, setIsFrontOnline] = useState(false);
  const [isRearOnline, setIsRearOnline] = useState(false);
  const [transport, setTransport] = useState<JanusTransport>(initialTransport);
  const [isSwitchingTransport, setIsSwitchingTransport] = useState(false);

  const janusFrontRef = useRef<Janus | null>(null);
  const janusRearRef = useRef<Janus | null>(null);
  const frontHandleRef = useRef<JanusPluginHandle | null>(null);
  const rearHandleRef = useRef<JanusPluginHandle | null>(null);
  const reconnectTimerFrontRef = useRef<number | null>(null);
  const reconnectTimerRearRef = useRef<number | null>(null);
  const reconnectAttemptFrontRef = useRef(0);
  const reconnectAttemptRearRef = useRef(0);
  const janusInitializedRef = useRef(false);
  const mountedRef = useRef(false);
  const suppressReconnectRef = useRef(false);
  const switchingTransportRef = useRef(false);
  const currentTransportRef = useRef<JanusTransport>(initialTransport);
  const previousTransportRef = useRef<JanusTransport>(initialTransport);
  const switchRetryRef = useRef(0);

  const updateAggregateStatus = useCallback((nextFrontStatus: CameraStatus, nextRearStatus: CameraStatus) => {
    if (nextFrontStatus === "online" && nextRearStatus === "online") {
      setStatus("online");
      return;
    }

    if (nextFrontStatus === "online" || nextRearStatus === "online") {
      setStatus("partial");
      return;
    }

    if (nextFrontStatus === "error" || nextRearStatus === "error") {
      setStatus("error");
      return;
    }

    setStatus("connecting");
  }, []);

  const updateAggregateError = useCallback((nextFrontError: string | null, nextRearError: string | null) => {
    if (!nextFrontError && !nextRearError) {
      setError(null);
      return;
    }

    const entries: string[] = [];
    if (nextFrontError) {
      entries.push(`Frontal: ${nextFrontError}`);
    }
    if (nextRearError) {
      entries.push(`Trasera: ${nextRearError}`);
    }
    setError(entries.join(" | "));
  }, []);

  const markStreamOnline = useCallback((role: StreamRole, stream: MediaStream) => {
    if (role === "front") {
      setFrontStream(stream);
      setIsFrontOnline(true);
      setFrontStatus("online");
      setErrorFront(null);
      reconnectAttemptFrontRef.current = 0;
      setReconnectAttemptsFront(0);
      return;
    }

    setRearStream(stream);
    setIsRearOnline(true);
    setRearStatus("online");
    setErrorRear(null);
    reconnectAttemptRearRef.current = 0;
    setReconnectAttemptsRear(0);
  }, []);

  const cleanupCamera = useCallback((role: StreamRole) => {
    if (role === "front") {
      frontHandleRef.current?.hangup();
      frontHandleRef.current?.detach();
      frontHandleRef.current = null;
      janusFrontRef.current?.destroy();
      janusFrontRef.current = null;
      setFrontStream(null);
      setIsFrontOnline(false);
      setFrontStatus("connecting");
      return;
    }

    rearHandleRef.current?.hangup();
    rearHandleRef.current?.detach();
    rearHandleRef.current = null;
    janusRearRef.current?.destroy();
    janusRearRef.current = null;
    setRearStream(null);
    setIsRearOnline(false);
    setRearStatus("connecting");
  }, []);

  const cleanup = useCallback(() => {
    suppressReconnectRef.current = true;

    if (reconnectTimerFrontRef.current) {
      window.clearTimeout(reconnectTimerFrontRef.current);
      reconnectTimerFrontRef.current = null;
    }
    if (reconnectTimerRearRef.current) {
      window.clearTimeout(reconnectTimerRearRef.current);
      reconnectTimerRearRef.current = null;
    }

    cleanupCamera("front");
    cleanupCamera("rear");

    setFrontStream(null);
    setRearStream(null);
    setIsFrontOnline(false);
    setIsRearOnline(false);
    setFrontStatus("connecting");
    setRearStatus("connecting");
    setErrorFront(null);
    setErrorRear(null);
    setError(null);
    reconnectAttemptFrontRef.current = 0;
    reconnectAttemptRearRef.current = 0;
    setReconnectAttemptsFront(0);
    setReconnectAttemptsRear(0);
  }, [cleanupCamera]);

  const attachStream = useCallback(
    (role: StreamRole, streamId: number, janus: Janus) => {
      let pluginHandle: JanusPluginHandle | null = null;
      const trackStream = new MediaStream();

      janus.attach({
        plugin: STREAMING_PLUGIN,
        success: (attached) => {
          pluginHandle = attached;
          if (role === "front") {
            frontHandleRef.current = attached;
            setFrontStatus("connecting");
          } else {
            rearHandleRef.current = attached;
            setRearStatus("connecting");
          }
          attached.send({ message: { request: "watch", id: streamId } });
        },
        error: (attachError) => {
          scheduleReconnect(role, `Error al adjuntar plugin ${role}: ${String(attachError)}`);
        },
        onmessage: (msg: JanusMessage, jsep?: JanusJsep) => {
          if (msg.error) {
            scheduleReconnect(role, `Error de stream ${role}: ${msg.error}`);
            return;
          }

          if (!jsep || !pluginHandle) {
            return;
          }

          pluginHandle.createAnswer({
            jsep,
            media: { audioSend: false, videoSend: false, data: false },
            success: (localJsep) => {
              const patchedJsep = localJsep.sdp && JANUS_CONFIG.FORCE_SDP_VIDEO_BITRATE ? { ...localJsep, sdp: patchAnswerSdpWithVideoBitrate(localJsep.sdp) } : localJsep;

              pluginHandle?.send({ message: { request: "start" }, jsep: patchedJsep });
            },
            error: (createAnswerError) => {
              scheduleReconnect(role, `Error SDP en stream ${role}: ${String(createAnswerError)}`);
            },
          });
        },
        onremotetrack: (track, _mid, on) => {
          if (!on) {
            trackStream.removeTrack(track);
            return;
          }

          trackStream.addTrack(track);
          markStreamOnline(role, trackStream);
        },
        onremotestream: (remoteStream) => {
          markStreamOnline(role, remoteStream);
        },
        webrtcState: (isUp: boolean) => {
          if (!isUp) {
            scheduleReconnect(role, `WebRTC caido en stream ${role}`);
          }
        },
        oncleanup: () => {
          if (role === "front") {
            setIsFrontOnline(false);
            setFrontStream(null);
            setFrontStatus("connecting");
          } else {
            setIsRearOnline(false);
            setRearStream(null);
            setRearStatus("connecting");
          }
        },
      });
    },
    // Evita ciclo de dependencias entre attachStream/connectCamera/scheduleReconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markStreamOnline],
  );

  const connectCamera = useCallback(
    (role: StreamRole) => {
      if (!mountedRef.current) {
        return;
      }

      const isFront = role === "front";
      const streamId = isFront ? JANUS_CONFIG.STREAM_FRONT_ID : JANUS_CONFIG.STREAM_REAR_ID;
      const server = getJanusServerUrl(role, transport);

      if (isFront) {
        setFrontStatus("connecting");
      } else {
        setRearStatus("connecting");
      }

      const session = new Janus({
        server,
        success: () => {
          attachStream(role, streamId, session);
        },
        error: (sessionError) => {
          scheduleReconnect(role, `No se pudo crear sesion Janus ${role}: ${String(sessionError)}`);
        },
        destroyed: () => {
          if (mountedRef.current && !suppressReconnectRef.current) {
            scheduleReconnect(role, `Sesion Janus ${role} destruida.`);
          }
        },
      });

      if (isFront) {
        janusFrontRef.current = session;
      } else {
        janusRearRef.current = session;
      }
    },
    // Evita ciclo de dependencias entre connectCamera y scheduleReconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attachStream, transport],
  );

  const rollbackTransport = useCallback(
    (reason: string) => {
      const previousTransport = previousTransportRef.current;
      const failedTransport = currentTransportRef.current;

      if (previousTransport === failedTransport) {
        setIsSwitchingTransport(false);
        switchRetryRef.current = 0;
        return;
      }

      cleanup();
      setErrorFront(`No se pudo cambiar a ${failedTransport.toUpperCase()} tras ${MAX_SWITCH_RETRIES} reintentos. Volviendo a ${previousTransport.toUpperCase()}. ${reason}`);
      setErrorRear(`No se pudo cambiar a ${failedTransport.toUpperCase()} tras ${MAX_SWITCH_RETRIES} reintentos. Volviendo a ${previousTransport.toUpperCase()}. ${reason}`);
      switchRetryRef.current = 0;
      setIsSwitchingTransport(false);
      setTransport(previousTransport);
    },
    [cleanup],
  );

  const scheduleReconnect = useCallback(
    (role: StreamRole, reason: string) => {
      if (!mountedRef.current) {
        return;
      }

      if (suppressReconnectRef.current) {
        return;
      }

      if (switchingTransportRef.current) {
        switchRetryRef.current += 1;
        if (switchRetryRef.current >= MAX_SWITCH_RETRIES) {
          rollbackTransport(reason);
          return;
        }
      }

      if (role === "front") {
        if (reconnectTimerFrontRef.current) {
          return;
        }
        setFrontStatus("error");
        setErrorFront(reason);
        const nextAttempt = reconnectAttemptFrontRef.current + 1;
        reconnectAttemptFrontRef.current = nextAttempt;
        setReconnectAttemptsFront(nextAttempt);
        const delay = Math.min(JANUS_CONFIG.RECONNECT_BASE_MS * 2 ** (nextAttempt - 1), JANUS_CONFIG.RECONNECT_MAX_MS);

        reconnectTimerFrontRef.current = window.setTimeout(() => {
          reconnectTimerFrontRef.current = null;
          if (!mountedRef.current) {
            return;
          }
          cleanupCamera("front");
          connectCamera("front");
        }, delay);
        return;
      }

      if (reconnectTimerRearRef.current) {
        return;
      }
      setRearStatus("error");
      setErrorRear(reason);
      const nextAttempt = reconnectAttemptRearRef.current + 1;
      reconnectAttemptRearRef.current = nextAttempt;
      setReconnectAttemptsRear(nextAttempt);
      const delay = Math.min(JANUS_CONFIG.RECONNECT_BASE_MS * 2 ** (nextAttempt - 1), JANUS_CONFIG.RECONNECT_MAX_MS);

      reconnectTimerRearRef.current = window.setTimeout(() => {
        reconnectTimerRearRef.current = null;
        if (!mountedRef.current) {
          return;
        }
        cleanupCamera("rear");
        connectCamera("rear");
      }, delay);
    },
    [cleanupCamera, connectCamera, rollbackTransport],
  );

  const bootstrapJanus = useCallback(() => {
    if (!enabled) {
      return;
    }

    const configError = validateJanusConfig();
    if (configError) {
      setFrontStatus("error");
      setRearStatus("error");
      setErrorFront(configError);
      setErrorRear(configError);
      return;
    }

    if (!Janus.isWebrtcSupported()) {
      const unsupported = "WebRTC no soportado en este navegador.";
      setFrontStatus("error");
      setRearStatus("error");
      setErrorFront(unsupported);
      setErrorRear(unsupported);
      return;
    }

    suppressReconnectRef.current = false;

    if (janusInitializedRef.current) {
      connectCamera("front");
      connectCamera("rear");
      return;
    }

    janusWithDependencies.init({
      debug: false,
      dependencies: janusWithDependencies.useDefaultDependencies({ adapter }),
      callback: () => {
        if (!mountedRef.current) {
          return;
        }

        janusInitializedRef.current = true;
        connectCamera("front");
        connectCamera("rear");
      },
    });
  }, [connectCamera, enabled]);

  const switchTransport = useCallback(
    (nextTransport: JanusTransport) => {
      if (nextTransport === transport) {
        return;
      }

      previousTransportRef.current = currentTransportRef.current;
      switchRetryRef.current = 0;
      setIsSwitchingTransport(true);
      setTransport(nextTransport);
    },
    [transport],
  );

  useEffect(() => {
    updateAggregateStatus(frontStatus, rearStatus);
  }, [frontStatus, rearStatus, updateAggregateStatus]);

  useEffect(() => {
    updateAggregateError(errorFront, errorRear);
  }, [errorFront, errorRear, updateAggregateError]);

  useEffect(() => {
    mountedRef.current = true;
    bootstrapJanus();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [bootstrapJanus, cleanup]);

  useEffect(() => {
    if (!isSwitchingTransport) {
      return;
    }

    if (status === "online" || status === "partial") {
      switchRetryRef.current = 0;
      setIsSwitchingTransport(false);
    }
  }, [isSwitchingTransport, status]);

  useEffect(() => {
    switchingTransportRef.current = isSwitchingTransport;
  }, [isSwitchingTransport]);

  useEffect(() => {
    currentTransportRef.current = transport;
  }, [transport]);

  return {
    frontStream,
    rearStream,
    status,
    frontStatus,
    rearStatus,
    error,
    reconnectAttemptsFront,
    reconnectAttemptsRear,
    isFrontOnline,
    isRearOnline,
    transport,
    isSwitchingTransport,
    switchTransport,
  };
};
