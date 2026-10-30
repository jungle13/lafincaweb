/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/chat_bot',
        destination: '/chat-bot',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
