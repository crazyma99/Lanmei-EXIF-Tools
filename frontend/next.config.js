/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  output: 'export',
  assetPrefix: '.',
};

module.exports = nextConfig;
