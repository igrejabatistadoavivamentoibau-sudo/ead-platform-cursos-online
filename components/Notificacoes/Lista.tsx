import Link from 'next/link'
import {
  Megaphone,
  Sparkles,
  Bell,
  UserCheck,
  GraduationCap,
  RefreshCw,
  ClipboardList,
  AlarmClock,
  PlayCircle,
  ShoppingBag,
} from 'lucide-react'
import { EstadoVazio, Card } from '@/components/ui'

export interface NotificacaoItem {
  id: string
  titulo: string
  corpo: string | null
  tipo: string
  link: string | null
  lida: boolean
  created_at: string
}

/* ============================================================
   O TIPO DECIDE O ÍCONE E A COR

   Numa lista de vinte recados, a pessoa não lê: ela varre. O que faz a
   varredura funcionar é o assunto ter forma e cor próprias antes de
   qualquer palavra ser lida — dá para achar "a nota" sem ler nada.

   Os quatro últimos chegaram com a migração 028, junto com os gatilhos
   que faltavam. Tipo sem entrada aqui não quebra nada (cai no sino
   cinza), mas entra na lista como "mais um recado igual aos outros" — e
   aí a varredura para de funcionar.
   ============================================================ */
const ICONE: Record<string, typeof Bell> = {
  aviso_turma: Megaphone,
  novidade: Sparkles,
  inscricao: UserCheck,
  nota: GraduationCap,
  atualizacao: RefreshCw,
  atividade: ClipboardList,
  prazo: AlarmClock,
  aula: PlayCircle,
  pedido: ShoppingBag,
  geral: Bell,
}

const COR: Record<string, string> = {
  aviso_turma: 'bg-amber-50 text-amber-600',
  novidade: 'bg-brand-50 text-brand-600',
  inscricao: 'bg-sky-50 text-sky-600',
  nota: 'bg-violet-50 text-violet-600',
  atualizacao: 'bg-gray-100 text-gray-500',
  atividade: 'bg-indigo-50 text-indigo-600',
  /* O único vermelho da central, e é de propósito: prazo é a única coisa
     aqui que a pessoa perde se não olhar hoje. Se tudo fosse urgente,
     nada seria. */
  prazo: 'bg-red-50 text-red-600',
  aula: 'bg-emerald-50 text-emerald-600',
  pedido: 'bg-teal-50 text-teal-600',
  geral: 'bg-gray-100 text-gray-500',
}

function quando(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * O registro do que a plataforma disse a esta pessoa.
 *
 * As não lidas chegam marcadas com um ponto e fundo levemente verde — a
 * página as marca como lidas ao ser aberta, então o destaque existe só
 * nesta visita. É o comportamento de caixa de entrada que todo mundo já
 * conhece: abrir é dar ciência.
 */
export default function Lista({ notificacoes }: { notificacoes: NotificacaoItem[] }) {
  if (notificacoes.length === 0) {
    return (
      <EstadoVazio
        icone="BellOff"
        titulo="Nenhuma notificação ainda"
        descricao="Avisos do professor, novidades da plataforma e recados importantes ficam registrados aqui."
      />
    )
  }

  return (
    <Card padding={false}>
      <ul className="divide-y divide-gray-100">
        {notificacoes.map((n) => {
          const Icone = ICONE[n.tipo] ?? Bell
          const conteudo = (
            <div
              className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${
                n.link ? 'hover:bg-gray-50' : ''
              } ${n.lida ? '' : 'bg-brand-50/40'}`}
            >
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${COR[n.tipo] ?? COR.geral}`}
              >
                <Icone className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className={`text-[13.5px] ${n.lida ? 'font-medium text-gray-800' : 'font-bold text-gray-900'}`}>
                    {n.titulo}
                  </p>
                  <span className="shrink-0 text-[11px] text-gray-400">{quando(n.created_at)}</span>
                </div>
                {n.corpo && (
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-gray-500">
                    {n.corpo}
                  </p>
                )}
              </div>
              {!n.lida && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
            </div>
          )
          return (
            <li key={n.id}>
              {n.link ? <Link href={n.link}>{conteudo}</Link> : conteudo}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
