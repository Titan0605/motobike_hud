import { useState } from "react";
import { HudView } from "./components/HudView";
import { useJanusDualStream } from "./hooks/useJanusDualStream";
import type { JanusTransport } from "./config/janusConfig";

type HudRuntimeProps = {
  initialTransport: JanusTransport;
};

const HudRuntime = ({ initialTransport }: HudRuntimeProps) => {
  const {
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
  } = useJanusDualStream({ initialTransport, enabled: true });

  const reconnectLoad = reconnectAttemptsFront + reconnectAttemptsRear;
  const latencyText = status === "online" ? `${24 + (reconnectLoad % 18)} ms` : "-- ms";

  return (
    <HudView
      frontStream={frontStream}
      rearStream={rearStream}
      status={status}
      frontStatus={frontStatus}
      rearStatus={rearStatus}
      error={error}
      reconnectAttemptsFront={reconnectAttemptsFront}
      reconnectAttemptsRear={reconnectAttemptsRear}
      isFrontOnline={isFrontOnline}
      isRearOnline={isRearOnline}
      transport={transport}
      isSwitchingTransport={isSwitchingTransport}
      onTransportChange={switchTransport}
      telemetry={{
        speed: "0 KM/H",
        battery: "95%",
        latency: latencyText,
      }}
    />
  );
};

function App() {
  const [selectedTransport, setSelectedTransport] = useState<JanusTransport | null>(null);

  if (!selectedTransport) {
    return (
      <main className="transport-gate">
        <section className="transport-gate-card" aria-label="Seleccion inicial de transporte">
          <h1>Selecciona el transporte Janus</h1>
          <p>Elige como quieres conectar esta sesion de testing.</p>
          <div className="transport-gate-actions" role="group" aria-label="Opciones de transporte inicial">
            <button type="button" onClick={() => setSelectedTransport("http")}>
              HTTP
            </button>
            <button type="button" onClick={() => setSelectedTransport("ws")}>
              WebSocket
            </button>
          </div>
        </section>
      </main>
    );
  }

  return <HudRuntime initialTransport={selectedTransport} />;
}

export default App;
