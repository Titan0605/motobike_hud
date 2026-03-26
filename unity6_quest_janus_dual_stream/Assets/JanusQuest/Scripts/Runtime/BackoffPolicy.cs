using System;

namespace JanusQuest.Runtime
{
    public static class BackoffPolicy
    {
        public static int NextDelayMs(int baseMs, int maxMs, int attempt)
        {
            var safeAttempt = Math.Max(1, attempt);
            var exponent = safeAttempt - 1;
            var value = baseMs * Math.Pow(2, exponent);
            return (int)Math.Min(value, maxMs);
        }
    }
}
