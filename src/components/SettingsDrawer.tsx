import type { ChannelConfig, ChannelId, ChannelsSource } from "../config/channels";
import { validateChannel } from "../config/channels";
import type { ChannelStatus } from "../hooks/useJanusChannel";

interface ChannelLive {
  status: ChannelStatus;
  error: string | null;
  ice: string;
  pc: string;
}

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  channels: ChannelConfig[];
  source: ChannelsSource;
  apiAvailable: boolean;
  saving: boolean;
  error: string | null;
  statuses: Record<ChannelId, ChannelLive>;
  onUpdate: (id: ChannelId, patch: Partial<ChannelConfig>) => void;
  onSave: () => Promise<boolean>;
  onRetry: (id: ChannelId) => void;
  onReset: () => void;
}

const inputClass =
  "w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-400";

export const SettingsDrawer = ({
  open,
  onClose,
  channels,
  source,
  apiAvailable,
  saving,
  error,
  statuses,
  onUpdate,
  onSave,
  onRetry,
  onReset,
}: SettingsDrawerProps) => {
  if (!open) return null;

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify({ channels: [...channels].sort((a, b) => a.id - b.id) }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "channels.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Configuración de canales">
      <button aria-label="Cerrar configuración" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[380px] flex-col border-l border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold tracking-wide text-zinc-100">CANALES DE VIDEO</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {apiAvailable ? "Guardado en public/config/channels.json" : "Mini-API no detectada: se guarda en navegador"}
              {source === "file+local" ? " · hay cambios solo-locales" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-zinc-300 transition hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {channels.map((ch) => {
            const validation = validateChannel(ch);
            const live = statuses[ch.id];
            return (
              <section key={ch.id} className="rounded-lg border border-white/10 bg-zinc-900/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-bold tracking-wide text-zinc-200">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-[11px]">CH{ch.id}</span>
                    <input
                      value={ch.name}
                      onChange={(e) => onUpdate(ch.id, { name: e.target.value })}
                      className="w-32 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-zinc-100 outline-none focus:border-white/20 focus:bg-zinc-900"
                      aria-label={`Nombre canal ${ch.id}`}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={ch.enabled}
                      onChange={(e) => onUpdate(ch.id, { enabled: e.target.checked })}
                      className="h-3.5 w-3.5 accent-zinc-100"
                    />
                    Activo
                  </label>
                </div>

                <div className="grid grid-cols-[1fr_72px] gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-zinc-500">IP / Host Raspberry</span>
                    <input
                      value={ch.host}
                      onChange={(e) => onUpdate(ch.id, { host: e.target.value })}
                      placeholder="192.168.0.101"
                      inputMode="decimal"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-zinc-500">Puerto</span>
                    <input
                      value={ch.port}
                      onChange={(e) => onUpdate(ch.id, { port: Number(e.target.value) || 0 })}
                      inputMode="numeric"
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="mt-2 grid grid-cols-[104px_1fr] gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-zinc-500">Transporte</span>
                    <select
                      value={ch.transport}
                      onChange={(e) => onUpdate(ch.id, { transport: e.target.value === "http" ? "http" : "ws" })}
                      className={inputClass}
                    >
                      <option value="ws">WebSocket</option>
                      <option value="http">HTTP</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-zinc-500">Stream ID Janus</span>
                    <input
                      value={ch.streamId}
                      onChange={(e) => onUpdate(ch.id, { streamId: Number(e.target.value) || 0 })}
                      inputMode="numeric"
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="mt-2 grid grid-cols-[72px_1fr] gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-zinc-500">Path</span>
                    <input
                      value={ch.path}
                      onChange={(e) => onUpdate(ch.id, { path: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-zinc-500">URL efectiva</span>
                    <div className="truncate rounded-md border border-white/5 bg-zinc-900/60 px-2 py-1.5 font-mono text-[11px] text-zinc-400">
                      {ch.transport === "ws" ? "ws" : "http"}://{ch.host.trim() || "…"}:{ch.port}
                      {ch.path}
                    </div>
                  </label>
                </div>

                {validation ? (
                  <p className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300">{validation}</p>
                ) : (
                  <p className="mt-2 truncate font-mono text-[11px] text-zinc-500">
                    {ch.transport === "ws" ? "ws" : "http"}://{ch.host.trim() || "…"}:{ch.port}
                    {ch.path} · id {ch.streamId}
                  </p>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">
                    Estado: <span className="font-semibold text-zinc-300">{live?.status ?? "…"}</span>
                    {" · "}ICE <span className="font-semibold text-zinc-300">{live?.ice ?? "…"}</span>
                    {live?.error ? <span className="text-rose-400"> · {live.error.slice(0, 80)}</span> : ""}
                  </span>
                  <button
                    onClick={() => onRetry(ch.id)}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-white/10"
                  >
                    Reconectar
                  </button>
                </div>
              </section>
            );
          })}
        </div>

        {error && (
          <p className="shrink-0 border-t border-amber-400/20 bg-amber-400/5 px-4 py-2 text-[11px] leading-snug text-amber-200">{error}</p>
        )}

        <div className="shrink-0 space-y-2 border-t border-white/10 p-3">
          <button
            onClick={() => void onSave()}
            disabled={saving}
            className="w-full rounded-lg bg-zinc-100 py-2 text-sm font-bold text-zinc-950 transition hover:bg-white disabled:opacity-50"
          >
            {saving ? "Guardando..." : apiAvailable ? "Guardar en channels.json" : "Guardar (navegador)"}
          </button>
          <div className="flex gap-2">
            <button
              onClick={downloadJson}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
              title="Descarga el JSON para copiarlo a public/config/channels.json"
            >
              ⬇ Descargar JSON
            </button>
            <button
              onClick={onReset}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
            >
              Restablecer
            </button>
          </div>
          <p className="text-center text-[10px] leading-snug text-zinc-600">
            Se guarda en <span className="font-mono">public/config/channels.json</span> — editable también a mano en el repo.
          </p>
        </div>
      </aside>
    </div>
  );
};
