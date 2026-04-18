"use client";

import type {
  CreateScheduledTaskInput,
  ScheduledTaskRecord,
  UpdateScheduledTaskInput,
} from "@/lib/shared/contracts/scheduled-tasks";
import { queryKeys } from "@/lib/shared/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

async function fetchTasks(): Promise<ScheduledTaskRecord[]> {
  const res = await fetch("/api/v1/scheduled-tasks");
  if (!res.ok) throw new Error("Failed to fetch scheduled tasks");
  const data = await res.json() as { tasks: ScheduledTaskRecord[] };
  return data.tasks;
}

export function useScheduledTasks() {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: queryKeys.scheduledTasks,
    queryFn: fetchTasks,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateScheduledTaskInput) => {
      const res = await fetch("/api/v1/scheduled-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create task");
      const data = await res.json() as { task: ScheduledTaskRecord };
      return data.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledTasks });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateScheduledTaskInput }) => {
      const res = await fetch(`/api/v1/scheduled-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to update task");
      const data = await res.json() as { task: ScheduledTaskRecord };
      return data.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledTasks });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/scheduled-tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledTasks });
    },
  });

  const runNowMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/scheduled-tasks/${id}/run`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to run task");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledTasks });
    },
  });

  return {
    tasks,
    isLoading,
    createTask: createMutation.mutateAsync,
    updateTask: (id: string, input: UpdateScheduledTaskInput) =>
      updateMutation.mutateAsync({ id, input }),
    deleteTask: deleteMutation.mutateAsync,
    runNow: runNowMutation.mutateAsync,
    isRunningNow: runNowMutation.isPending,
  };
}
