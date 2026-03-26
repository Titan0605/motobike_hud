using JanusQuest.Models;
using UnityEngine;

namespace JanusQuest.Runtime
{
    public sealed class JanusStatusLogger : MonoBehaviour
    {
        [SerializeField] private JanusDualStreamManager _manager;
        [SerializeField] private float _printEverySeconds = 2.0f;

        private float _nextLogTime;

        private void Update()
        {
            if (_manager == null || Time.unscaledTime < _nextLogTime)
            {
                return;
            }

            _nextLogTime = Time.unscaledTime + Mathf.Max(0.5f, _printEverySeconds);

            var front = _manager.FrontState;
            var rear = _manager.RearState;

            Debug.Log(
                $"Janus status => Aggregate: {_manager.Status}, " +
                $"Front: {front.Status} (attempts={front.ReconnectAttempts}) err='{front.Error}', " +
                $"Rear: {rear.Status} (attempts={rear.ReconnectAttempts}) err='{rear.Error}'");
        }
    }
}
