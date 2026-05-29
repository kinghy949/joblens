import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
  /* Allow same-LAN devices to use dev mode resources (HMR, fonts, webpack
   * chunks). Without this, Next 15+ blocks them and the client-side JS
   * never hydrates. Production builds aren't affected. */
  allowedDevOrigins: [
    '192.168.0.0/16',
    '10.0.0.0/8',
    '172.16.0.0/12',
  ],
}

export default nextConfig
