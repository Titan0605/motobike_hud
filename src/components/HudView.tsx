import { useEffect, useRef } from "react";
import type { JanusTransport } from "../config/janusConfig";

type CameraStatus = "connecting" | "online" | "error";
type ConnectionStatus = "connecting" | "partial" | "online" | "error";

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
  telemetry,
}: HudViewProps) => {
  const frontVideoRef = useRef<HTMLVideoElement>(null);
  const rearVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!frontVideoRef.current) {
      return;
    }
    frontVideoRef.current.srcObject = frontStream;
  }, [frontStream]);

  useEffect(() => {
    if (!rearVideoRef.current) {
      return;
    }
    rearVideoRef.current.srcObject = rearStream;
  }, [rearStream]);

  return (
    <main className="hud-shell" aria-live="polite">
      <section className="front-layer">
        <video ref={frontVideoRef} className="front-video" autoPlay playsInline muted />
        {!isFrontOnline && <div className="stream-placeholder front-placeholder">Esperando camara frontal...</div>}
      </section>

      <section className="rear-mirror">
        <video ref={rearVideoRef} className="rear-video" autoPlay playsInline muted />
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
