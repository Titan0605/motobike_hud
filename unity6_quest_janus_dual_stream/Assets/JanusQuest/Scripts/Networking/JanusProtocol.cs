using System;

namespace JanusQuest.Networking
{
    public static class JanusProtocol
    {
        public const string PluginStreaming = "janus.plugin.streaming";

        public static bool TryGetJanusType(string json, out string janusType)
        {
            return JanusJson.TryGetString(json, "janus", out janusType) && !string.IsNullOrWhiteSpace(janusType);
        }

        public static bool TryGetSessionId(string json, out long sessionId)
        {
            sessionId = 0;
            return JanusJson.TryGetObject(json, "data", out var dataJson) && JanusJson.TryGetLong(dataJson, "id", out sessionId);
        }

        public static bool TryGetHandleId(string json, out long handleId)
        {
            handleId = 0;
            return JanusJson.TryGetObject(json, "data", out var dataJson) && JanusJson.TryGetLong(dataJson, "id", out handleId);
        }

        public static bool TryGetJsepOffer(string json, out string sdp)
        {
            sdp = string.Empty;

            if (!JanusJson.TryGetObject(json, "jsep", out var jsepJson))
            {
                return false;
            }

            if (!JanusJson.TryGetString(jsepJson, "type", out var type))
            {
                return false;
            }

            if (!string.Equals(type, "offer", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (!JanusJson.TryGetString(jsepJson, "sdp", out sdp))
            {
                return false;
            }

            return !string.IsNullOrWhiteSpace(sdp);
        }

        public static bool TryGetRemoteIceCandidate(string json, out string candidate, out string sdpMid, out int sdpMLineIndex)
        {
            candidate = string.Empty;
            sdpMid = string.Empty;
            sdpMLineIndex = 0;

            if (!JanusJson.TryGetString(json, "janus", out var janusType))
            {
                return false;
            }

            if (!string.Equals(janusType, "trickle", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (!JanusJson.TryGetObject(json, "candidate", out var candidateJson))
            {
                return false;
            }

            if (!JanusJson.TryGetString(candidateJson, "candidate", out candidate))
            {
                return false;
            }

            JanusJson.TryGetString(candidateJson, "sdpMid", out sdpMid);
            JanusJson.TryGetInt(candidateJson, "sdpMLineIndex", out sdpMLineIndex);

            return !string.IsNullOrWhiteSpace(candidate);
        }

        public static string ExtractErrorReason(string json)
        {
            if (JanusJson.TryGetObject(json, "error", out var errorJson))
            {
                if (JanusJson.TryGetString(errorJson, "reason", out var reason) && !string.IsNullOrWhiteSpace(reason))
                {
                    return reason;
                }

                if (JanusJson.TryGetInt(errorJson, "code", out var code))
                {
                    return $"Janus error code: {code}";
                }
            }

            return "Unknown Janus error";
        }

        public static bool IsAck(string json)
        {
            return TryGetJanusType(json, out var janusType) &&
                   string.Equals(janusType, "ack", StringComparison.OrdinalIgnoreCase);
        }
    }
}
