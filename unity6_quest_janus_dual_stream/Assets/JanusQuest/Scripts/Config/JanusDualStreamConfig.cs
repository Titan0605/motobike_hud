using System;
using UnityEngine;
using JanusQuest.Models;

namespace JanusQuest.Config
{
    [CreateAssetMenu(fileName = "JanusDualStreamConfig", menuName = "Janus Quest/Janus Dual Stream Config")]
    public sealed class JanusDualStreamConfig : ScriptableObject
    {
        [Header("Janus WebSocket URLs")]
        public string FrontJanusWsUrl = "ws://192.168.0.201:8188/janus";
        public string RearJanusWsUrl = "ws://192.168.0.202:8188/janus";

        [Header("Stream IDs")]
        public long FrontStreamId = 99;
        public long RearStreamId = 100;

        [Header("Reconnect")]
        public int ReconnectBaseMs = 1000;
        public int ReconnectMaxMs = 10000;

        [Header("ICE")]
        public string[] IceServers = { "stun:stun.l.google.com:19302" };

        [Header("Optional Janus Auth")]
        public string Token = string.Empty;
        public string ApiSecret = string.Empty;

        public string GetWsUrl(StreamRole role)
        {
            return role == StreamRole.Front ? FrontJanusWsUrl : RearJanusWsUrl;
        }

        public long GetStreamId(StreamRole role)
        {
            return role == StreamRole.Front ? FrontStreamId : RearStreamId;
        }

        public string Validate()
        {
            if (!IsWs(FrontJanusWsUrl))
            {
                return "FrontJanusWsUrl must start with ws:// or wss://";
            }

            if (!IsWs(RearJanusWsUrl))
            {
                return "RearJanusWsUrl must start with ws:// or wss://";
            }

            if (FrontStreamId <= 0 || RearStreamId <= 0)
            {
                return "Stream IDs must be positive numbers.";
            }

            if (ReconnectBaseMs <= 0 || ReconnectMaxMs <= 0 || ReconnectBaseMs > ReconnectMaxMs)
            {
                return "Reconnect values are invalid. Ensure Base > 0, Max > 0 and Base <= Max.";
            }

            return string.Empty;
        }

        private static bool IsWs(string value)
        {
            return value.StartsWith("ws://", StringComparison.OrdinalIgnoreCase) ||
                   value.StartsWith("wss://", StringComparison.OrdinalIgnoreCase);
        }
    }
}
