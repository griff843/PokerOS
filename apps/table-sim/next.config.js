const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@poker-coach/core"],
  webpack: (config) => {
    config.resolve.alias["@poker-coach/core/browser"] = path.resolve(
      __dirname,
      "../../packages/core/src/browser.ts"
    );
    return config;
  },
};

module.exports = nextConfig;
