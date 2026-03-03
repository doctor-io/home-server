import { useEffect, useState } from "react";
import type { ContainerStats } from "@/lib/shared/contracts/docker";

/**
 * Hook to subscribe to real-time Docker container stats via SSE
 */
export function useDockerStats() {
  const [stats, setStats] = useState<ContainerStats[]>([]);
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
            const data = JSON.parse(event.data) as ContainerStats[];
            setStats(data);
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
    isConnected,
    error,
  };
}

/**
 * Hook to fetch Docker stats once (non-streaming)
 */
export function useDockerStatsSnapshot() {
  const [stats, setStats] = useState<ContainerStats[]>([]);
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

        const json = await response.json();
        setStats(json.data);
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
    isLoading,
    error,
  };
}
