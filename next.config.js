const path = require("path");
const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

module.exports = (phase) => {
  const isDevelopmentServer = phase === PHASE_DEVELOPMENT_SERVER;

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    distDir: isDevelopmentServer ? ".next-dev" : ".next",
    outputFileTracingRoot: path.resolve(__dirname),
    webpack: (config, { isServer }) => {
      if (isServer) {
        config.module.rules.push({
          test: /\.dat$/,
          type: "asset/resource",
          generator: {
            filename: "data/[name][ext]",
          },
        });
      }

      return config;
    },
  };

  return nextConfig;
};
