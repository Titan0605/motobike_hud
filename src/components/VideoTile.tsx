import { useEffect, useRef } from "react";
import type { ChannelConfig } from "../config/channels";
import type { ChannelStatus } from "../hooks/useJanusChannel";

interface VideoTileProps {
  config: ChannelConfig;
  stream: MediaStream | null;
  status: ChannelStatus;
  attempts: number;
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

export const VideoTile = ({ config, stream, status, attempts, onRetry }: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const online = status === "online" && stream;

  return (
    <div className="relative min-h-0 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-black">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />

      {/* Overlay superior: nombre + estado (mínimo, no tapa el video) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-2">
        <div className="flex min-w-0 items-center gap-2 rounded-md bg-black/50 px-2 py-1 backdrop-blur-sm">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass[status]}`} />
          <span className="truncate text-xs font-semibold tracking-wide text-zinc-100">
            CH{config.id} · {config.name}
          </span>
          <span className="hidden truncate text-[11px] text-zinc-400 sm:inline">
            {config.host}:{config.port} · id {config.streamId}
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
            {config.host}:{config.port} · stream {config.streamId}
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
    </div>
  );
};
