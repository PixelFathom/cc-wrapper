/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  publicRuntimeConfig: {
    BACKEND_HOST: process.env.NEXT_PUBLIC_BACKEND_HOST || 'http://localhost:8000',
  },
  serverRuntimeConfig: {
    BACKEND_HOST: process.env.BACKEND_HOST || 'http://localhost:8000',
  },
  // Skip type checking and linting during production builds
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig