# Unity 6.3 Janus Dual Stream (Quest)

This folder contains a Unity-ready `Assets/` package that mirrors the React Janus dual-stream flow:

- Two fixed stream roles: `Front` and `Rear`
- Janus signaling over WebSocket
- Unity WebRTC receive-only playback
- Independent reconnect per stream with exponential backoff
- Aggregate status: `Connecting`, `Partial`, `Online`, `Error`

## Prerequisites

- Unity 6.3
- Android build target for Meta Quest
- OpenXR enabled for Quest runtime
- Unity WebRTC package installed in your Unity project

## Import

1. Copy the `Assets/JanusQuest` folder into your Unity project `Assets/` directory.
2. Install `com.unity.webrtc` from Package Manager.
3. Create a `JanusDualStreamConfig` asset from:
   `Assets/Create/Janus Quest/Janus Dual Stream Config`
4. Add `JanusDualStreamManager` to a GameObject in your scene.
5. Assign config and optional `RawImage` render targets.
6. Press Play and verify both streams transition to online.

## Preconfigured LAN Defaults

The module now includes default endpoints for immediate test on your current LAN:

- Front: `ws://192.168.0.201:8188/janus`
- Rear: `ws://192.168.0.202:8188/janus`
- Stream IDs: `99` and `100`

If your Janus websocket endpoint does not use `/janus`, update to:

- `ws://192.168.0.201:8188`
- `ws://192.168.0.202:8188`

## Notes

- This implementation expects WebSocket Janus endpoints.
- If your Janus deployment differs from defaults, set explicit URLs in config.
- For Quest LAN use, ensure headset and host are on the same subnet and firewall allows Janus/WebSocket ports.
