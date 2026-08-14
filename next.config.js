/** @type {import('next').NextConfig} */

// Permite que o next/image otimize as fotos do carrossel hospedadas no
// Supabase Storage. O hostname é derivado da própria variável de ambiente
// para não ficar valor fixo espalhado pelo código.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: 'https',
            hostname: supabaseHost,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
};

module.exports = nextConfig;
