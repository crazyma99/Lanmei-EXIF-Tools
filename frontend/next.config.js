/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  output: 'export',
  assetPrefix: '.',
  webpack: (config) => {
    config.resolve.modules.unshift(`${__dirname}/node_modules`);
    return config;
  },
};

module.exports = nextConfig;
