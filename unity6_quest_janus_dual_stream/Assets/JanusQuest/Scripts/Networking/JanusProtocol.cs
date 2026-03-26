using System;
using System.Text.Json;

namespace JanusQuest.Networking
{
    public static class JanusProtocol
    {
        public const string PluginStreaming = "janus.plugin.streaming";

        public static bool TryGetJanusType(string json, out string janusType)
        {
            janusType = string.Empty;
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("janus", out var janusElement))
            {
                return false;
            }

            janusType = janusElement.GetString() ?? string.Empty;
            return !string.IsNullOrWhiteSpace(janusType);
        }

        public static bool TryGetSessionId(string json, out long sessionId)
        {
            sessionId = 0;
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data))
            {
                return false;
            }

            if (!data.TryGetProperty("id", out var id))
            {
                return false;
            }

            return id.TryGetInt64(out sessionId);
        }

        public static bool TryGetHandleId(string json, out long handleId)
        {
            handleId = 0;
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data))
            {
                return false;
            }

            if (!data.TryGetProperty("id", out var id))
            {
                return false;
            }

            return id.TryGetInt64(out handleId);
        }

        public static bool TryGetJsepOffer(string json, out string sdp)
        {
            sdp = string.Empty;
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("jsep", out var jsep))
            {
                return false;
            }

            if (!jsep.TryGetProperty("type", out var typeElement))
            {
                return false;
            }

            var type = typeElement.GetString();
            if (!string.Equals(type, "offer", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (!jsep.TryGetProperty("sdp", out var sdpElement))
            {
                return false;
            }

            sdp = sdpElement.GetString() ?? string.Empty;
            return !string.IsNullOrWhiteSpace(sdp);
        }

        public static bool TryGetRemoteIceCandidate(string json, out string candidate, out string sdpMid, out int sdpMLineIndex)
        {
            candidate = string.Empty;
            sdpMid = string.Empty;
            sdpMLineIndex = 0;

            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("janus", out var janusTypeElement))
            {
                return false;
            }

            var janusType = janusTypeElement.GetString();
            if (!string.Equals(janusType, "trickle", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (!doc.RootElement.TryGetProperty("candidate", out var candidateElement))
            {
                return false;
            }

            if (!candidateElement.TryGetProperty("candidate", out var candidateValue))
            {
                return false;
            }

            candidate = candidateValue.GetString() ?? string.Empty;
            sdpMid = candidateElement.TryGetProperty("sdpMid", out var midElement) ? (midElement.GetString() ?? string.Empty) : string.Empty;
            sdpMLineIndex = candidateElement.TryGetProperty("sdpMLineIndex", out var indexElement) && indexElement.TryGetInt32(out var index)
                ? index
                : 0;

            return !string.IsNullOrWhiteSpace(candidate);
        }

        public static string ExtractErrorReason(string json)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("error", out var error))
                {
                    if (error.TryGetProperty("reason", out var reason))
                    {
                        return reason.GetString() ?? "Unknown Janus error";
                    }

                    if (error.TryGetProperty("code", out var code))
                    {
                        return $"Janus error code: {code.GetInt32()}";
                    }
                }

                return "Unknown Janus error";
            }
            catch
            {
                return "Invalid Janus error payload";
            }
        }

        public static bool IsAck(string json)
        {
            return TryGetJanusType(json, out var janusType) &&
                   string.Equals(janusType, "ack", StringComparison.OrdinalIgnoreCase);
        }
    }
}
