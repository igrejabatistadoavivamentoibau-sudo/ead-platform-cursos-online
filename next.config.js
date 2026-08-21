/** @type {import('next').NextConfig} */

// Permite que o next/image otimize as fotos do carrossel hospedadas no
// Supabase Storage. O hostname é derivado da própria variável de ambiente
// para não ficar valor fixo espalhado pelo código.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig = {
  reactStrictMode: true,

  experimental: {
    /* ============================================================
       IR E VOLTAR ENTRE DUAS TELAS NÃO PODE CUSTAR DUAS VIAGENS

       O navegador guarda por um tempo o conteúdo das telas por onde a
       pessoa passou. O padrão eram 30 segundos — curto demais para o uso
       real: o professor abre Notas, confere uma coisa em Atividades, volta
       para Notas, e essa volta já custava uma ida inteira ao servidor, com
       a tela parada de novo.

       Dois minutos cobrem o vaivém de quem está trabalhando numa turma. E
       não cria dado velho no lugar errado: toda tela que GRAVA alguma
       coisa manda a plataforma buscar de novo (`router.refresh()` e
       `revalidatePath`), e isso apaga essa memória na hora. O que fica
       guardado é só tela em que ninguém mexeu.
       ============================================================ */
    staleTimes: {
      dynamic: 120,
      static: 300,
    },
  },

  /* ============================================================
     POR QUE NÃO USAMOS `deploymentId` AQUI

     Existia nesta linha um `deploymentId`. Ele carimba em cada arquivo a
     qual publicação ele pertence, e serve para UMA coisa só: permitir que
     a hospedagem entregue o arquivo da publicação certa. Só que isso
     depende de uma chave ligada à mão no painel da Vercel. Fora isso, o
     carimbo é ignorado — e cobra caro: troca o ENDEREÇO de todos os
     arquivos a cada publicação, obrigando quem já usava a plataforma a
     baixar tudo de novo, inclusive o que não mudou.

     Sem o carimbo, o nome de cada arquivo é o resumo do próprio conteúdo.
     O que não mudou continua com o mesmo nome e continua valendo. E o que
     protege a aula aberta durante a publicação é o cofre (public/sw.js),
     que funciona em qualquer hospedagem e não depende de painel nenhum.
     ============================================================ */

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
