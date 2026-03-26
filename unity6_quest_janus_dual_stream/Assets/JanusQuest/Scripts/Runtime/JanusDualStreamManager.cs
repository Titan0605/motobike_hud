using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using JanusQuest.Config;
using JanusQuest.Models;
using Unity.WebRTC;
using UnityEngine;
using UnityEngine.UI;

namespace JanusQuest.Runtime
{
    public sealed class JanusDualStreamManager : MonoBehaviour
    {
        [Header("Config")]
        [SerializeField] private JanusDualStreamConfig _config;

        [Header("Optional Render Targets")]
        [SerializeField] private RawImage _frontTarget;
        [SerializeField] private RawImage _rearTarget;

        [Header("Readonly Runtime State")]
        [SerializeField] private AggregateStatus _aggregateStatus = AggregateStatus.Connecting;

        private readonly Dictionary<StreamRole, JanusStreamPipeline> _pipelines = new();
        private readonly Dictionary<StreamRole, CancellationTokenSource> _pipelineCts = new();
        private readonly Dictionary<StreamRole, Coroutine> _reconnectCoroutines = new();
        private readonly Dictionary<StreamRole, StreamState> _states = new();
        private readonly ConcurrentQueue<Action> _mainThreadActions = new();

        private Coroutine _webrtcUpdateCoroutine;
        private bool _disposed;

        public AggregateStatus Status => _aggregateStatus;
        public StreamState FrontState => _states[StreamRole.Front];
        public StreamState RearState => _states[StreamRole.Rear];

        private void Awake()
        {
            _states[StreamRole.Front] = new StreamState(StreamRole.Front);
            _states[StreamRole.Rear] = new StreamState(StreamRole.Rear);
        }

        private void Start()
        {
            if (_config == null)
            {
                Debug.LogError("JanusDualStreamManager: Missing JanusDualStreamConfig reference.");
                enabled = false;
                return;
            }

            var configError = _config.Validate();
            if (!string.IsNullOrWhiteSpace(configError))
            {
                Debug.LogError($"JanusDualStreamManager: Invalid config: {configError}");
                SetRoleError(StreamRole.Front, configError);
                SetRoleError(StreamRole.Rear, configError);
                RefreshAggregateStatus();
                enabled = false;
                return;
            }

            WebRTC.Initialize();
            _webrtcUpdateCoroutine = StartCoroutine(WebRTC.Update());

            _ = StartRolePipelineAsync(StreamRole.Front);
            _ = StartRolePipelineAsync(StreamRole.Rear);
        }

        private void Update()
        {
            while (_mainThreadActions.TryDequeue(out var action))
            {
                action.Invoke();
            }
        }

        private async Task StartRolePipelineAsync(StreamRole role)
        {
            if (_disposed)
            {
                return;
            }

            if (_reconnectCoroutines.TryGetValue(role, out var reconnectCoroutine) && reconnectCoroutine != null)
            {
                StopCoroutine(reconnectCoroutine);
                _reconnectCoroutines.Remove(role);
            }

            await StopRolePipelineAsync(role);

            var cts = new CancellationTokenSource();
            _pipelineCts[role] = cts;

            var pipeline = new JanusStreamPipeline(role, _config);
            pipeline.RemoteTextureUpdated += OnRemoteTextureUpdated;
            pipeline.Failed += OnPipelineFailed;
            _pipelines[role] = pipeline;

            SetRoleConnecting(role);

            try
            {
                await pipeline.StartAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                // Ignore expected cancellation.
            }
            catch (Exception ex)
            {
                HandlePipelineFailure(role, $"[{role}] Start failed: {ex.Message}");
            }
        }

        private async Task StopRolePipelineAsync(StreamRole role)
        {
            if (_pipelineCts.TryGetValue(role, out var cts))
            {
                cts.Cancel();
                cts.Dispose();
                _pipelineCts.Remove(role);
            }

            if (_pipelines.TryGetValue(role, out var pipeline))
            {
                pipeline.RemoteTextureUpdated -= OnRemoteTextureUpdated;
                pipeline.Failed -= OnPipelineFailed;
                await pipeline.StopAsync();
                pipeline.Dispose();
                _pipelines.Remove(role);
            }
        }

        private void OnRemoteTextureUpdated(StreamRole role, Texture texture)
        {
            _mainThreadActions.Enqueue(() =>
            {
                if (_disposed)
                {
                    return;
                }

                if (role == StreamRole.Front && _frontTarget != null)
                {
                    _frontTarget.texture = texture;
                }
                else if (role == StreamRole.Rear && _rearTarget != null)
                {
                    _rearTarget.texture = texture;
                }

                var state = _states[role];
                state.Status = StreamStatus.Online;
                state.Error = string.Empty;
                state.ReconnectAttempts = 0;
                RefreshAggregateStatus();
            });
        }

        private void OnPipelineFailed(StreamRole role, string error)
        {
            _mainThreadActions.Enqueue(() => { HandlePipelineFailure(role, error); });
        }

        private void HandlePipelineFailure(StreamRole role, string error)
        {
            if (_disposed)
            {
                return;
            }

            SetRoleError(role, error);
            ScheduleReconnect(role);
        }

        private void ScheduleReconnect(StreamRole role)
        {
            if (_disposed)
            {
                return;
            }

            if (_reconnectCoroutines.TryGetValue(role, out var running) && running != null)
            {
                return;
            }

            var state = _states[role];
            state.ReconnectAttempts += 1;
            var delayMs = BackoffPolicy.NextDelayMs(_config.ReconnectBaseMs, _config.ReconnectMaxMs, state.ReconnectAttempts);

            _reconnectCoroutines[role] = StartCoroutine(ReconnectAfterDelay(role, delayMs / 1000f));
        }

        private System.Collections.IEnumerator ReconnectAfterDelay(StreamRole role, float delaySeconds)
        {
            yield return new WaitForSecondsRealtime(delaySeconds);

            _reconnectCoroutines.Remove(role);
            _ = StartRolePipelineAsync(role);
        }

        private void SetRoleConnecting(StreamRole role)
        {
            var state = _states[role];
            state.Status = StreamStatus.Connecting;
            state.Error = string.Empty;
            RefreshAggregateStatus();
        }

        private void SetRoleError(StreamRole role, string error)
        {
            var state = _states[role];
            state.Status = StreamStatus.Error;
            state.Error = error;
            RefreshAggregateStatus();
            Debug.LogWarning(error);
        }

        private void RefreshAggregateStatus()
        {
            var front = _states[StreamRole.Front].Status;
            var rear = _states[StreamRole.Rear].Status;

            if (front == StreamStatus.Online && rear == StreamStatus.Online)
            {
                _aggregateStatus = AggregateStatus.Online;
                return;
            }

            if (front == StreamStatus.Online || rear == StreamStatus.Online)
            {
                _aggregateStatus = AggregateStatus.Partial;
                return;
            }

            if (front == StreamStatus.Error || rear == StreamStatus.Error)
            {
                _aggregateStatus = AggregateStatus.Error;
                return;
            }

            _aggregateStatus = AggregateStatus.Connecting;
        }

        private async void OnDestroy()
        {
            _disposed = true;

            foreach (var reconnect in _reconnectCoroutines.Values)
            {
                if (reconnect != null)
                {
                    StopCoroutine(reconnect);
                }
            }
            _reconnectCoroutines.Clear();

            await StopRolePipelineAsync(StreamRole.Front);
            await StopRolePipelineAsync(StreamRole.Rear);

            if (_webrtcUpdateCoroutine != null)
            {
                StopCoroutine(_webrtcUpdateCoroutine);
                _webrtcUpdateCoroutine = null;
            }

            WebRTC.Dispose();
        }
    }
}
