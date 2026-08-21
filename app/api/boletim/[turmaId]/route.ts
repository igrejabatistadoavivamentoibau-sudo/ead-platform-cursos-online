import { NextResponse } from 'next/server'
import { carregarBoletim } from '@/lib/carregarBoletim'
import { paginaDeDocumento, esc } from '@/lib/documento'
import { NOTA_DE_APROVACAO, situacaoPorExtenso, type BoletimDoAluno } from '@/lib/boletim'

/* ============================================================
   O BOLETIM EM PAPEL TIMBRADO

   `/api/boletim/<turma>`            → a turma inteira, um boletim por página
   `/api/boletim/<turma>?aluno=<id>` → só um aluno

   Quem pode ver o quê não é decidido aqui: as regras do banco fazem isso
   (ver lib/carregarBoletim.ts). O aluno que pedir a turma inteira recebe
   só a própria linha, porque é só ela que existe para ele.

   O BOLETIM MOSTRA A CONTA, NÃO SÓ O RESULTADO
   Um boletim que diz "média 6,8 — reprovado" e mais nada gera uma conversa
   difícil com a família e nenhuma resposta. Aqui cada item aparece com a
   nota, o peso, e o motivo de entrar ou não na média. Quem discordar,
   discorda de uma linha específica — que é uma conversa que se resolve.
   ============================================================ */

function linhaDoItem(i: BoletimDoAluno['itens'][number]) {
  const nota =
    i.valor !== null
      ? `${Number(i.valor).toLocaleString('pt-BR')} / ${Number(i.notaMaxima).toLocaleString('pt-BR')}`
      : i.situacao === 'nao_entregue'
        ? '0'
        : '—'
  const emDez = i.valorEmDez !== null && i.conta ? Number(i.valorEmDez.toFixed(1)).toLocaleString('pt-BR') : '—'
  return `
    <tr class="${i.conta ? '' : 'fora'}">
      <td>${esc(i.titulo)}</td>
      <td class="tipo">${i.origem === 'atividade' ? 'Atividade' : esc(i.tipo)}</td>
      <td class="n">${nota}</td>
      <td class="n">${i.conta ? Number(i.peso).toLocaleString('pt-BR') : '—'}</td>
      <td class="n forte">${emDez}</td>
      <td class="motivo">${esc(situacaoPorExtenso(i.situacao))}</td>
    </tr>`
}

function boletimDeUm(b: BoletimDoAluno, turma: string, curso: string | null, professor: string | null, primeiro: boolean) {
  const media = b.media === null ? '—' : b.media.toLocaleString('pt-BR', { minimumFractionDigits: 1 })
  const situacao =
    b.media === null
      ? '<span class="pend">Sem notas suficientes</span>'
      : b.aprovado
        ? '<span class="ok">APROVADO</span>'
        : '<span class="nao">REPROVADO</span>'

  return `
  <section class="${primeiro ? '' : 'nova-pagina'}">
    <h2>Boletim do aluno</h2>

    <div class="info">
      <div><b>Aluno:</b> ${esc(b.alunoNome)}</div>
      <div><b>Turma:</b> ${esc(turma)}</div>
      <div><b>Curso:</b> ${esc(curso ?? '—')}</div>
      <div><b>Professor:</b> ${esc(professor ?? '—')}</div>
      <div><b>Frequência:</b> ${b.frequencia === null ? '—' : `${b.frequencia}% (${b.presencas} de ${b.encontros} encontros)`}</div>
      <div><b>Emitido em:</b> ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date())}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Avaliação</th><th class="tipo">Tipo</th><th class="n">Nota</th>
          <th class="n">Peso</th><th class="n">Em 0–10</th><th class="motivo">Situação</th>
        </tr>
      </thead>
      <tbody>${b.itens.map(linhaDoItem).join('') || '<tr><td colspan="6">Nenhuma avaliação ou atividade nesta turma.</td></tr>'}</tbody>
    </table>

    <div class="fecho">
      <div class="media">
        <span class="rot">Média final</span>
        <span class="valor">${media}</span>
        <span class="escala">de 0 a 10</span>
      </div>
      <div class="situacao">
        <span class="rot">Situação</span>
        ${situacao}
        <span class="regra">aprovação a partir de ${NOTA_DE_APROVACAO.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
      </div>
    </div>

    <div class="assinatura">
      <div>Assinatura do Professor</div>
      <div>Assinatura da Coordenação</div>
    </div>
  </section>`
}

export async function GET(req: Request, { params }: { params: Promise<{ turmaId: string }> }) {
  const { turmaId } = await params
  const alunoId = new URL(req.url).searchParams.get('aluno') ?? undefined

  const dados = await carregarBoletim(turmaId, alunoId)
  if (!dados) {
    return new NextResponse('Boletim não encontrado ou sem permissão de acesso.', { status: 404 })
  }

  const { turma, boletins } = dados

  const corpo = `
  <style>
    .nova-pagina { page-break-before: always; }
    .tipo { width: 82px; text-transform: capitalize; }
    .motivo { width: 210px; font-size: 8.5pt; color: #5d716a; }
    tr.fora td { color: #93a49d; }
    td.forte { font-weight: 700; color: #0f664a; }
    .fecho {
      margin-top: 16px; display: flex; gap: 14px; align-items: stretch;
    }
    .fecho > div {
      flex: 1; border: 1px solid #d8ece3; border-radius: 6px; padding: 11px 14px;
      background: #f4faf7;
    }
    .rot { display: block; font-size: 8.5pt; letter-spacing: .5px; color: #4a6157; text-transform: uppercase; }
    .valor { display: block; font-size: 26pt; font-weight: 700; color: #0f664a; line-height: 1.1; }
    .escala { font-size: 8.5pt; color: #6b7f76; }
    .ok { display: block; font-size: 17pt; font-weight: 700; color: #12805a; margin: 4px 0 2px; }
    .nao { display: block; font-size: 17pt; font-weight: 700; color: #c62828; margin: 4px 0 2px; }
    .pend { display: block; font-size: 13pt; font-weight: 700; color: #a1751f; margin: 6px 0 2px; }
    .regra { font-size: 8.5pt; color: #6b7f76; }
  </style>
  ${boletins
    .map((b, i) => boletimDeUm(b, turma.nome, turma.curso, turma.professor, i === 0))
    .join('')}`

  const titulo =
    boletins.length === 1 ? `Boletim — ${boletins[0].alunoNome}` : `Boletins — ${turma.nome}`

  return new NextResponse(paginaDeDocumento({ titulo, corpo }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
