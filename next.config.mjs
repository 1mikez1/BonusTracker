/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Suppress 404 errors for static assets in development
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  // Reduce noise from 404s in development
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Suppress warnings about missing modules in development
      config.ignoreWarnings = [
        { module: /node_modules/ },
        { file: /\.next/ },
      ];
    }
    return config;
  },
};

export default nextConfig;
