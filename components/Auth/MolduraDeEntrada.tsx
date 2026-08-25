import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ShieldCheck, PlayCircle, Award, Users2 } from 'lucide-react'
import type { ReactNode } from 'react'

/* ============================================================
   A MOLDURA DAS TELAS DE ENTRADA

   Esta é a tela de login de sempre — o lado escuro com a marca, os anéis,
   o capelo e a lista de destaques — recortada para fora do arquivo da
   página, sem UMA linha de estilo alterada.

   POR QUE RECORTAR EM VEZ DE COPIAR

   As telas de "esqueci minha senha" e "nova senha" precisam ser a mesma
   tela. Copiar o desenho para dentro delas produziria três lados da marca
   quase iguais: bastaria alguém trocar o capelo ou o texto de rodapé num
   lugar para a plataforma passar a ter duas caras dependendo do caminho
   que a pessoa fez. É a regra deste projeto — evoluir o que existe em vez
   de criar uma segunda versão em paralelo.

   O login continua desenhando exatamente o que desenhava. O que mudou é de
   onde o desenho vem.
   ============================================================ */

const destaques = [
  { icon: PlayCircle, texto: 'Vídeo aulas no seu ritmo' },
  { icon: Users2, texto: 'Turmas acompanhadas de perto' },
  { icon: Award, texto: 'Certificado ao concluir' },
]

export default function MolduraDeEntrada({
  titulo,
  subtitulo,
  tituloCelular,
  subtituloCelular,
  voltar = { href: '/', label: 'Voltar para o início' },
  children,
}: {
  titulo: string
  subtitulo: string
  tituloCelular: string
  subtituloCelular: string
  voltar?: { href: string; label: string }
  children: ReactNode
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr] bg-white">
      {/* ================= LADO DA MARCA ================= */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-brand-950 p-12 xl:p-16">
        {/* Malha de luz e profundidade */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-900 via-brand-950 to-black" />
        <div className="pointer-events-none absolute -top-1/4 -right-1/4 h-[38rem] w-[38rem] rounded-full bg-brand-600/25 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-1/3 -left-1/4 h-[34rem] w-[34rem] rounded-full bg-accent-500/10 blur-[110px]" />

        {/* Grade sutil que dá textura técnica ao fundo */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />

        {/* Anéis concêntricos atrás da logo */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-[26rem] w-[26rem] rounded-full border border-white/[0.06]" />
          <div className="absolute inset-0 m-auto h-[34rem] w-[34rem] rounded-full border border-white/[0.04]" />
          <div className="absolute inset-0 m-auto h-[42rem] w-[42rem] rounded-full border border-white/[0.025]" />
        </div>

        <header className="relative">
          <Link
            href={voltar.href}
            className="group inline-flex items-center gap-2 text-sm font-medium text-brand-100/70 hover:text-white transition-colors"
          >
            <ArrowLeft
              className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
              strokeWidth={2.25}
            />
            {voltar.label}
          </Link>
        </header>

        <div className="relative animate-float-in">
          <Image
            src="/ibau-capelo.webp"
            alt="Escola de Líderes IBAU"
            width={190}
            height={200}
            priority
            className="mb-9 drop-shadow-[0_24px_48px_rgba(0,0,0,0.55)]"
          />

          <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-accent-400 mb-4">
            Igreja Batista do Avivamento
          </p>

          <h1 className="text-[2.7rem] xl:text-[3.1rem] leading-[1.05] font-extrabold text-white mb-5">
            Escola de
            <br />
            <span className="bg-gradient-to-r from-white via-brand-100 to-accent-300 bg-clip-text text-transparent">
              Líderes IBAU
            </span>
          </h1>

          <p className="text-lg text-brand-100/75 leading-relaxed max-w-md">
            Formação bíblica e prática para quem foi chamado a servir e conduzir.
          </p>

          <ul className="mt-10 space-y-3.5">
            {destaques.map((item) => (
              <li key={item.texto} className="flex items-center gap-3.5 text-brand-50/85">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] ring-1 ring-white/10 backdrop-blur-sm">
                  <item.icon className="h-4.5 w-4.5 text-brand-300" strokeWidth={2} />
                </span>
                <span className="text-[15px]">{item.texto}</span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative flex items-center gap-2.5 text-sm text-brand-100/50">
          <ShieldCheck className="h-4 w-4" strokeWidth={2} />
          Ambiente seguro e exclusivo para alunos e professores.
        </footer>
      </aside>

      {/* ================= LADO DO FORMULÁRIO ================= */}
      <main className="relative flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
        {/* Brilho suave no topo, só no celular, para não ficar chapado */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-brand-50/70 to-transparent lg:hidden" />

        <div className="relative w-full max-w-md mx-auto">
          {/* Cabeçalho compacto do celular */}
          <div className="lg:hidden mb-8">
            <Link
              href={voltar.href}
              className="group inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-brand-700 transition-colors mb-7"
            >
              <ArrowLeft
                className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
                strokeWidth={2.25}
              />
              {voltar.label}
            </Link>

            <Image
              src="/ibau-capelo.webp"
              alt="Escola de Líderes IBAU"
              width={82}
              height={86}
              priority
              className="mb-5 drop-shadow-lg"
            />
            <h1 className="font-display text-2xl font-extrabold text-gray-900 leading-tight">
              Escola de Líderes
              <span className="text-brand-600"> IBAU</span>
            </h1>
          </div>

          <div className="hidden lg:block mb-9">
            <h2 className="text-[2rem] font-extrabold text-gray-900 leading-tight mb-2">{titulo}</h2>
            <p className="text-gray-500 text-[15px]">{subtitulo}</p>
          </div>

          <div className="lg:hidden mb-7">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{tituloCelular}</h2>
            <p className="text-gray-500 text-[15px]">{subtituloCelular}</p>
          </div>

          {children}

          <p className="text-center text-sm text-gray-400 mt-9">
            © {new Date().getFullYear()} IBAU — Escola de Líderes
          </p>
        </div>
      </main>
    </div>
  )
}
