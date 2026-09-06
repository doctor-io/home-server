import { describe, expect, it } from "vitest";
import {
  choosePairingOrigin,
  isPhoneReachable,
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
    });
  });
});
