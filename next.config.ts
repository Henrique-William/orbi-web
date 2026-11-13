import type { NextConfig } from 'next';

// Endereço da Orbi API (Spring Boot). O portal chama /api/... e o Next.js repassa para cá,
// então o navegador nunca fala direto com outro domínio (sem problema de CORS).
const ORBI_API_URL = process.env.ORBI_API_URL || 'https://orbi-api-em6s.onrender.com';

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${ORBI_API_URL}/api/:path*` }];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' }
      ]
    }];
  }
};

export default nextConfig;
