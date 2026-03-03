import { describe, expect, it } from "vitest"
import {
  convertDockerRunToCompose,
  extractPortFromWebUi,
} from "@/lib/server/modules/store/custom-apps"

describe("custom store app helpers", () => {
  it("converts docker run command to compose content", () => {
    const compose = convertDockerRunToCompose(
      "docker run --name myapp -p 8080:80 -e TZ=UTC -v /data:/config nginx:latest",
      "My App",
    )

    expect(compose).toContain("services:")
    expect(compose).toContain("myapp:")
    expect(compose).toContain("image: 'nginx:latest'")
    expect(compose).toContain("- '8080:80'")
    expect(compose).toContain("- 'TZ=UTC'")
    expect(compose).toContain("- '/data:/config'")
  })

  it("extracts web ui port from multiple formats", () => {
    expect(extractPortFromWebUi("8081")).toBe(8081)
    expect(extractPortFromWebUi("localhost:8123")).toBe(8123)
    expect(extractPortFromWebUi("http://192.168.1.20:9443")).toBe(9443)
    expect(extractPortFromWebUi("https://example.com")).toBeUndefined()
  })

  it("throws on invalid docker run input", () => {
    expect(() =>
      convertDockerRunToCompose("docker pull nginx:latest", "Bad Command"),
    ).toThrow("docker run")
  })

  it("throws on invalid web ui value", () => {
    expect(() => extractPortFromWebUi("invalid host:::")).toThrow("webUi")
    expect(() => extractPortFromWebUi("99999")).toThrow("webUi")
  })
})
