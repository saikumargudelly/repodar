export interface OperationalMetrics {
  authFailures: number;
  validationFailures: number;
  duplicateRequests: number;
  networkErrors: number;
  latencies: Record<string, number[]>;
}

export const metrics: OperationalMetrics = {
  authFailures: 0,
  validationFailures: 0,
  duplicateRequests: 0,
  networkErrors: 0,
  latencies: {},
};

export const recordAuthFailure = () => {
  metrics.authFailures++;
};

export const recordValidationFailure = () => {
  metrics.validationFailures++;
};

export const recordDuplicateRequest = () => {
  metrics.duplicateRequests++;
};

export const recordNetworkError = () => {
  metrics.networkErrors++;
};

export const recordLatency = (path: string, latencyMs: number) => {
  if (!metrics.latencies[path]) {
    metrics.latencies[path] = [];
  }
  const pathLatencies = metrics.latencies[path];
  pathLatencies.push(latencyMs);
  if (pathLatencies.length > 50) {
    pathLatencies.shift();
  }
};

if (typeof window !== "undefined") {
  (window as any).__repodar_metrics = {
    getSummary: () => {
      const avgLatencies: Record<string, string> = {};
      for (const [path, list] of Object.entries(metrics.latencies)) {
        if (list.length > 0) {
          const sum = list.reduce((a, b) => a + b, 0);
          avgLatencies[path] = `${(sum / list.length).toFixed(1)}ms`;
        }
      }
      return {
        authFailures: metrics.authFailures,
        validationFailures: metrics.validationFailures,
        duplicateRequests: metrics.duplicateRequests,
        networkErrors: metrics.networkErrors,
        averageLatencies: avgLatencies,
      };
    },
    raw: metrics,
  };
}
