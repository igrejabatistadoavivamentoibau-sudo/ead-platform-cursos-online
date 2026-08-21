/* ============================================================
   O ESQUELETO DA TELA

   POR QUE ISTO EXISTE
   Não havia nenhum `loading.tsx` na plataforma. Sem ele, o Next segura a
   navegação inteira no servidor: a pessoa clica em "Notas" e a tela
   ANTERIOR fica parada na frente dela, sem nada acontecer, até o servidor
   terminar de montar a nova. Numa conexão de celular isso dá um segundo,
   dois — tempo mais que suficiente para achar que o clique não pegou e
   clicar de novo.

   Com um `loading.tsx`, o Next manda este desenho na hora e preenche o
   conteúdo quando ele chega. O clique responde no mesmo instante. Não
   ficou mais rápido: ficou honesto — e a sensação de velocidade vem daí,
   não dos milissegundos.

   POR QUE O DESENHO IMITA A TELA DE VERDADE
   Um rodopio no meio da tela não conta nada e ainda faz o conteúdo
   "pular" quando chega, porque nada estava no lugar. Blocos do tamanho
   aproximado do que vem depois seguram o layout: quando o conteúdo real
   entra, ele ocupa o espaço que já estava reservado, e a tela não dá
   solavanco.
   ============================================================ */

function Barra({ className = '' }: { className?: string }) {
  return <div className={`rounded-lg bg-gray-200/70 ${className}`} />
}

/**
 * O esqueleto padrão de uma página do painel: cabeçalho, uma fileira de
 * números e um bloco de conteúdo.
 *
 * `aria-hidden` e `aria-busy` de propósito: para quem usa leitor de tela,
 * um punhado de retângulos não é informação — o que importa é o aviso de
 * que a página está carregando, dito uma vez.
 */
export default function Esqueleto({
  indicadores = 3,
  linhas = 5,
}: {
  indicadores?: number
  linhas?: number
}) {
  return (
    <div className="animate-pulse p-5 sm:p-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>

      <div aria-hidden="true">
        {/* Cabeçalho */}
        <div className="mb-7">
          <Barra className="mb-3 h-3.5 w-24" />
          <Barra className="h-7 w-64 max-w-full" />
          <Barra className="mt-2 h-3.5 w-96 max-w-full" />
        </div>

        {/* Números */}
        {indicadores > 0 && (
          <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(indicadores, 3)}, minmax(0, 1fr))` }}>
            {Array.from({ length: indicadores }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white p-4 ring-1 ring-brand-950/[0.06]">
                <Barra className="h-8 w-14" />
                <Barra className="mt-2 h-3 w-20" />
              </div>
            ))}
          </div>
        )}

        {/* Conteúdo */}
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-brand-950/[0.06]">
          {Array.from({ length: linhas }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-3.5 px-4 py-3.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <Barra className="h-9 w-9 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <Barra className="h-3.5 w-1/3" />
                <Barra className="mt-1.5 h-3 w-1/5" />
              </div>
              <Barra className="hidden h-6 w-20 shrink-0 rounded-full sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
