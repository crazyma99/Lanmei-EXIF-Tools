/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  output: 'export',
  // We don't need rewrites for static export, 
  // but we will serve this from the same origin as Flask so relative paths work.
  async rewrites() {
    return [
      {
        source: '/upload',
        destination: 'http://127.0.0.1:5000/upload',
      },
      {
        source: '/process',
        destination: 'http://127.0.0.1:5000/process',
      },
      {
        source: '/static/:path*',
        destination: 'http://127.0.0.1:5000/static/:path*',
      },
      {
        source: '/download_batch',
        destination: 'http://127.0.0.1:5000/download_batch',
      },
    ];
  },
};

module.exports = nextConfig;
