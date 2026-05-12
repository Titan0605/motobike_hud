import { HudView } from "./components/HudView";
import { useJanusDualStream } from "./hooks/useJanusDualStream";
import { JANUS_CONFIG } from "./config/janusConfig";

const HudRuntime = () => {
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
  } = useJanusDualStream({ initialTransport: "ws", enabled: true });

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
      showTransportSelector={JANUS_CONFIG.SHOW_TRANSPORT_SELECTOR}
      telemetry={{
        speed: "0 KM/H",
        battery: "95%",
        latency: latencyText,
      }}
    />
  );
};

function App() {
  return <HudRuntime />;
}

export default App;
