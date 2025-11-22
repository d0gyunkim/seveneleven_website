/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'www.7-eleven.co.kr',
        pathname: '/upload/**',
      },
      {
        protocol: 'https',
        hostname: 'www.7-eleven.co.kr',
        pathname: '/upload/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig

