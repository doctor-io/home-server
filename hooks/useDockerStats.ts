import { useEffect, useState } from "react";
import type { ContainerStats, DockerStatsPayload } from "@/lib/shared/contracts/docker";

/**
 * Hook to subscribe to real-time Docker container stats via SSE.
 * Exposes `daemonAvailable` so the UI can distinguish "no containers" from
 * "Docker daemon is unreachable".
 */
export function useDockerStats() {
  const [stats, setStats] = useState<ContainerStats[]>([]);
  const [daemonAvailable, setDaemonAvailable] = useState<boolean | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        eventSource = new EventSource("/api/v1/docker/stats/stream");

        eventSource.addEventListener("stats.updated", (event) => {
          try {
            const payload = JSON.parse(event.data) as DockerStatsPayload;
            setStats(payload.containers);
            setDaemonAvailable(payload.daemonAvailable);
            setError(null);
          } catch (err) {
            console.error("Failed to parse Docker stats:", err);
            setError("Failed to parse stats data");
          }
        });

        eventSource.addEventListener("heartbeat", () => {
          // Keep connection alive
        });

        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          setDaemonAvailable(null); // Reset — connection lost, state unknown
          eventSource?.close();

          // Reconnect after 5 seconds
          reconnectTimeout = setTimeout(() => {
            connect();
          }, 5000);
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  return {
    stats,
    daemonAvailable,
    isConnected,
    error,
  };
}

/**
 * Hook to fetch Docker stats once (non-streaming)
 */
export function useDockerStatsSnapshot() {
  const [stats, setStats] = useState<ContainerStats[]>([]);
  const [daemonAvailable, setDaemonAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/v1/docker/stats");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = (await response.json()) as { data: DockerStatsPayload };
        setStats(json.data.containers);
        setDaemonAvailable(json.data.daemonAvailable);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch stats");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchStats();
  }, []);

  return {
    stats,
    daemonAvailable,
    isLoading,
    error,
  };
}
