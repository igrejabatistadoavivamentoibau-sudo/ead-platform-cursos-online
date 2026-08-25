import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
// As caligrafias da assinatura eletrônica. Vêm empacotadas com o site em
// vez de virem do Google: fonte que depende da internet do aluno é fonte
// que um dia não chega, e a assinatura sairia em letra de forma.
import "@fontsource/great-vibes";
import "@fontsource/dancing-script";
import "./globals.css";
import { GUARDIAO_DA_TELA } from "@/lib/guardiaoDaTela";
import { PORTEIRO_DO_LINK } from "@/lib/porteiroDoLink";
import AbreOCofre from "@/components/Sistema/AbreOCofre";

export const metadata: Metadata = {
  title: "Escola de Líderes IBAU",
  description: "Plataforma de ensino para a Escola de Líderes da Igreja Batista do Avivamento — IBAU",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Escola IBAU",
    statusBarStyle: "black-translucent",
  },
};

/* ============================================================
   A PLATAFORMA NO CELULAR

   `viewportFit: 'cover'` mais o `safe-area` no CSS: sem isso, num iPhone
   com entalhe, a barra de baixo do sistema come o rodapé da tela — e é
   sempre o botão de enviar que fica embaixo dela.

   `maximumScale` NÃO é limitado de propósito. Travar o zoom é a maneira
   mais rápida de deixar a plataforma inutilizável para quem enxerga mal, e
   numa escola de igreja isso é boa parte das pessoas. O preço de deixar
   livre é o iOS dar zoom sozinho ao focar um campo com fonte menor que
   16px — resolvido no CSS, aumentando a fonte dos campos no celular, e não
   proibindo o zoom.

   `themeColor` pinta a barra do navegador com o verde da marca quando a
   plataforma é aberta ou instalada no telefone.
   ============================================================ */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05261d",
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="pt-BR" className="h-full scroll-smooth">
      <head>
        {/*
          O guardião da tela vem ANTES de tudo — antes do estilo, antes de
          qualquer outro script. É a única posição em que ele consegue ver a
          falha do arquivo de estilo acontecer. Ver lib/guardiaoDaTela.ts.
        */}
        <script dangerouslySetInnerHTML={{ __html: GUARDIAO_DA_TELA }} />
        {/*
          O PORTEIRO DO LINK DE RECUPERAÇÃO.
          Reconhece, em QUALQUER página, o retorno do link de "esqueci minha
          senha", tira a chave da barra de endereço e leva a pessoa para a
          tela de nova senha. Precisa rodar antes de qualquer módulo carregar,
          senão o cliente do Supabase consome o endereço primeiro e não sobra
          nada para a tela. Ver lib/porteiroDoLink.ts.
        */}
        <script dangerouslySetInnerHTML={{ __html: PORTEIRO_DO_LINK }} />
      </head>
      <body className="min-h-full flex flex-col bg-white text-gray-900 font-sans antialiased">
        {/*
          A SENTINELA DO ESTILO.
          Se o nosso estilo carregou, a classe `hidden` a esconde. Se ela
          aparecer na tela, é prova de que o estilo não veio — e o guardião
          recarrega a página. É a diferença entre torcer para o estilo ter
          carregado e CONFERIR que carregou.
        */}
        <span id="ibau-sentinela-estilo" className="hidden" aria-hidden="true" />
        {/*
          O COFRE DOS ARQUIVOS.
          Guarda no aparelho do aluno uma cópia de cada arquivo de código e
          de estilo. Quando publicamos uma versão nova e os arquivos antigos
          deixam de existir no servidor, quem está com a página aberta
          continua sendo atendido pela cópia — a aula não desmonta no meio.
          Ver public/sw.js e components/Sistema/AbreOCofre.tsx.
        */}
        <AbreOCofre />
        {children}
      </body>
    </html>
  );
}
