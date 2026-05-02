// Simple metrics collector to simulate Prometheus metrics
const metrics = {
  conversation_latency_ms: [],
  brain_response_errors_total: 0,
  tts_fallback_count: 0,
};

export const getMetrics = () => ({
  ...metrics,
  conversation_latency_ms_p95: calculateP95(metrics.conversation_latency_ms),
});

const calculateP95 = (values) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.95);
  return sorted[index];
};

export const recordLatency = (ms) => {
  metrics.conversation_latency_ms.push(ms);
  // Keep only last 1000 measurements
  if (metrics.conversation_latency_ms.length > 1000) {
    metrics.conversation_latency_ms.shift();
  }
};

export const recordError = () => {
  metrics.brain_response_errors_total++;
};

export const recordTTSFallback = () => {
  metrics.tts_fallback_count++;
};
