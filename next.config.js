/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
      ],
    },
  ],
}
module.exports = nextConfig
