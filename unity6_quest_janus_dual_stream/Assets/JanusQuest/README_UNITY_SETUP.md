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

## Default Test Values Included

The config script now ships with these defaults for quick LAN testing:

- FrontJanusWsUrl: `ws://192.168.0.201:8188/janus`
- RearJanusWsUrl: `ws://192.168.0.202:8188/janus`
- FrontStreamId: `99`
- RearStreamId: `100`

If your Janus websocket endpoint is exposed without `/janus`, change URLs to:

- `ws://192.168.0.201:8188`
- `ws://192.168.0.202:8188`

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
