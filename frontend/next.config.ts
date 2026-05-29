import type { NextConfig } from 'next'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://after-hours-sup5.onrender.com';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  env: {
    NEXT_PUBLIC_BACKEND_URL: 'https://after-hours-sup5.onrender.com',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=*',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/socket.io/:path*',
        destination: `${BACKEND_URL}/socket.io/:path*`,
      },
      {
        source: '/api/backend/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
}

export default nextConfig
