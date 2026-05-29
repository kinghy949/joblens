import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
  /* Allow same-LAN devices to use dev mode resources (HMR, fonts, webpack
   * chunks). Next 15+ blocks them by default and the client-side JS never
   * hydrates without this. Production builds aren't affected.
   *
   * Next only accepts exact hostnames or *.glob wildcards (no CIDR). The
   * 192.168.* wildcard covers the typical /16 LAN allocation; extend if
   * your network uses 10.* or 172.16.*. */
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.16.*.*', 'localhost'],
}

export default nextConfig
