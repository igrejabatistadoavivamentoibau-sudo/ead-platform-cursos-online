import Link from 'next/link'
import { PlayCircle, FileText, MessagesSquare, GraduationCap, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import {
  HeroAluno,
  SecaoTitulo,
  CursoCardVivo,
  PainelInicio,
  type ItemPainel,
} from '@/components/Aluno/InicioVisual'

/**
 * O INÍCIO DO ALUNO — design "Aurora".
 *
 * A página antiga girava em torno de UMA turma ("turmaAtiva") e empilhava
 * caixas brancas iguais. Aqui a pergunta muda: o aluno chega querendo saber
 * *onde ele parou* e *o que está em aberto*. Então a tela responde nessa
 * ordem — herói com o retrato do avanço, cards de curso vivos para retomar,
 * e dois painéis com o que a semana cobra dele.
 *
 * Toda a aparência mora em components/Aluno/InicioVisual.tsx. Aqui só se
 * busca dado e se calcula número. Essa separação é o que permitiu aprovar o
 * visual em prévia antes de ligar no banco.
 */

/* O painel de pendências conta em DIAS, e o prazo agora tem HORA.
   As duas funções abaixo traduzem uma coisa na outra sempre no fuso de
   Brasília: sem isso, uma atividade que vence hoje às 23:59 apareceria
   como "amanhã" para quem está no servidor em UTC. */
const FUSO = 'America/Sao_Paulo'

function formatarDataCurta(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: FUSO,
  }).format(new Date(iso))
}

/** O dia do calendário em Brasília, como número, para poder subtrair. */
function diaEmBrasilia(d: Date): number {
  const partes = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: FUSO,
  }).format(d)
  return Date.parse(`${partes}T00:00:00Z`) / 86400000
}

function diasAte(iso: string) {
  return diaEmBrasilia(new Date(iso)) - diaEmBrasilia(new Date())
}

export default async function AlunoHome() {
  const sessao = await exigirSessao()
  const supabase = await createClient()

  /* ---------------- Matrículas, turmas e cursos ---------------- */

  // Sem o join aninhado users(name): entre turmas e users existe mais de um
  // caminho possível e a consulta falhava calada (ver lib/consulta.ts).
  const { data: matriculas } = await supabase
    .from('turma_alunos')
    .select(
      'turma_id, turmas(id, nome, descricao, status, curso_id, professor_id, cursos(id, titulo, cor, modalidade, ordem))'
    )
    .eq('aluno_id', sessao.id)

  type CursoBruto = {
    id: string
    titulo: string
    cor: string
    modalidade: 'ead' | 'presencial'
    ordem: number
  }

  const turmas = (matriculas ?? [])
    .map((m) => {
      const t = m.turmas as unknown as {
        id?: string
        nome?: string
        descricao?: string | null
        status?: string
        curso_id?: string | null
        professor_id?: string | null
        cursos?: CursoBruto | null
      } | null
      if (!t?.id) return null
      return {
        id: t.id,
        nome: t.nome ?? '',
        descricao: t.descricao ?? null,
        status: t.status ?? 'planejada',
        cursoId: t.curso_id ?? null,
        professorId: t.professor_id ?? null,
        curso: t.cursos ?? null,
      }
    })
    .filter(Boolean) as {
    id: string
    nome: string
    descricao: string | null
    status: string
    cursoId: string | null
    professorId: string | null
    curso: CursoBruto | null
  }[]

  const idsTurmas = turmas.map((t) => t.id)
  const idsCursos = [...new Set(turmas.map((t) => t.cursoId).filter(Boolean))] as string[]
  const idsProfessores = [...new Set(turmas.map((t) => t.professorId).filter(Boolean))] as string[]

  const [
    { data: professores },
    { data: aulas },
    { data: progressos },
    { data: presencas },
    { data: atividades },
    { data: entregas },
    { data: mensagens },
  ] = await Promise.all([
    idsProfessores.length
      ? supabase.from('users').select('id, name').in('id', idsProfessores)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    idsCursos.length
      ? supabase
          .from('aulas')
          /* A coluna é `numero`, não `ordem`. Com o nome errado o banco
             respondia erro 400, o código não conferia o erro, e a lista
             chegava vazia — a tela inicial mostrava 0 aulas e 0% em TODOS
             os cursos, e "próxima aula" nunca aparecia. Silencioso, e por
             isso mesmo difícil de perceber: parecia que o aluno não tinha
             conteúdo, não que a consulta estava quebrada. */
          .select('id, curso_id, titulo, numero')
          .in('curso_id', idsCursos)
          .eq('publicada', true)
          .order('numero', { ascending: true })
      : Promise.resolve({ data: [] as { id: string; curso_id: string; titulo: string; numero: number }[] }),
    supabase
      .from('aula_progresso')
      .select('aula_id, concluida')
      .eq('aluno_id', sessao.id)
      .eq('concluida', true),
    supabase.from('presencas').select('presente, encontros(data, titulo, turma_id)').eq('aluno_id', sessao.id),
    idsTurmas.length
      ? supabase
          .from('atividades')
          .select('id, turma_id, titulo, abre_em, vence_em')
          .in('turma_id', idsTurmas)
          .eq('publicada', true)
          .order('vence_em', { ascending: true, nullsFirst: false })
      : Promise.resolve({
          data: [] as {
            id: string
            turma_id: string
            titulo: string
            abre_em: string | null
            vence_em: string | null
          }[],
        }),
    supabase.from('entregas').select('atividade_id').eq('aluno_id', sessao.id),
    idsTurmas.length
      ? supabase
          .from('mensagens')
          .select('id, turma_id, texto, autor_nome, aviso, created_at, autor_id')
          .in('turma_id', idsTurmas)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({
          data: [] as {
            id: string
            turma_id: string
            texto: string
            autor_nome: string | null
            aviso: boolean
            created_at: string
            autor_id: string
          }[],
        }),
  ])

  const nomeProfessor = new Map((professores ?? []).map((p) => [p.id, p.name]))
  const nomeTurma = new Map(turmas.map((t) => [t.id, t.nome]))

  /* ---------------- Números ---------------- */

  const concluidas = new Set((progressos ?? []).map((p) => p.aula_id))

  const aulasPorCurso = new Map<string, { id: string; titulo: string }[]>()
  for (const a of aulas ?? []) {
    aulasPorCurso.set(a.curso_id, [...(aulasPorCurso.get(a.curso_id) ?? []), { id: a.id, titulo: a.titulo }])
  }

  const totalAulas = (aulas ?? []).length
  const aulasFeitas = (aulas ?? []).filter((a) => concluidas.has(a.id)).length

  const presencasMinhas = (presencas ?? [])
    .map((p) => ({
      presente: p.presente as boolean,
      encontro: p.encontros as unknown as { data?: string; titulo?: string; turma_id?: string } | null,
    }))
    .filter((p) => p.encontro?.turma_id && idsTurmas.includes(p.encontro.turma_id))

  const totalEncontros = presencasMinhas.length
  const totalPresencas = presencasMinhas.filter((p) => p.presente).length
  const presencaPct = totalEncontros > 0 ? Math.round((totalPresencas / totalEncontros) * 100) : null

  // O "geral" é a média do que existe: se ainda não houve encontro, ele é o
  // avanço nas aulas puro — não faz sentido punir o aluno por uma frequência
  // que nem começou a ser registrada.
  const progressoAulas = totalAulas > 0 ? Math.round((aulasFeitas / totalAulas) * 100) : 0
  const geralPct =
    presencaPct === null ? progressoAulas : Math.round((progressoAulas + presencaPct) / 2)

  /* ---------------- Cards de curso ---------------- */

  const cursosVistos = new Set<string>()
  const cards = turmas
    .filter((t) => {
      if (!t.curso) return false
      if (cursosVistos.has(t.curso.id)) return false
      cursosVistos.add(t.curso.id)
      return true
    })
    .sort((a, b) => (a.curso!.ordem ?? 0) - (b.curso!.ordem ?? 0))
    .map((t) => {
      const lista = aulasPorCurso.get(t.curso!.id) ?? []
      const feitas = lista.filter((a) => concluidas.has(a.id)).length
      const proxima = lista.find((a) => !concluidas.has(a.id))
      return {
        turma: t,
        curso: t.curso!,
        feitas,
        total: lista.length,
        proxima,
      }
    })

  /* ---------------- Painel: o que está em aberto ---------------- */

  const entregues = new Set((entregas ?? []).map((e) => e.atividade_id))
  const agora = Date.now()

  /* O painel é "o que está em aberto". Atividade que ainda não abriu não
     está em aberto — está por vir, e cobrar dela hoje só gera aflição.
     Já a que encerrou continua aparecendo, porque o aluno precisa saber
     que ficou para trás: sumir com ela é a plataforma escondendo o
     problema, não resolvendo. */
  const pendentes = (atividades ?? []).filter((a) => {
    if (entregues.has(a.id)) return false
    if (a.abre_em && agora < new Date(a.abre_em).getTime()) return false
    return true
  })

  const itensPendencia: ItemPainel[] = pendentes.slice(0, 4).map((a) => {
    const venceu = !!a.vence_em && agora > new Date(a.vence_em).getTime()
    const dias = a.vence_em ? diasAte(a.vence_em) : null
    const etiqueta = venceu
      ? ({ texto: 'ENCERRADA', tom: 'ambar' } as const)
      : dias === null
        ? undefined
        : dias === 0
          ? ({ texto: 'HOJE', tom: 'ambar' } as const)
          : dias <= 3
            ? ({ texto: `${dias}D`, tom: 'ambar' } as const)
            : ({ texto: formatarDataCurta(a.vence_em!), tom: 'verde' } as const)
    return {
      href: '/dashboard/aluno/atividades',
      titulo: a.titulo,
      subtitulo: nomeTurma.get(a.turma_id) ?? 'Atividade',
      icone: 'atividade',
      etiqueta,
    }
  })

  // Se não há pendência, o painel não fica vazio à toa: ele oferece a
  // próxima aula de cada curso — o passo natural de quem está em dia.
  const itensRetomar: ItemPainel[] = cards
    .filter((c) => c.proxima)
    .slice(0, 4)
    .map((c) => ({
      href: `/dashboard/aluno/cursos/${c.curso.id}`,
      titulo: c.proxima!.titulo,
      subtitulo: c.curso.titulo,
      icone: 'aula' as const,
    }))

  /* ---------------- Painel: conversas ---------------- */

  const itensConversa: ItemPainel[] = (mensagens ?? [])
    .filter((m) => m.autor_id !== sessao.id)
    .slice(0, 4)
    .map((m) => ({
      href: `/dashboard/aluno/conversas?turma=${m.turma_id}`,
      titulo: m.aviso ? `Aviso — ${nomeTurma.get(m.turma_id) ?? ''}` : (m.autor_nome ?? 'Mensagem'),
      subtitulo: (m.texto ?? '').replace(/\s+/g, ' ').slice(0, 70),
      icone: m.aviso ? ('aviso' as const) : ('inicial' as const),
      inicial: (m.autor_nome ?? '?').trim().charAt(0).toUpperCase(),
      etiqueta: m.aviso ? ({ texto: 'TURMA', tom: 'ambar' } as const) : undefined,
    }))

  /* ---------------- Tela ---------------- */

  if (turmas.length === 0) {
    return (
      <div className="p-5 sm:p-8">
        <HeroAluno
          nome={sessao.name}
          frase="Sua jornada começa assim que a secretaria confirmar sua matrícula."
          aulasFeitas={0}
          aulasTotal={0}
          presencaPct={null}
          geralPct={0}
        />
        <div className="mt-6 rounded-2xl border border-brand-950/[0.07] bg-white p-12 text-center shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)]">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-brand-200 bg-brand-50 text-brand-700">
            <GraduationCap className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <p className="font-display text-[15px] font-bold text-gray-900">
            Você ainda não está matriculado em nenhuma turma.
          </p>
          <p className="mt-1 text-[12.5px] text-gray-500">
            Fale com a liderança da sua célula ou com a secretaria da Escola de Líderes.
          </p>
        </div>
      </div>
    )
  }

  const emAndamento = turmas.filter((t) => t.status === 'em_andamento').length
  const frase =
    pendentes.length > 0
      ? `Você tem ${pendentes.length} ${pendentes.length === 1 ? 'atividade em aberto' : 'atividades em aberto'}. Vamos resolver?`
      : emAndamento > 0
        ? 'Tudo em dia por aqui. Que tal avançar mais uma aula hoje?'
        : 'Bons estudos — que Deus abençoe o seu preparo.'

  return (
    <div className="p-5 sm:p-8">
      <HeroAluno
        nome={sessao.name}
        frase={frase}
        aulasFeitas={aulasFeitas}
        aulasTotal={totalAulas}
        presencaPct={presencaPct}
        geralPct={geralPct}
      />

      <SecaoTitulo
        icone={PlayCircle}
        acao={{ href: '/dashboard/aluno/cursos', label: 'Ver todos' }}
      >
        CONTINUE DE ONDE PAROU
      </SecaoTitulo>

      {cards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c, i) => (
            <div key={c.curso.id} className="animate-float-in" style={{ animationDelay: `${i * 60}ms` }}>
              <CursoCardVivo
                href={`/dashboard/aluno/cursos/${c.curso.id}`}
                titulo={c.curso.titulo}
                professor={c.turma.professorId ? (nomeProfessor.get(c.turma.professorId) ?? null) : null}
                contexto={c.turma.nome}
                modalidade={c.curso.modalidade === 'presencial' ? 'presencial' : 'ead'}
                cor={c.curso.cor}
                feitas={c.feitas}
                total={c.total}
                rotuloUnidade="Aula"
                cta={c.feitas === 0 ? 'Começar' : c.feitas === c.total ? 'Revisar' : 'Continuar'}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-950/[0.07] bg-white p-8 text-center text-[12.5px] text-gray-500">
          Sua turma ainda não tem curso vinculado. Assim que o conteúdo for liberado, ele aparece
          aqui.
        </div>
      )}

      <SecaoTitulo icone={FileText}>SUA SEMANA</SecaoTitulo>

      <div className="grid gap-4 lg:grid-cols-2">
        {itensPendencia.length > 0 ? (
          <PainelInicio
            icone={FileText}
            titulo="Em aberto"
            resumo={`${pendentes.length} ${pendentes.length === 1 ? 'atividade' : 'atividades'}`}
            itens={itensPendencia}
            vazio="Nada pendente."
          />
        ) : (
          <PainelInicio
            icone={PlayCircle}
            titulo="Próximos passos"
            resumo="sem pendências"
            itens={itensRetomar}
            vazio="Você concluiu tudo o que está publicado. Parabéns!"
          />
        )}

        <PainelInicio
          icone={MessagesSquare}
          titulo="Conversas da turma"
          resumo={itensConversa.length > 0 ? 'recentes' : 'sem novidades'}
          itens={itensConversa}
          vazio="Nenhuma mensagem nova por enquanto."
        />
      </div>

      {presencaPct !== null && (
        <>
          <SecaoTitulo icone={GraduationCap} acao={{ href: '/dashboard/aluno/presencas', label: 'Detalhes' }}>
            SUA FREQUÊNCIA
          </SecaoTitulo>
          <Link
            href="/dashboard/aluno/presencas"
            className="group flex items-center gap-4 rounded-2xl border border-brand-950/[0.07] bg-white p-4 shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-700/[0.16]"
          >
            <div
              className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full"
              style={{ background: `conic-gradient(#1fa06f 0 ${presencaPct}%, #e7edea ${presencaPct}%)` }}
            >
              <div className="absolute inset-[3px] rounded-full bg-white" />
              <b className="relative text-[10.5px] font-bold text-brand-800">{presencaPct}%</b>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13px] font-bold tracking-[-0.01em] text-gray-900">
                {totalPresencas} de {totalEncontros} encontros
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {presencaPct >= 75
                  ? 'Frequência dentro do exigido para certificação.'
                  : 'Atenção: a certificação exige 75% de presença.'}
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-brand-700 transition-transform duration-300 group-hover:translate-x-1"
              strokeWidth={2.2}
            />
          </Link>
        </>
      )}
    </div>
  )
}
