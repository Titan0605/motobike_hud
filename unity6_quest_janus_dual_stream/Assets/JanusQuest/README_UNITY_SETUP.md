# Unity 6.3 Setup Notes

## Package Requirements

Install from Package Manager:

- `com.unity.webrtc`

If your Unity 6.3 editor cannot resolve the latest package revision, pin the latest compatible version that compiles for Android in your project.

## Scene Setup

1. Create config asset: `Assets/Create/Janus Quest/Janus Dual Stream Config`.
2. Add `JanusDualStreamManager` to a scene GameObject.
3. Assign config asset.
4. Optionally assign two `RawImage` references for front/rear playback.
5. (Optional) Add `JanusStatusLogger` and assign manager to print state transitions.

## Config Mapping from React .env

- `VITE_JANUS_SERVER_FRONT_URL` -> `FrontJanusWsUrl` (WebSocket endpoint)
- `VITE_JANUS_SERVER_REAR_URL` -> `RearJanusWsUrl` (WebSocket endpoint)
- `VITE_STREAM_FRONT_ID` -> `FrontStreamId`
- `VITE_STREAM_REAR_ID` -> `RearStreamId`
- `VITE_RECONNECT_BASE_MS` -> `ReconnectBaseMs`
- `VITE_RECONNECT_MAX_MS` -> `ReconnectMaxMs`

Note: React app currently uses HTTP Janus URLs. This Unity module uses WebSocket signaling. Set explicit WS endpoints.

## Quest Validation Checklist

1. Build target: Android.
2. Confirm headset and Janus servers are in same LAN.
3. Verify Janus WS ports are open from headset subnet.
4. Start app and confirm aggregate state reaches `Online` or `Partial`.
5. Disable one stream endpoint and verify reconnect attempts increment with backoff.
