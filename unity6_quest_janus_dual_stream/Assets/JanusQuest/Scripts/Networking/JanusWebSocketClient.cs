using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace JanusQuest.Networking
{
    public sealed class JanusWebSocketClient : IDisposable
    {
        private readonly ConcurrentDictionary<string, TaskCompletionSource<string>> _pendingTransactions = new();
        private readonly CancellationTokenSource _disposeCts = new();

        private ClientWebSocket _socket;
        private CancellationTokenSource _receiveLoopCts;
        private Task _receiveLoopTask;

        public event Action<string> MessageReceived;

        public bool IsConnected => _socket != null && _socket.State == WebSocketState.Open;

        public async Task ConnectAsync(string url, CancellationToken cancellationToken)
        {
            if (IsConnected)
            {
                return;
            }

            _socket = new ClientWebSocket();
            _receiveLoopCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCts.Token);
            await _socket.ConnectAsync(new Uri(url), cancellationToken);
            _receiveLoopTask = Task.Run(() => ReceiveLoopAsync(_receiveLoopCts.Token), _receiveLoopCts.Token);
        }

        public async Task<string> SendRequestAsync(
            string janus,
            long? sessionId = null,
            long? handleId = null,
            object body = null,
            object jsep = null,
            string token = null,
            string apisecret = null,
            Dictionary<string, object> extraFields = null,
            CancellationToken cancellationToken = default)
        {
            if (!IsConnected)
            {
                throw new InvalidOperationException("Janus socket is not connected.");
            }

            var transaction = Guid.NewGuid().ToString("N");
            var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
            _pendingTransactions[transaction] = tcs;

            var payload = new Dictionary<string, object>
            {
                ["janus"] = janus,
                ["transaction"] = transaction,
            };

            if (sessionId.HasValue)
            {
                payload["session_id"] = sessionId.Value;
            }

            if (handleId.HasValue)
            {
                payload["handle_id"] = handleId.Value;
            }

            if (body != null)
            {
                payload["body"] = body;
            }

            if (jsep != null)
            {
                payload["jsep"] = jsep;
            }

            if (!string.IsNullOrWhiteSpace(token))
            {
                payload["token"] = token;
            }

            if (!string.IsNullOrWhiteSpace(apisecret))
            {
                payload["apisecret"] = apisecret;
            }

            if (extraFields != null)
            {
                foreach (var pair in extraFields)
                {
                    payload[pair.Key] = pair.Value;
                }
            }

            var json = JanusJson.Serialize(payload);
            await SendRawAsync(json, cancellationToken);

            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCts.Token);
            using (linked.Token.Register(() => tcs.TrySetCanceled(linked.Token)))
            {
                try
                {
                    return await tcs.Task;
                }
                finally
                {
                    _pendingTransactions.TryRemove(transaction, out _);
                }
            }
        }

        public async Task SendRawAsync(string json, CancellationToken cancellationToken)
        {
            if (!IsConnected)
            {
                throw new InvalidOperationException("Janus socket is not connected.");
            }

            var bytes = Encoding.UTF8.GetBytes(json);
            await _socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cancellationToken);
        }

        public async Task CloseAsync()
        {
            if (_receiveLoopCts != null && !_receiveLoopCts.IsCancellationRequested)
            {
                _receiveLoopCts.Cancel();
            }

            if (_socket != null)
            {
                if (_socket.State == WebSocketState.Open)
                {
                    await _socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Janus client shutdown", CancellationToken.None);
                }
                _socket.Dispose();
                _socket = null;
            }

            if (_receiveLoopTask != null)
            {
                try
                {
                    await _receiveLoopTask;
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"Janus receive loop ended with exception: {ex.Message}");
                }
                _receiveLoopTask = null;
            }
        }

        private async Task ReceiveLoopAsync(CancellationToken cancellationToken)
        {
            var buffer = new byte[8192];

            while (!cancellationToken.IsCancellationRequested && IsConnected)
            {
                var builder = new StringBuilder();
                WebSocketReceiveResult result;

                do
                {
                    result = await _socket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        return;
                    }

                    var chunk = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    builder.Append(chunk);
                }
                while (!result.EndOfMessage);

                var message = builder.ToString();
                if (string.IsNullOrWhiteSpace(message))
                {
                    continue;
                }

                RouteMessage(message);
            }
        }

        private void RouteMessage(string message)
        {
            if (JanusJson.TryGetString(message, "transaction", out var transaction))
            {
                if (!string.IsNullOrWhiteSpace(transaction) && _pendingTransactions.TryGetValue(transaction, out var tcs))
                {
                    tcs.TrySetResult(message);
                    return;
                }
            }

            MessageReceived?.Invoke(message);
        }

        public void Dispose()
        {
            _disposeCts.Cancel();
            _receiveLoopCts?.Cancel();
            _socket?.Dispose();

            foreach (var pending in _pendingTransactions.Values)
            {
                pending.TrySetCanceled();
            }
            _pendingTransactions.Clear();

            _receiveLoopCts?.Dispose();
            _disposeCts.Dispose();
        }
    }
}
