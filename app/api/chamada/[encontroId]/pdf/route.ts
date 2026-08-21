import { NextResponse } from 'next/server'
import { carregarChamada, formatarData } from '@/lib/chamada'
import { paginaDeDocumento, esc } from '@/lib/documento'

/**
 * Lista de chamada em papel timbrado, pronta para impressão/PDF.
 *
 * O TIMBRE SAIU DAQUI
 * O cabeçalho e o estilo moravam neste arquivo, e o "logo" era um círculo
 * colorido desenhado por CSS — parecido de longe, mas não era a marca da
 * escola. Agora os dois vêm de lib/documento.ts, junto com o selo de
 * verdade embutido. Qualquer documento novo nasce com a mesma identidade,
 * e mudar o timbre é mexer num arquivo só.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ encontroId: string }> }
) {
  const { encontroId } = await params
  const dados = await carregarChamada(encontroId)

  if (!dados) {
    return new NextResponse('Chamada não encontrada ou sem permissão de acesso.', { status: 404 })
  }

  const linhas = dados.linhas
    .map(
      (l, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(l.nome)}</td>
        <td class="mark">${l.presente ? '<span class="p">P</span>' : '<span class="f">F</span>'}</td>
        <td class="assin"></td>
      </tr>`
    )
    .join('')

  const corpo = `
  <style>
    .mark { width: 60px; text-align: center; }
    .assin { width: 190px; }
    .p { color: #12805a; font-weight: 700; }
    .f { color: #c62828; font-weight: 700; }
  </style>

  <h2>Lista de Chamada</h2>

  <div class="info">
    <div><b>Turma:</b> ${esc(dados.turma)}</div>
    <div><b>Data:</b> ${formatarData(dados.data)}</div>
    <div><b>Curso:</b> ${esc(dados.curso ?? '—')}</div>
    <div><b>Encontro:</b> ${esc(dados.titulo)}</div>
    <div><b>Professor:</b> ${esc(dados.professor ?? '—')}</div>
    <div><b>Alunos:</b> ${dados.total}</div>
  </div>

  <table>
    <thead>
      <tr><th class="num">#</th><th>Nome do aluno</th><th class="mark">P/F</th><th>Assinatura</th></tr>
    </thead>
    <tbody>${linhas || '<tr><td colspan="4">Nenhum aluno matriculado.</td></tr>'}</tbody>
  </table>

  <div class="resumo">
    <span><b>Presentes:</b> ${dados.presentes}</span>
    <span><b>Ausentes:</b> ${dados.total - dados.presentes}</span>
    <span><b>Frequência:</b> ${dados.total ? Math.round((dados.presentes / dados.total) * 100) : 0}%</span>
  </div>

  <div class="assinatura">
    <div>Assinatura do Professor</div>
    <div>Assinatura da Coordenação</div>
  </div>`

  return new NextResponse(
    paginaDeDocumento({ titulo: `Lista de Chamada — ${dados.turma}`, corpo }),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
