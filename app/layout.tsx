import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Escola de Líderes IBAU",
  description: "Plataforma de ensino para a Escola de Líderes da Igreja Batista da Avivamento IBAU",
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col bg-white text-gray-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
