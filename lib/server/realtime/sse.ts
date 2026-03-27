import "server-only";

export function toSseChunk(
  event: string,
  payload: unknown,
  options?: { id?: string },
): string {
  const lines = [options?.id ? `id: ${options.id}` : null].filter(
    (line): line is string => Boolean(line),
  );

  lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(payload)}`);

  return `${lines.join("\n")}\n\n`;
}
