import { describe, expect, it } from "vitest";
import {
  choosePairingOrigin,
  isPhoneReachable,
  requestOrigin,
  tailnetOrigin,
} from "@/lib/server/modules/auth/pairing-origin";

describe("isPhoneReachable", () => {
  it("rejects every way of naming this machine", () => {
    // On a phone, all of these are the phone.
    for (const origin of [
      "http://localhost:3000",
      "http://127.0.0.1",
      "http://0.0.0.0:3000",
      "http://[::1]:3000",
      "https://LOCALHOST",
    ]) {
      expect(isPhoneReachable(origin)).toBe(false);
    }
  });

  it("accepts an address another device could dial", () => {
    expect(isPhoneReachable("http://192.168.1.43")).toBe(true);
    expect(isPhoneReachable("http://homeio.tail1234.ts.net")).toBe(true);
    expect(isPhoneReachable("https://homeio.example.com")).toBe(true);
  });

  it("rejects an mDNS name, which resolves here and not on Android", () => {
    // The QR then works on the machine that made it and fails on the phone it
    // was made for, which is the whole failure this module exists to prevent.
    expect(isPhoneReachable("http://homeio.local")).toBe(false);
    expect(isPhoneReachable("http://Homeio.LOCAL:8080")).toBe(false);
  });
});

describe("tailnetOrigin", () => {
  it("drops the trailing dot tailscale reports", () => {
    expect(tailnetOrigin("http://localhost:3000", "homeio.tail1234.ts.net.")).toBe(
      "http://homeio.tail1234.ts.net",
    );
  });

  it("drops port 3000, because the phone reaches nginx on 80", () => {
    // 3000 is where Homeio listens when run directly, and the installer proxies
    // it. The app tries 80 then 3000 for a portless address, so leaving the port
    // off covers both — and carrying 3000 over covers only the rarer one.
    expect(tailnetOrigin("http://localhost:3000", "homeio.tail1234.ts.net")).toBe(
      "http://homeio.tail1234.ts.net",
    );
  });

  it("keeps a port that was somebody's decision", () => {
    expect(tailnetOrigin("http://localhost:8080", "homeio.tail1234.ts.net")).toBe(
      "http://homeio.tail1234.ts.net:8080",
    );
  });

  it("has nothing to offer without a tailnet", () => {
    expect(tailnetOrigin("http://localhost:3000", null)).toBeNull();
    expect(tailnetOrigin("http://localhost:3000", "  ")).toBeNull();
  });
});

describe("choosePairingOrigin", () => {
  it("leaves a working address alone, tailnet or not", () => {
    // Guessing a public hostname server-side gets it wrong behind a tunnel, so
    // the browser's own address wins whenever it can work at all.
    expect(choosePairingOrigin("https://homeio.example.com", "homeio.tail1234.ts.net")).toEqual({
      origin: "https://homeio.example.com",
      reachable: true,
    });
  });

  it("swaps a loopback address for the tailnet name", () => {
    expect(choosePairingOrigin("http://localhost:3000", "homeio.tail1234.ts.net.")).toEqual({
      origin: "http://homeio.tail1234.ts.net",
      reachable: true,
    });
  });

  it("says so when there is nothing better than localhost", () => {
    // The code is still issued — the operator may be about to fix their setup —
    // but the card has to be able to say why scanning it will do nothing.
    expect(choosePairingOrigin("http://localhost:3000", null)).toEqual({
      origin: "http://localhost:3000",
      reachable: false,
      reason: "loopback",
    });
  });
});

describe("choosePairingOrigin, mDNS", () => {
  it("swaps an mDNS name for the tailnet name", () => {
    expect(choosePairingOrigin("http://homeio.local", "homeio.tail1234.ts.net")).toEqual({
      origin: "http://homeio.tail1234.ts.net",
      reachable: true,
    });
  });

  it("reports why, so the card can say something specific", () => {
    expect(choosePairingOrigin("http://homeio.local", null)).toEqual({
      origin: "http://homeio.local",
      reachable: false,
      reason: "mdns",
    });
    expect(choosePairingOrigin("http://localhost:3000", null).reason).toBe("loopback");
  });
});

describe("requestOrigin", () => {
  function requestWith(headers: Record<string, string>) {
    return new Request("http://localhost:3000/api/v1/auth/pairing", { headers });
  }

  it("uses the host the browser asked for, not the bind address", () => {
    expect(requestOrigin(requestWith({ host: "homeio.example.com" }))).toBe(
      "http://homeio.example.com",
    );
  });

  it("believes x-forwarded-proto first", () => {
    expect(
      requestOrigin(requestWith({ host: "homeio.example.com", "x-forwarded-proto": "https" })),
    ).toBe("https://homeio.example.com");
  });

  it("falls back to CF-Visitor, which is what survives a tunnel", () => {
    // Cloudflare ends the TLS and speaks plain HTTP to the origin, so a proxy
    // that forwards $scheme reports http for an https server — and the QR then
    // tells the phone to use http.
    expect(
      requestOrigin(
        requestWith({ host: "homeio.example.com", "cf-visitor": '{"scheme":"https"}' }),
      ),
    ).toBe("https://homeio.example.com");
  });

  it("accepts the older spellings, and ignores a cf-visitor that is not JSON", () => {
    expect(
      requestOrigin(requestWith({ host: "h.example.com", "x-forwarded-ssl": "on" })),
    ).toBe("https://h.example.com");
    expect(
      requestOrigin(requestWith({ host: "h.example.com", "front-end-https": "On" })),
    ).toBe("https://h.example.com");
    expect(requestOrigin(requestWith({ host: "h.example.com", "cf-visitor": "nonsense" }))).toBe(
      "http://h.example.com",
    );
  });

  it("takes the first value when a chain of proxies has appended its own", () => {
    expect(
      requestOrigin(
        requestWith({
          "x-forwarded-host": "homeio.example.com, internal",
          "x-forwarded-proto": "https, http",
        }),
      ),
    ).toBe("https://homeio.example.com");
  });
});
