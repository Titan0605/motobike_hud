import { HudView } from "./components/HudView";
import { useJanusDualStream } from "./hooks/useJanusDualStream";

function App() {
  const { frontStream, rearStream, status, frontStatus, rearStatus, error, reconnectAttemptsFront, reconnectAttemptsRear, isFrontOnline, isRearOnline } = useJanusDualStream();

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
      telemetry={{
        speed: "0 KM/H",
        battery: "95%",
        latency: latencyText,
      }}
    />
  );
}

export default App;
