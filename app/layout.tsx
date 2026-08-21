import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { GUARDIAO_DA_TELA } from "@/lib/guardiaoDaTela";
import AbreOCofre from "@/components/Sistema/AbreOCofre";

export const metadata: Metadata = {
  title: "Escola de Líderes IBAU",
  description: "Plataforma de ensino para a Escola de Líderes da Igreja Batista do Avivamento — IBAU",
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
