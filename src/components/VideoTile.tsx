import { useEffect, useRef, useState } from "react";
import type { ChannelConfig } from "../config/channels";
import type { ChannelStatus } from "../hooks/useJanusChannel";

interface VideoTileProps {
  config: ChannelConfig;
  stream: MediaStream | null;
  status: ChannelStatus;
  attempts: number;
  ice: string;
  onRetry: () => void;
}

const dotClass: Record<ChannelStatus, string> = {
  online: "bg-emerald-400",
  connecting: "bg-amber-400 animate-pulse",
  error: "bg-rose-500",
  disabled: "bg-zinc-600",
};

const statusText: Record<ChannelStatus, string> = {
  online: "EN VIVO",
  connecting: "Conectando",
  error: "Sin señal",
  disabled: "Desactivado",
};

type FrameState = "waiting" | "ok" | "missing";

export const VideoTile = ({ config, stream, status, attempts, ice, onRetry }: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameState, setFrameState] = useState<FrameState>("waiting");

  // Reproducción explícita: asignar srcObject no garantiza play() (el autoplay se puede
  // quedar colgado si se interrumpe durante reconexiones). Igual que la rama que funcionaba.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    if (!stream) {
      video.srcObject = null;
      return;
    }
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    let cancelled = false;
    const tryPlay = () => {
      if (cancelled) return;
      try {
        const result = video.play() as Promise<void> | undefined;
        result?.catch(() => {});
      } catch {
        /* navegadores viejos: se reintenta en canplay */
      }
    };
    tryPlay();
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("loadeddata", tryPlay);
    // Auto-recuperación: si algo pausa el elemento, reintentar cada 2s.
    const nudge = window.setInterval(() => {
      if (!cancelled && video.paused) tryPlay();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(nudge);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("loadeddata", tryPlay);
    };
  }, [stream]);

  // Reflejar play/pause en la UI.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    setIsPlaying(!video.paused);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  // Watchdog de frames: distingue "no está reproduciendo" de "reproduce pero sin imagen"
  // (p. ej. códec H.265 que VLC sí decodifica pero el navegador no).
  useEffect(() => {
    // Reset intencional al cambiar de stream/estado (sincronización con el pipeline de medios).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrameState("waiting");
    if (!stream || status !== "online") return;
    const video = videoRef.current;
    if (!video) return;

    let stopped = false;
    let handle = 0;
    let timeout = 0;
    const markMissing = () => {
      if (!stopped) setFrameState((s) => (s === "waiting" ? "missing" : s));
    };

    if (typeof video.requestVideoFrameCallback === "function") {
      let count = 0;
      const onFrame = () => {
        if (stopped) return;
        count += 1;
        if (count >= 2) {
          setFrameState("ok");
          return;
        }
        handle = video.requestVideoFrameCallback(onFrame);
      };
      handle = video.requestVideoFrameCallback(onFrame);
      timeout = window.setTimeout(markMissing, 8000);
      return () => {
        stopped = true;
        window.clearTimeout(timeout);
        if (typeof video.cancelVideoFrameCallback === "function" && handle) {
          try {
            video.cancelVideoFrameCallback(handle);
          } catch {
            /* noop */
          }
        }
      };
    }

    timeout = window.setTimeout(() => {
      const current = videoRef.current;
      if (!stopped && current && current.readyState >= 2 && current.videoWidth > 0) {
        setFrameState("ok");
      } else {
        markMissing();
      }
    }, 4000);
    return () => {
      stopped = true;
      window.clearTimeout(timeout);
    };
  }, [stream, status]);

  const handleTileClick = () => {
    const video = videoRef.current;
    if (video && video.paused && stream) {
      try {
        const result = video.play() as Promise<void> | undefined;
        result?.catch(() => {});
      } catch {
        /* noop */
      }
    }
  };

  const online = status === "online" && stream;

  return (
    <div className="relative min-h-0 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-black" onClick={handleTileClick}>
      <video ref={videoRef} autoPlay playsInline muted disablePictureInPicture className="absolute inset-0 h-full w-full object-cover" />

      {/* Overlay superior: nombre + estado (mínimo, no tapa el video) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-2">
        <div className="flex min-w-0 items-center gap-2 rounded-md bg-black/50 px-2 py-1 backdrop-blur-sm">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass[status]}`} />
          <span className="truncate text-xs font-semibold tracking-wide text-zinc-100">
            CH{config.id} · {config.name}
          </span>
          <span className="hidden truncate text-[11px] text-zinc-400 sm:inline">
            {config.transport}://{config.host}:{config.port} · id {config.streamId}
          </span>
        </div>
        <span className="shrink-0 rounded-md bg-black/50 px-2 py-1 text-[11px] font-medium tracking-wide text-zinc-300 backdrop-blur-sm">
          {statusText[status]}
          {status === "error" && attempts > 0 ? ` · r${attempts}` : ""}
        </span>
      </div>

      {/* Placeholder cuando no hay video */}
      {!online && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950 p-4 text-center">
          <span className={`h-2.5 w-2.5 rounded-full ${dotClass[status]}`} />
          <p className="text-sm font-medium text-zinc-300">
            {status === "disabled" ? `${config.name} desactivado` : status === "error" ? "Sin señal" : "Conectando..."}
          </p>
          <p className="max-w-[26ch] truncate text-xs text-zinc-500">
            {config.transport}://{config.host}:{config.port} · stream {config.streamId}
          </p>
          {status === "error" && (
            <button
              onClick={onRetry}
              className="pointer-events-auto mt-1 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
            >
              Reintentar ahora
            </button>
          )}
        </div>
      )}

      {/* Pausado con stream: recuperación con gesto del usuario */}
      {online && !isPlaying && (
        <button
          onClick={handleTileClick}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-center"
        >
          <span className="text-2xl">▶</span>
          <span className="text-xs font-medium text-zinc-200">Toca para reproducir</span>
        </button>
      )}

      {/* Reproduciendo pero sin frames: no llegan medios, o códec no decodificable */}
      {online && isPlaying && frameState === "missing" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2">
          <span className="rounded-md bg-black/60 px-2 py-1 text-[11px] text-amber-200 backdrop-blur-sm">
            Conectado · sin imagen (ICE {ice}) — si el ICE no llega a connected, revisa UDP/firewall; si sí, revisa códec o mountpoint
          </span>
        </div>
      )}
    </div>
  );
};
