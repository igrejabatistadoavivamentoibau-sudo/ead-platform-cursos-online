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
    remotePatterns: [
      // Fotos do carrossel, hospedadas no Supabase Storage
      ...(supabaseHost
        ? [
            {
              protocol: 'https',
              hostname: supabaseHost,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
      // Miniaturas das vídeo aulas do YouTube (os dois domínios que o
      // YouTube usa para servir capa de vídeo).
      { protocol: 'https', hostname: 'img.youtube.com', pathname: '/vi/**' },
      { protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**' },
    ],
  },
};

module.exports = nextConfig;
