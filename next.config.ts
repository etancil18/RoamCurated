import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizeCss: true,
  },
  outputFileTracingRoot: path.join(__dirname), // ✅ added to fix workspace root issue
}

export default nextConfig
