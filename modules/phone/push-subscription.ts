import type { PushConfigPublic } from "@/lib/shared/contracts/push";

/**
 * What the "Notifications on this phone" row should show.
 *
 * Two sides have to agree before a notification can arrive: the server has to
 * be publishing to a topic, and this phone has to be subscribed to that same
 * one. The row exists to make which half is missing obvious, because "push is
 * on and nothing arrives" is the failure nobody can debug from a phone.
 */
export type PhonePushState =
  | { kind: "server-off" }
  | { kind: "off"; url: string; topic: string }
  | { kind: "on"; url: string; topic: string };

export function pushRowState(
  server: PushConfigPublic | null,
  subscribedTopic: string | null,
): PhonePushState {
  if (!server?.enabled || !server.ntfyTopic) return { kind: "server-off" };

  const { ntfyUrl: url, ntfyTopic: topic } = server;

  // Subscribed to *this* topic, not merely to something. A topic the operator
  // rotated leaves the phone listening to an address nothing publishes to any
  // more, and it must read as off — flipping the switch then moves it onto the
  // current one, which is the only way a phone recovers from a rotation.
  return subscribedTopic === topic ? { kind: "on", url, topic } : { kind: "off", url, topic };
}
