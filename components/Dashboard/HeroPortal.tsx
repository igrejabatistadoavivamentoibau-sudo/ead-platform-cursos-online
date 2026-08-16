/* ============================================================
   HERÓI DOS PORTAIS — a mesma abertura em toda a área logada.

   O portal do aluno tem um herói próprio (components/Aluno/InicioVisual),
   porque ali existe um número que é o protagonista: o avanço nos estudos.
   Professor e admin não têm um único número que resuma o dia — têm três
   ou quatro igualmente importantes. Então a peça é a mesma família visual
   (mesmo verde profundo, mesmas luzes, mesma data em dourado), com as
   colunas de número no lugar do anel.

   Manter os dois heróis parecidos é o que faz a plataforma inteira soar
   como uma coisa só quando o admin troca de portal.
   ============================================================ */

export interface NumeroHero {
  valor: string | number
  label: string
  /** Pontinho verde pulsando ao lado do número — para "ativo agora". */
  vivo?: boolean
}

export default function HeroPortal({
  saudacao,
  nome,
  frase,
  numeros = [],
}: {
  /** Abertura antes do nome. Ex.: "Graça e Paz". */
  saudacao: string
  nome: string
  frase: string
  numeros?: NumeroHero[]
}) {
  const hoje = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(115deg,#0a3628,#0f513c_55%,#136247)] p-7 text-white shadow-[0_1px_2px_rgba(5,38,29,0.06),0_24px_48px_-24px_rgba(5,38,29,0.5)] animate-float-in">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_240px_at_85%_-30%,rgba(212,162,76,0.22),transparent_60%),radial-gradient(420px_220px_at_25%_130%,rgba(69,189,138,0.18),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/[0.09]" />

      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0 max-w-xl">
          <p className="micro-rotulo flex items-center gap-2.5 text-[10px] font-bold tracking-[0.18em] text-accent-300">
            {hoje}
            <span className="h-px w-9 bg-gradient-to-r from-accent-300/60 to-transparent" />
          </p>
          <h1 className="mt-2.5 font-display text-[24px] font-bold tracking-[-0.022em]">
            {saudacao}, {nome.split(' ')[0]}
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-white/65">{frase}</p>
        </div>

        {numeros.length > 0 && (
          <div className="flex items-center gap-6">
            {numeros.map((n, i) => (
              <div
                key={n.label}
                className={`text-right ${i < numeros.length - 1 ? 'border-r border-white/[0.12] pr-6' : ''}`}
              >
                <p className="font-display text-[21px] font-bold tracking-[-0.02em]">{n.valor}</p>
                <p className="micro-rotulo flex items-center justify-end gap-1.5 text-[9.5px] font-semibold tracking-[0.14em] text-white/55">
                  {n.vivo && (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-300 animate-soft-pulse" />
                  )}
                  {n.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
