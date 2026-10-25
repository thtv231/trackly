import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The test server (TRACKLY_TEST=1) builds into its own folder, so it can run next to `npm run dev`.
  distDir: process.env.TRACKLY_TEST === "1" ? ".next-test" : ".next",
  // PGlite loads a .wasm file at runtime: let Node require it instead of bundling it.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
