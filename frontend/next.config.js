/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  output: 'export',
  assetPrefix: '.',
  webpack: (config) => {
    const path = require('path');
    config.resolve.modules.unshift(path.resolve(__dirname, 'node_modules'));
    return config;
  },
};

module.exports = nextConfig;
