import type { NextConfig } from "next";

export const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    /** `lucide-react` aqui + Turbopack em dev pode gerar "module factory is not available" em ícones após HMR. */
    optimizePackageImports: ["@neondatabase/neon-js"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Share URLs carry a bearer token in the path: never leak it via Referer.
      { source: "/s/:token*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default nextConfig;
