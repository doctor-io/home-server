import { describe, expect, it } from "vitest";
import {
  generateNtfyTopic,
  isGuessableTopic,
  normalizeNtfyUrl,
  validateNtfyTopic,
} from "@/lib/shared/push";

describe("validateNtfyTopic", () => {
  it("accepts what ntfy accepts", () => {
    expect(validateNtfyTopic("homeio-alerts_2")).toBeNull();
  });

  it("rejects an empty topic, a spaced one, and one over 64 characters", () => {
    expect(validateNtfyTopic("")).toBe("Enter a topic");
    expect(validateNtfyTopic("my alerts")).not.toBeNull();
    expect(validateNtfyTopic("a".repeat(65))).not.toBeNull();
    expect(validateNtfyTopic("a".repeat(64))).toBeNull();
  });

  it("rejects a slash, which would silently change the URL the phone subscribes to", () => {
    expect(validateNtfyTopic("homeio/alerts")).not.toBeNull();
  });
});

describe("isGuessableTopic", () => {
  it("flags the topic somebody types by hand", () => {
    // On ntfy.sh the topic is the only thing standing between a stranger and
    // every alert this server sends, and nothing will ever report that it leaked.
    expect(isGuessableTopic("homeio")).toBe(true);
    expect(isGuessableTopic("my-server-alerts")).toBe(true);
  });

  it("does not flag a generated one", () => {
    expect(isGuessableTopic(generateNtfyTopic())).toBe(false);
  });
});

describe("generateNtfyTopic", () => {
  it("is a valid topic that is not worth guessing", () => {
    const topic = generateNtfyTopic();

    expect(validateNtfyTopic(topic)).toBeNull();
    expect(topic.startsWith("homeio-")).toBe(true);
    expect(topic.length).toBe("homeio-".length + 16);
  });

  it("does not repeat", () => {
    const topics = new Set(Array.from({ length: 50 }, () => generateNtfyTopic()));
    expect(topics.size).toBe(50);
  });
});

describe("normalizeNtfyUrl", () => {
  it("keeps an origin and drops trailing slashes", () => {
    expect(normalizeNtfyUrl(" https://ntfy.sh/ ")).toBe("https://ntfy.sh");
    expect(normalizeNtfyUrl("https://ntfy.sh")).toBe("https://ntfy.sh");
  });

  it("keeps a port and a subpath, which a reverse-proxied instance needs", () => {
    expect(normalizeNtfyUrl("http://192.168.1.10:8080")).toBe("http://192.168.1.10:8080");
    expect(normalizeNtfyUrl("https://home.example.com/ntfy/")).toBe(
      "https://home.example.com/ntfy",
    );
  });

  it("allows plain http, because a self-hosted ntfy on a LAN usually is", () => {
    expect(normalizeNtfyUrl("http://nas.local")).toBe("http://nas.local");
  });

  it("refuses anything that is not a web request", () => {
    expect(normalizeNtfyUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeNtfyUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeNtfyUrl("ntfy.sh")).toBeNull();
    expect(normalizeNtfyUrl("")).toBeNull();
  });
});
