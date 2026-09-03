/**
 * Validation shared by the settings API and the card that feeds it, so the
 * message the operator reads and the rule the server enforces cannot drift.
 */

/** ntfy's own rule for a topic name. */
const TOPIC_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * On a public instance the topic **is** the credential: anyone who knows it
 * reads every notification this server sends, and can publish fakes into it.
 * So a topic is not a name to be pretty, it is a secret to be unguessable.
 */
const GENERATED_TOPIC_ENTROPY_BYTES = 16;
const GENERATED_TOPIC_LENGTH = "homeio-".length + GENERATED_TOPIC_ENTROPY_BYTES;

export function validateNtfyTopic(topic: string): string | null {
  if (!topic) return "Enter a topic";
  if (!TOPIC_PATTERN.test(topic)) {
    return "Use letters, numbers, dashes and underscores (max 64)";
  }
  return null;
}

/**
 * A short or dictionary topic on ntfy.sh is readable by anyone who guesses it,
 * and nothing in the protocol will ever tell the operator that happened — so
 * the warning has to come from here, at the moment they type one.
 *
 * Length is a blunt proxy for entropy, and deliberately so: "my-server-alerts"
 * is sixteen characters of guessable English, while a generated topic is
 * twenty-three. Anything under that reads as hand-chosen and gets the warning.
 */
export function isGuessableTopic(topic: string): boolean {
  return topic.length < GENERATED_TOPIC_LENGTH;
}

/** `homeio-` plus 128 bits, base32-ish so it survives a URL and a QR. */
export function generateNtfyTopic(): string {
  const bytes = new Uint8Array(GENERATED_TOPIC_ENTROPY_BYTES);
  crypto.getRandomValues(bytes);

  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let suffix = "";
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];

  return `homeio-${suffix}`;
}

/**
 * Returns the origin to POST to, or null when the input is not something the
 * server can reach. Trailing slashes go: the topic travels in the body, so the
 * URL is an origin and nothing more.
 */
export function normalizeNtfyUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  // A self-hosted ntfy on a LAN is plain http more often than not, so http is
  // allowed — but anything that is not a web request (file:, javascript:) is
  // not a push server, it is a mistake or an attempt at one.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}
