using System;

namespace JanusQuest.Models
{
    [Serializable]
    public sealed class StreamState
    {
        public StreamRole Role;
        public StreamStatus Status;
        public string Error;
        public int ReconnectAttempts;

        public StreamState(StreamRole role)
        {
            Role = role;
            Status = StreamStatus.Connecting;
            Error = string.Empty;
            ReconnectAttempts = 0;
        }
    }
}
