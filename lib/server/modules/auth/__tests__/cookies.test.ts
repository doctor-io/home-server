import { describe, expect, it } from "vitest";
import {
  getExpiredSessionCookieOptions,
  getSessionCookieOptions,
} from "@/lib/server/modules/auth/cookies";

function makeRequest(url: string, forwardedProto?: string): Request {
  const headers: HeadersInit = {};
  if (forwardedProto) headers["x-forwarded-proto"] = forwardedProto;
  return new Request(url, { headers });
}

describe("auth cookies", () => {
  it("uses secure=false for plain http requests", () => {
    const request = makeRequest("http://192.168.1.67/api/auth/login");
    expect(getSessionCookieOptions(new Date(Date.now() + 1_000), request).secure).toBe(false);
    expect(getExpiredSessionCookieOptions(request).secure).toBe(false);
  });

  it("uses secure=true for https requests", () => {
    const request = makeRequest("https://homeio.example.com/api/auth/login");
    expect(getSessionCookieOptions(new Date(Date.now() + 1_000), request).secure).toBe(true);
    expect(getExpiredSessionCookieOptions(request).secure).toBe(true);
  });

  it("uses x-forwarded-proto=https even when request URL is http (behind proxy)", () => {
    const request = makeRequest("http://127.0.0.1:12026/api/auth/login", "https");
    expect(getSessionCookieOptions(new Date(Date.now() + 1_000), request).secure).toBe(true);
    expect(getExpiredSessionCookieOptions(request).secure).toBe(true);
  });

  it("uses x-forwarded-proto=http to override https URL", () => {
    const request = makeRequest("https://example.com/api/auth/login", "http");
    expect(getSessionCookieOptions(new Date(Date.now() + 1_000), request).secure).toBe(false);
    expect(getExpiredSessionCookieOptions(request).secure).toBe(false);
  });
});
