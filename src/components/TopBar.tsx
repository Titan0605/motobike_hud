import type { ChannelId, GridColumns, VmsLayout } from "../config/channels";

interface TopBarProps {
  layout: VmsLayout;
  onLayout: (l: VmsLayout) => void;
  focusedId: ChannelId;
  onFocused: (id: ChannelId) => void;
  columns: GridColumns;
  onColumns: (columns: GridColumns) => void;
  onlineCount: number;
  totalActive: number;
  apiAvailable: boolean;
  onOpenSettings: () => void;
}

const layouts: { id: VmsLayout; label: string; title: string }[] = [
  { id: "1x1", label: "1×1", title: "Un canal (usa tabs CH)" },
  { id: "2x1", label: "2×1", title: "Dos canales (CH1–CH2)" },
  { id: "2x2", label: "2×2", title: "Cuatro canales" },
];

const columnOptions: GridColumns[] = [1, 2, 3, 4];

export const TopBar = ({ layout, onLayout, focusedId, onFocused, columns, onColumns, onlineCount, totalActive, apiAvailable, onOpenSettings }: TopBarProps) => (
  <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-zinc-950/95 px-2 sm:gap-3 sm:px-3">
    <div className="flex min-w-0 items-center gap-2">
      <span className="hidden h-2 w-2 rounded-full bg-emerald-400 sm:inline-block" />
      <h1 className="truncate text-xs font-bold tracking-widest text-zinc-100 sm:text-sm">DRONE RACE · VMS</h1>
      <span
        className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium md:inline-block ${
          onlineCount === totalActive && totalActive > 0
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            : "border-white/10 bg-white/5 text-zinc-400"
        }`}
        title={apiAvailable ? "Config JSON en disco accesible vía API" : "Mini-API no detectada: cambios quedan en navegador"}
      >
        {onlineCount}/{totalActive} en vivo{apiAvailable ? "" : " · sin API"}
      </span>
    </div>

    <div className="mx-auto flex items-center gap-1">
      {/* Selector de grilla */}
      <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5" role="tablist" aria-label="Disposición de grilla">
        {layouts.map((l) => (
          <button
            key={l.id}
            title={l.title}
            onClick={() => onLayout(l.id)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition sm:px-3 ${
              layout === l.id ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Columnas de la grilla: controla el tamaño de los contenedores de video */}
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5" role="group" aria-label="Columnas de la grilla">
        <span className="hidden pl-1.5 pr-0.5 text-[11px] font-medium text-zinc-500 lg:inline">Columnas</span>
        {columnOptions.map((c) => (
          <button
            key={c}
            title={`${c} columna${c > 1 ? "s" : ""}`}
            aria-pressed={columns === c}
            onClick={() => onColumns(c)}
            className={`h-6 w-6 rounded-md text-xs font-semibold transition ${
              columns === c ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Tabs de canal, solo relevantes en 1x1 */}
      {layout === "1x1" && (
        <div className="ml-1 flex rounded-lg border border-white/10 bg-white/5 p-0.5" role="tablist" aria-label="Canal enfocado">
          {[1, 2, 3, 4].map((id) => (
            <button
              key={id}
              onClick={() => onFocused(id as ChannelId)}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                focusedId === id ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              CH{id}
            </button>
          ))}
        </div>
      )}
    </div>

    <button
      onClick={onOpenSettings}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
      title="Configurar IPs de cada canal (public/config/channels.json)"
    >
      <span aria-hidden>⚙</span>
      <span className="hidden sm:inline">Canales</span>
    </button>
  </header>
);
