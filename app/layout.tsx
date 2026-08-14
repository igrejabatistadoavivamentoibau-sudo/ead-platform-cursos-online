import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

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
      <body className="min-h-full flex flex-col bg-white text-gray-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
