import { useState } from "react";
import type { JanusTransport } from "../config/janusConfig";
import FilteredVideo from "./FilteredVideo.tsx";

type CameraStatus = "connecting" | "online" | "error";
type ConnectionStatus = "connecting" | "partial" | "online" | "error";
type StreamStats = { fps: number; frames: number };

type HudViewProps = {
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
  onTransportChange: (nextTransport: JanusTransport) => void;
  showTransportSelector: boolean;
  telemetry: {
    speed: string;
    battery: string;
    latency: string;
  };
};

const statusLabelMap: Record<ConnectionStatus, string> = {
  connecting: "Conectando...",
  partial: "En linea parcial",
  online: "En Linea",
  error: "Error de Conexion",
};

const cameraLabelMap: Record<CameraStatus, string> = {
  connecting: "Conectando",
  online: "En linea",
  error: "Error",
};

export const HudView = ({
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
  onTransportChange,
  showTransportSelector,
  telemetry,
}: HudViewProps) => {
  // Front filter state
  const [frontEnable, setFrontEnable] = useState(true);
  const [frontSaturate, setFrontSaturate] = useState(1.06);
  const [frontContrast, setFrontContrast] = useState(1.04);
  const [frontBrightness, setFrontBrightness] = useState(1);
  const [frontSharpen, setFrontSharpen] = useState(true);

  // Rear filter state
  const [rearEnable, setRearEnable] = useState(true);
  const [rearSaturate, setRearSaturate] = useState(1.06);
  const [rearContrast, setRearContrast] = useState(1.04);
  const [rearBrightness, setRearBrightness] = useState(1);
  const [rearSharpen, setRearSharpen] = useState(false);

  // stats
  const [frontFps, setFrontFps] = useState(0);
  const [rearFps, setRearFps] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <main className="hud-shell" aria-live="polite">
      <section className="front-layer">
        <FilteredVideo
          stream={frontStream}
          className="front-video"
          enableFilters={frontEnable}
          sharpen={frontSharpen}
          saturate={frontSaturate}
          contrast={frontContrast}
          brightness={frontBrightness}
          onStats={(s: StreamStats) => {
            setFrontFps(s.fps);
          }}
        />
        {!isFrontOnline && <div className="stream-placeholder front-placeholder">Esperando camara frontal...</div>}
      </section>

      <section className="rear-mirror">
        <FilteredVideo
          stream={rearStream}
          className="rear-video"
          enableFilters={rearEnable}
          sharpen={rearSharpen}
          saturate={rearSaturate}
          contrast={rearContrast}
          brightness={rearBrightness}
          onStats={(s: StreamStats) => {
            setRearFps(s.fps);
          }}
        />
        {!isRearOnline && <div className="stream-placeholder rear-placeholder">Retrovisor sin senal...</div>}
      </section>

      <header className={`status-pill status-${status}`}>
        <span>{statusLabelMap[status]}</span>
        {(reconnectAttemptsFront > 0 || reconnectAttemptsRear > 0) && (
          <span>
            F#{reconnectAttemptsFront} R#{reconnectAttemptsRear}
          </span>
        )}
        <span>
          Cam F: {cameraLabelMap[frontStatus]} | Cam R: {cameraLabelMap[rearStatus]}
        </span>
      </header>

      <div className="filter-stats">
        <div>Frontal: {frontFps} FPS</div>
        <div>Retro: {rearFps} FPS</div>
      </div>

      {showTransportSelector && (
        <section className="transport-control" aria-label="Selector de transporte">
          <span className="transport-label">Transporte</span>
          <div className="transport-buttons" role="radiogroup" aria-label="Modo de transporte Janus">
            <button
              type="button"
              className={transport === "http" ? "is-active" : ""}
              onClick={() => onTransportChange("http")}
              disabled={isSwitchingTransport}
              role="radio"
              aria-checked={transport === "http"}>
              HTTP
            </button>
            <button
              type="button"
              className={transport === "ws" ? "is-active" : ""}
              onClick={() => onTransportChange("ws")}
              disabled={isSwitchingTransport}
              role="radio"
              aria-checked={transport === "ws"}>
              WebSocket
            </button>
          </div>
          {isSwitchingTransport && <span className="transport-switching">Cambiando transporte...</span>}
        </section>
      )}

      <button
        type="button"
        className={`filter-panel-toggle ${filtersOpen ? "is-open" : ""}`}
        aria-expanded={filtersOpen}
        aria-label={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
        onClick={() => setFiltersOpen((value) => !value)}>
        <span className="filter-panel-toggle-icon">{filtersOpen ? "›" : "‹"}</span>
      </button>

      <section className={`filter-panel ${filtersOpen ? "is-open" : "is-closed"}`} aria-label="Controles de filtros">
        <div className="filter-group">
          <strong>Frontal</strong>
          <label>
            <input type="checkbox" checked={frontEnable} onChange={(e) => setFrontEnable(e.target.checked)} /> Activar filtros
          </label>
          <label>
            <input type="checkbox" checked={frontSharpen} onChange={(e) => setFrontSharpen(e.target.checked)} /> Nitidez
          </label>
          <label>
            Saturación: <input type="range" min="0.5" max="2" step="0.01" value={frontSaturate} onChange={(e) => setFrontSaturate(parseFloat(e.target.value))} /> {frontSaturate.toFixed(2)}
          </label>
          <label>
            Contraste: <input type="range" min="0.5" max="2" step="0.01" value={frontContrast} onChange={(e) => setFrontContrast(parseFloat(e.target.value))} /> {frontContrast.toFixed(2)}
          </label>
          <label>
            Brillo: <input type="range" min="0.5" max="1.5" step="0.01" value={frontBrightness} onChange={(e) => setFrontBrightness(parseFloat(e.target.value))} /> {frontBrightness.toFixed(2)}
          </label>
        </div>

        <div className="filter-group">
          <strong>Retrovisor</strong>
          <label>
            <input type="checkbox" checked={rearEnable} onChange={(e) => setRearEnable(e.target.checked)} /> Activar filtros
          </label>
          <label>
            <input type="checkbox" checked={rearSharpen} onChange={(e) => setRearSharpen(e.target.checked)} /> Nitidez
          </label>
          <label>
            Saturación: <input type="range" min="0.5" max="2" step="0.01" value={rearSaturate} onChange={(e) => setRearSaturate(parseFloat(e.target.value))} /> {rearSaturate.toFixed(2)}
          </label>
          <label>
            Contraste: <input type="range" min="0.5" max="2" step="0.01" value={rearContrast} onChange={(e) => setRearContrast(parseFloat(e.target.value))} /> {rearContrast.toFixed(2)}
          </label>
          <label>
            Brillo: <input type="range" min="0.5" max="1.5" step="0.01" value={rearBrightness} onChange={(e) => setRearBrightness(parseFloat(e.target.value))} /> {rearBrightness.toFixed(2)}
          </label>
        </div>
      </section>

      {error && <aside className="error-banner">{error}</aside>}

      <section className="hud-overlay hud-left">
        <p>VEL: {telemetry.speed}</p>
      </section>

      <section className="hud-overlay hud-right">
        <p>BAT: {telemetry.battery}</p>
        <p>LATENCIA: {telemetry.latency}</p>
      </section>
    </main>
  );
};
