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
  const [camerasSwapped, setCamerasSwapped] = useState(false);

  // Determinar cuál es la cámara principal y cuál es secundaria
  const mainStream = camerasSwapped ? rearStream : frontStream;
  const mainIsOnline = camerasSwapped ? isRearOnline : isFrontOnline;
  const mainFps = camerasSwapped ? rearFps : frontFps;
  const mainEnable = camerasSwapped ? rearEnable : frontEnable;
  const mainSharpen = camerasSwapped ? rearSharpen : frontSharpen;
  const mainSaturate = camerasSwapped ? rearSaturate : frontSaturate;
  const mainContrast = camerasSwapped ? rearContrast : frontContrast;
  const mainBrightness = camerasSwapped ? rearBrightness : frontBrightness;

  const secondaryStream = camerasSwapped ? frontStream : rearStream;
  const secondaryIsOnline = camerasSwapped ? isFrontOnline : isRearOnline;
  const secondaryFps = camerasSwapped ? frontFps : rearFps;
  const secondaryEnable = camerasSwapped ? frontEnable : rearEnable;
  const secondarySharpen = camerasSwapped ? frontSharpen : rearSharpen;
  const secondarySaturate = camerasSwapped ? frontSaturate : rearSaturate;
  const secondaryContrast = camerasSwapped ? frontContrast : rearContrast;
  const secondaryBrightness = camerasSwapped ? frontBrightness : rearBrightness;

  const setMainEnable = camerasSwapped ? setRearEnable : setFrontEnable;
  const setMainSharpen = camerasSwapped ? setRearSharpen : setFrontSharpen;
  const setMainSaturate = camerasSwapped ? setRearSaturate : setFrontSaturate;
  const setMainContrast = camerasSwapped ? setRearContrast : setFrontContrast;
  const setMainBrightness = camerasSwapped ? setRearBrightness : setFrontBrightness;

  const setSecondaryEnable = camerasSwapped ? setFrontEnable : setRearEnable;
  const setSecondarySharpen = camerasSwapped ? setFrontSharpen : setRearSharpen;
  const setSecondarySaturate = camerasSwapped ? setFrontSaturate : setRearSaturate;
  const setSecondaryContrast = camerasSwapped ? setFrontContrast : setRearContrast;
  const setSecondaryBrightness = camerasSwapped ? setFrontBrightness : setRearBrightness;

  return (
    <main className="hud-shell" aria-live="polite">
      <section className="front-layer">
        <FilteredVideo
          stream={mainStream}
          className="front-video"
          enableFilters={mainEnable}
          sharpen={mainSharpen}
          saturate={mainSaturate}
          contrast={mainContrast}
          brightness={mainBrightness}
          onStats={(s: StreamStats) => {
            if (camerasSwapped) {
              setRearFps(s.fps);
            } else {
              setFrontFps(s.fps);
            }
          }}
        />
        {!mainIsOnline && <div className="stream-placeholder front-placeholder">{camerasSwapped ? "Esperando retrovisor..." : "Esperando camara frontal..."}</div>}
      </section>

      <section className="rear-mirror">
        <FilteredVideo
          stream={secondaryStream}
          className="rear-video"
          enableFilters={secondaryEnable}
          sharpen={secondarySharpen}
          saturate={secondarySaturate}
          contrast={secondaryContrast}
          brightness={secondaryBrightness}
          onStats={(s: StreamStats) => {
            if (camerasSwapped) {
              setFrontFps(s.fps);
            } else {
              setRearFps(s.fps);
            }
          }}
        />
        {!secondaryIsOnline && <div className="stream-placeholder rear-placeholder">{camerasSwapped ? "Camara frontal sin señal..." : "Retrovisor sin señal..."}</div>}
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
        <div>
          {camerasSwapped ? "Retro" : "Frontal"}: {mainFps} FPS
        </div>
        <div>
          {camerasSwapped ? "Frontal" : "Retro"}: {secondaryFps} FPS
        </div>
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

      <button
        type="button"
        className="swap-cameras-btn"
        aria-label={camerasSwapped ? "Mostrar cámara frontal a pantalla completa" : "Mostrar retrovisor a pantalla completa"}
        title={camerasSwapped ? "Cambiar a frontal" : "Cambiar a retrovisor"}
        onClick={() => setCamerasSwapped((prev) => !prev)}>
        ⇄
      </button>

      <section className={`filter-panel ${filtersOpen ? "is-open" : "is-closed"}`} aria-label="Controles de filtros">
        <div className="filter-group">
          <strong>{camerasSwapped ? "Retrovisor" : "Frontal"}</strong>
          <label>
            <input type="checkbox" checked={mainEnable} onChange={(e) => setMainEnable(e.target.checked)} /> Activar filtros
          </label>
          <label>
            <input type="checkbox" checked={mainSharpen} onChange={(e) => setMainSharpen(e.target.checked)} /> Nitidez
          </label>
          <label>
            Saturación: <input type="range" min="0.5" max="2" step="0.01" value={mainSaturate} onChange={(e) => setMainSaturate(parseFloat(e.target.value))} /> {mainSaturate.toFixed(2)}
          </label>
          <label>
            Contraste: <input type="range" min="0.5" max="2" step="0.01" value={mainContrast} onChange={(e) => setMainContrast(parseFloat(e.target.value))} /> {mainContrast.toFixed(2)}
          </label>
          <label>
            Brillo: <input type="range" min="0.5" max="1.5" step="0.01" value={mainBrightness} onChange={(e) => setMainBrightness(parseFloat(e.target.value))} /> {mainBrightness.toFixed(2)}
          </label>
        </div>

        <div className="filter-group">
          <strong>{camerasSwapped ? "Frontal" : "Retrovisor"}</strong>
          <label>
            <input type="checkbox" checked={secondaryEnable} onChange={(e) => setSecondaryEnable(e.target.checked)} /> Activar filtros
          </label>
          <label>
            <input type="checkbox" checked={secondarySharpen} onChange={(e) => setSecondarySharpen(e.target.checked)} /> Nitidez
          </label>
          <label>
            Saturación: <input type="range" min="0.5" max="2" step="0.01" value={secondarySaturate} onChange={(e) => setSecondarySaturate(parseFloat(e.target.value))} /> {secondarySaturate.toFixed(2)}
          </label>
          <label>
            Contraste: <input type="range" min="0.5" max="2" step="0.01" value={secondaryContrast} onChange={(e) => setSecondaryContrast(parseFloat(e.target.value))} /> {secondaryContrast.toFixed(2)}
          </label>
          <label>
            Brillo: <input type="range" min="0.5" max="1.5" step="0.01" value={secondaryBrightness} onChange={(e) => setSecondaryBrightness(parseFloat(e.target.value))} />{" "}
            {secondaryBrightness.toFixed(2)}
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
