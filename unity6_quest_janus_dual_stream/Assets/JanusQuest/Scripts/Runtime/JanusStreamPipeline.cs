using System;
using System.Threading;
using System.Threading.Tasks;
using JanusQuest.Config;
using JanusQuest.Models;
using JanusQuest.Networking;
using JanusQuest.WebRtc;
using UnityEngine;

namespace JanusQuest.Runtime
{
    public sealed class JanusStreamPipeline : IDisposable
    {
        private readonly StreamRole _role;
        private readonly JanusDualStreamConfig _config;
        private readonly JanusWebSocketClient _client;
        private readonly JanusWebRtcPeer _peer;

        private long _sessionId;
        private long _handleId;
        private bool _disposed;
        private CancellationTokenSource _runCts;
        private Task _keepAliveTask;

        public event Action<StreamRole, Texture> RemoteTextureUpdated;
        public event Action<StreamRole, string> Failed;

        public JanusStreamPipeline(StreamRole role, JanusDualStreamConfig config)
        {
            _role = role;
            _config = config;
            _client = new JanusWebSocketClient();
            _peer = new JanusWebRtcPeer(config.IceServers);

            _client.MessageReceived += OnJanusMessage;
            _peer.LocalIceCandidateReady += OnLocalIceCandidate;
            _peer.RemoteVideoTextureReady += texture => RemoteTextureUpdated?.Invoke(_role, texture);
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            ThrowIfDisposed();

            _runCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            var token = _runCts.Token;

            var wsUrl = _config.GetWsUrl(_role);
            await _client.ConnectAsync(wsUrl, token);

            var createResponse = await _client.SendRequestAsync(
                janus: "create",
                token: _config.Token,
                apisecret: _config.ApiSecret,
                cancellationToken: token);

            if (!JanusProtocol.TryGetSessionId(createResponse, out _sessionId))
            {
                throw new InvalidOperationException($"[{_role}] Failed to create Janus session.");
            }

            var attachResponse = await _client.SendRequestAsync(
                janus: "attach",
                sessionId: _sessionId,
                extraFields: new System.Collections.Generic.Dictionary<string, object>
                {
                    ["plugin"] = JanusProtocol.PluginStreaming,
                },
                token: _config.Token,
                apisecret: _config.ApiSecret,
                cancellationToken: token);

            if (!JanusProtocol.TryGetHandleId(attachResponse, out _handleId))
            {
                throw new InvalidOperationException($"[{_role}] Failed to attach streaming plugin.");
            }

            await _client.SendRequestAsync(
                janus: "message",
                sessionId: _sessionId,
                handleId: _handleId,
                body: new { request = "watch", id = _config.GetStreamId(_role) },
                token: _config.Token,
                apisecret: _config.ApiSecret,
                cancellationToken: token);

            _keepAliveTask = Task.Run(() => KeepAliveLoopAsync(token), token);
        }

        public async Task StopAsync()
        {
            if (_disposed)
            {
                return;
            }

            try
            {
                _runCts?.Cancel();

                if (_sessionId != 0)
                {
                    try
                    {
                        await _client.SendRequestAsync(
                            janus: "detach",
                            sessionId: _sessionId,
                            handleId: _handleId,
                            token: _config.Token,
                            apisecret: _config.ApiSecret,
                            cancellationToken: CancellationToken.None);
                    }
                    catch
                    {
                        // Ignore detach failures during teardown.
                    }

                    try
                    {
                        await _client.SendRequestAsync(
                            janus: "destroy",
                            sessionId: _sessionId,
                            token: _config.Token,
                            apisecret: _config.ApiSecret,
                            cancellationToken: CancellationToken.None);
                    }
                    catch
                    {
                        // Ignore destroy failures during teardown.
                    }
                }

                await _client.CloseAsync();
            }
            finally
            {
                _sessionId = 0;
                _handleId = 0;
            }
        }

        private async Task KeepAliveLoopAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested && _sessionId != 0)
            {
                try
                {
                    await Task.Delay(25000, token);
                    if (token.IsCancellationRequested || _sessionId == 0)
                    {
                        break;
                    }

                    await _client.SendRequestAsync(
                        janus: "keepalive",
                        sessionId: _sessionId,
                        token: _config.Token,
                        apisecret: _config.ApiSecret,
                        cancellationToken: token);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
                catch (Exception ex)
                {
                    Fail($"[{_role}] Keepalive failed: {ex.Message}");
                    return;
                }
            }
        }

        private async void OnJanusMessage(string message)
        {
            if (_disposed)
            {
                return;
            }

            try
            {
                if (JanusProtocol.TryGetJsepOffer(message, out var offerSdp))
                {
                    var answerSdp = await _peer.HandleOfferAndCreateAnswerAsync(offerSdp);

                    await _client.SendRequestAsync(
                        janus: "message",
                        sessionId: _sessionId,
                        handleId: _handleId,
                        body: new { request = "start" },
                        jsep: new { type = "answer", sdp = answerSdp },
                        token: _config.Token,
                        apisecret: _config.ApiSecret,
                        cancellationToken: _runCts?.Token ?? CancellationToken.None);
                    return;
                }

                if (JanusProtocol.TryGetRemoteIceCandidate(message, out var candidate, out var sdpMid, out var sdpMLineIndex))
                {
                    _peer.AddRemoteIceCandidate(candidate, sdpMid, sdpMLineIndex);
                    return;
                }

                if (JanusProtocol.TryGetJanusType(message, out var janusType))
                {
                    if (string.Equals(janusType, "error", StringComparison.OrdinalIgnoreCase))
                    {
                        Fail($"[{_role}] Janus error: {JanusProtocol.ExtractErrorReason(message)}");
                        return;
                    }
                }
            }
            catch (Exception ex)
            {
                Fail($"[{_role}] Pipeline message handling failed: {ex.Message}");
            }
        }

        private async void OnLocalIceCandidate(string candidate, string sdpMid, int sdpMLineIndex)
        {
            if (_disposed || _sessionId == 0 || _handleId == 0)
            {
                return;
            }

            try
            {
                await _client.SendRequestAsync(
                    janus: "trickle",
                    sessionId: _sessionId,
                    handleId: _handleId,
                    token: _config.Token,
                    apisecret: _config.ApiSecret,
                    extraFields: new System.Collections.Generic.Dictionary<string, object>
                    {
                        ["candidate"] = new
                        {
                            candidate,
                            sdpMid,
                            sdpMLineIndex,
                        }
                    },
                    cancellationToken: _runCts?.Token ?? CancellationToken.None);
            }
            catch (Exception ex)
            {
                Fail($"[{_role}] Failed to send local ICE candidate: {ex.Message}");
            }
        }

        private void Fail(string message)
        {
            if (_disposed)
            {
                return;
            }

            Failed?.Invoke(_role, message);
        }

        private void ThrowIfDisposed()
        {
            if (_disposed)
            {
                throw new ObjectDisposedException(nameof(JanusStreamPipeline));
            }
        }

        public void Dispose()
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;
            _client.MessageReceived -= OnJanusMessage;
            _peer.LocalIceCandidateReady -= OnLocalIceCandidate;

            _runCts?.Cancel();
            _runCts?.Dispose();

            _peer.Dispose();
            _client.Dispose();
        }
    }
}
