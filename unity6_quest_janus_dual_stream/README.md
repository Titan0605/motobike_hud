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

## Notes

- This implementation expects WebSocket Janus endpoints.
- If your Janus deployment differs from defaults, set explicit URLs in config.
- For Quest LAN use, ensure headset and host are on the same subnet and firewall allows Janus/WebSocket ports.
