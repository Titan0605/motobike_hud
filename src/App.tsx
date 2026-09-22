import { useState } from "react";
import { TopBar } from "./components/TopBar";
import { VideoGrid } from "./components/VideoGrid";
import { VideoTile } from "./components/VideoTile";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { useChannels } from "./hooks/useChannels";
import { useJanusChannel } from "./hooks/useJanusChannel";
import { FOCUSED_STORAGE_KEY, LAYOUT_STORAGE_KEY, type ChannelId, type VmsLayout } from "./config/channels";

const readStored = <T extends string>(key: string, fallback: T): T => {
  try {
    return (localStorage.getItem(key) as T) ?? fallback;
  } catch {
    return fallback;
  }
};

const LOCAL_LAYOUT_FALLBACK = LAYOUT_STORAGE_KEY;

function App() {
  const { channels, source, apiAvailable, loading, saving, error, updateChannel, save, resetToDefaults } = useChannels();
  const [layout, setLayout] = useState<VmsLayout>(() => {
    const v: string = readStored<string>(LOCAL_LAYOUT_FALLBACK, "2x2");
    return v === "1x1" || v === "2x1" || v === "2x2" ? v : "2x2";
  });
  const [focusedId, setFocusedId] = useState<ChannelId>(() => {
    const v = Number(readStored(FOCUSED_STORAGE_KEY, "1"));
    return v >= 1 && v <= 4 ? (v as ChannelId) : 1;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 4 sesiones Janus independientes (orden estable, una por Raspberry)
  const ch1 = useJanusChannel(channels[0]);
  const ch2 = useJanusChannel(channels[1]);
  const ch3 = useJanusChannel(channels[2]);
  const ch4 = useJanusChannel(channels[3]);
  const states = [ch1, ch2, ch3, ch4];

  const setLayoutPersist = (l: VmsLayout) => {
    setLayout(l);
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, l);
    } catch {
      /* noop */
    }
  };

  const setFocusedPersist = (id: ChannelId) => {
    setFocusedId(id);
    try {
      localStorage.setItem(FOCUSED_STORAGE_KEY, String(id));
    } catch {
      /* noop */
    }
  };

  const onlineCount = channels.filter((c, i) => c.enabled && states[i]?.isOnline).length;
  const totalActive = channels.filter((c) => c.enabled).length;

  const renderTile = (id: ChannelId) => {
    const idx = id - 1;
    const config = channels[idx];
    const st = states[idx];
    if (!config || !st) return null;
    return <VideoTile key={id} config={config} stream={st.stream} status={st.status} attempts={st.attempts} onRetry={st.retry} />;
  };

  const retryById = (id: ChannelId) => states[id - 1]?.retry();

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <TopBar
        layout={layout}
        onLayout={setLayoutPersist}
        focusedId={focusedId}
        onFocused={setFocusedPersist}
        onlineCount={onlineCount}
        totalActive={totalActive}
        apiAvailable={apiAvailable}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {loading && (
        <p className="shrink-0 border-b border-white/5 bg-zinc-900/60 px-3 py-1 text-center text-[11px] text-zinc-500">
          Cargando configuración desde {source === "defaults" ? "valores por defecto" : source}...
        </p>
      )}

      <main className="flex min-h-0 flex-1 flex-col">
        <VideoGrid layout={layout} focusedId={focusedId} renderTile={renderTile} />
      </main>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        channels={channels}
        source={source}
        apiAvailable={apiAvailable}
        saving={saving}
        error={error}
        statuses={{
          1: { status: ch1.status, error: ch1.error },
          2: { status: ch2.status, error: ch2.error },
          3: { status: ch3.status, error: ch3.error },
          4: { status: ch4.status, error: ch4.error },
        }}
        onUpdate={updateChannel}
        onSave={save}
        onRetry={retryById}
        onReset={resetToDefaults}
      />
    </div>
  );
}

export default App;
