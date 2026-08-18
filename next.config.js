/** @type {import('next').NextConfig} */

// Permite que o next/image otimize as fotos do carrossel hospedadas no
// Supabase Storage. O hostname é derivado da própria variável de ambiente
// para não ficar valor fixo espalhado pelo código.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig = {
  reactStrictMode: true,

  /* ============================================================
     A RAIZ DA "TELA BRANCA SEM DESIGN"

     A cada publicação, os arquivos de estilo e de código ganham nomes
     novos. Se o navegador reaproveitar uma PÁGINA guardada de antes, ela
     vai pedir arquivos que não existem mais — e sobra o texto cru na tela.

     `deploymentId` faz o Next carimbar em cada arquivo a qual publicação
     ele pertence. Com a "Skew Protection" ligada na Vercel (Settings →
     Advanced), a plataforma passa a entregar o arquivo da publicação certa
     mesmo depois de uma nova ter subido — e a tela branca deixa de existir
     na origem, em vez de ser remendada depois.

     Sem a opção ligada lá, esta linha é inofensiva.
     ============================================================ */
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,

  async headers() {
    return [
      {
        /* Nenhuma PÁGINA pode ficar guardada no navegador.
           Os arquivos de estilo e de código (em /_next/static) continuam
           guardados para sempre — eles têm nome único e o conteúdo nunca
           muda. O problema nunca foi guardar esses; foi guardar a página
           que aponta para eles. */
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },

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
