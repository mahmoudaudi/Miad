/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // All optimized sources are immutable local files, so the optimizer
    // output can live long in caches (default is 60s must-revalidate).
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [
      {
        // Landing imagery filenames are content-stable and fully owned —
        // safe for long-lived immutable caching (previously max-age=0).
        source: '/landing/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
