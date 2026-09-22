import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelConfig } from "../config/channels";
import type { ChannelStatus } from "../hooks/useJanusChannel";
import { FilteredVideo } from "./FilteredVideo";

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
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [frameState, setFrameState] = useState<FrameState>("waiting");

  const handleVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
  }, []);

  const resume = useCallback(() => {
    const video = videoElRef.current;
    if (video && video.paused) {
      const result = video.play() as Promise<void> | undefined;
      result?.catch(() => {});
    }
  }, []);

  const handleStats = useCallback((stats: { fps: number; frames: number }) => {
    if (stats.frames > 0) {
      setFrameState("ok");
      setNeedsGesture(false);
    }
  }, []);

  // ¿El elemento quedó pausado (autoplay bloqueado)? -> ofrecer gesto de usuario.
  useEffect(() => {
    if (!stream || status !== "online") {
      // Reset al cambiar de stream/estado.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNeedsGesture(false);
      return;
    }
    const id = window.setInterval(() => {
      const video = videoElRef.current;
      if (!video) return;
      setNeedsGesture(video.paused);
    }, 1500);
    return () => window.clearInterval(id);
  }, [stream, status]);

  // Watchdog: online pero sin frames en 8s (media atascada o códec no decodificable).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrameState("waiting");
    if (!stream || status !== "online") return;
    const timeout = window.setTimeout(() => {
      setFrameState((state) => (state === "waiting" ? "missing" : state));
    }, 8000);
    return () => window.clearTimeout(timeout);
  }, [stream, status]);

  const online = status === "online" && stream;

  return (
    <div className="relative min-h-0 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-black" onClick={resume}>
      {online && (
        <FilteredVideo
          stream={stream}
          className="h-full w-full object-cover"
          enableFilters={false}
          onStats={handleStats}
          onVideoElement={handleVideoElement}
        />
      )}

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

      {/* Autoplay bloqueado: recuperar con gesto del usuario */}
      {online && needsGesture && frameState !== "ok" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            resume();
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-center"
        >
          <span className="text-2xl">▶</span>
          <span className="text-xs font-medium text-zinc-200">Toca para reproducir</span>
        </button>
      )}

      {/* Reproduciendo pero sin frames */}
      {online && !needsGesture && frameState === "missing" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2">
          <span className="rounded-md bg-black/60 px-2 py-1 text-[11px] text-amber-200 backdrop-blur-sm">
            Conectado · sin imagen (ICE {ice}) — revisa mountpoint/códec en Janus o si ICE no llega a connected
          </span>
        </div>
      )}
    </div>
  );
};
