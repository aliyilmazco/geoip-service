/** @type {import('next').NextConfig} */
const nextConfig = {
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

module.exports = nextConfig;
