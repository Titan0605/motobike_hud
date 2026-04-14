using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Unity.WebRTC;
using UnityEngine;

namespace JanusQuest.WebRtc
{
    public sealed class JanusWebRtcPeer : IDisposable
    {
        private readonly RTCPeerConnection _peerConnection;
        private VideoStreamTrack _remoteVideoTrack;

        public event Action<string, string, int> LocalIceCandidateReady;
        public event Action<Texture> RemoteVideoTextureReady;

        public JanusWebRtcPeer(string[] iceServers)
        {
            var rtcConfig = new RTCConfiguration
            {
                iceServers = BuildIceServers(iceServers),
            };

            _peerConnection = new RTCPeerConnection(ref rtcConfig);
            _peerConnection.OnIceCandidate = OnLocalIceCandidate;
            _peerConnection.OnTrack = OnTrack;
        }

        public async Task<string> HandleOfferAndCreateAnswerAsync(string remoteSdp)
        {
            var offer = new RTCSessionDescription
            {
                type = RTCSdpType.Offer,
                sdp = remoteSdp,
            };

            var setRemoteOp = _peerConnection.SetRemoteDescription(ref offer);
            await AwaitOperation(setRemoteOp, "SetRemoteDescription failed");

            var createAnswerOp = _peerConnection.CreateAnswer();
            while (!createAnswerOp.IsDone)
            {
                await Task.Yield();
            }

            if (createAnswerOp.IsError)
            {
                throw new InvalidOperationException($"CreateAnswer failed: {createAnswerOp.Error.message}");
            }

            var answer = createAnswerOp.Desc;
            var setLocalOp = _peerConnection.SetLocalDescription(ref answer);
            await AwaitOperation(setLocalOp, "SetLocalDescription failed");

            return answer.sdp;
        }

        public void AddRemoteIceCandidate(string candidate, string sdpMid, int sdpMLineIndex)
        {
            var ice = new RTCIceCandidate(new RTCIceCandidateInit
            {
                candidate = candidate,
                sdpMid = sdpMid,
                sdpMLineIndex = sdpMLineIndex,
            });

            _peerConnection.AddIceCandidate(ice);
        }

        private static RTCIceServer[] BuildIceServers(string[] urls)
        {
            if (urls == null || urls.Length == 0)
            {
                return Array.Empty<RTCIceServer>();
            }

            var servers = new List<RTCIceServer>();
            foreach (var url in urls)
            {
                if (string.IsNullOrWhiteSpace(url))
                {
                    continue;
                }

                servers.Add(new RTCIceServer
                {
                    urls = new[] { url }
                });
            }

            return servers.ToArray();
        }

        private void OnTrack(RTCTrackEvent evt)
        {
            if (evt.Track is not VideoStreamTrack videoTrack)
            {
                return;
            }

            _remoteVideoTrack = videoTrack;
            _remoteVideoTrack.OnVideoReceived += tex => { RemoteVideoTextureReady?.Invoke(tex); };
        }

        private void OnLocalIceCandidate(RTCIceCandidate candidate)
        {
            if (candidate == null || string.IsNullOrWhiteSpace(candidate.Candidate))
            {
                return;
            }

            LocalIceCandidateReady?.Invoke(candidate.Candidate, candidate.SdpMid, candidate.SdpMLineIndex ?? 0);
        }

        private static async Task AwaitOperation(RTCSetSessionDescriptionAsyncOperation op, string message)
        {
            while (!op.IsDone)
            {
                await Task.Yield();
            }

            if (op.IsError)
            {
                throw new InvalidOperationException($"{message}: {op.Error.message}");
            }
        }

        public void Dispose()
        {
            if (_remoteVideoTrack != null)
            {
                _remoteVideoTrack.Dispose();
                _remoteVideoTrack = null;
            }

            _peerConnection?.Close();
            _peerConnection?.Dispose();
        }
    }
}
