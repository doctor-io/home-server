import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is set via NEXT_OUTPUT env var during Docker builds only
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  experimental: {
    // Prevent next.config.mjs from being included in the NFT (Node File Tracing)
    // output, which triggers a "whole project traced" warning from Turbopack.
    outputFileTracingIgnores: ["**/next.config.mjs", "**/next.config.js"],
  },
};

export default nextConfig;
