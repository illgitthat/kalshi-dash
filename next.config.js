/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    unoptimized: true,
  },
  // Conditionally apply settings for production build (GitHub Pages)
  ...(process.env.NODE_ENV === 'production' ? {
    output: 'export',
    basePath: '/kalshi-dash',
  } : {})
};

module.exports = nextConfig;
