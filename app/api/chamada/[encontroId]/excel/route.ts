import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { carregarChamada, formatarData } from '@/lib/chamada'

/** Lista de chamada em planilha (.xlsx), já formatada nas cores da escola. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ encontroId: string }> }
) {
  const { encontroId } = await params
  const dados = await carregarChamada(encontroId)

  if (!dados) {
    return new NextResponse('Chamada não encontrada ou sem permissão de acesso.', { status: 404 })
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Escola de Líderes IBAU'
  wb.created = new Date()

  const ws = wb.addWorksheet('Chamada', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
  })

  ws.columns = [
    { key: 'num', width: 6 },
    { key: 'nome', width: 38 },
    { key: 'email', width: 32 },
    { key: 'presenca', width: 14 },
    { key: 'obs', width: 30 },
  ]

  const VERDE = 'FF0F664A'
  const VERDE_CLARO = 'FFF4FAF7'

  // ---------- Cabeçalho ----------
  ws.mergeCells('A1:E1')
  const t1 = ws.getCell('A1')
  t1.value = 'IGREJA BATISTA DO AVIVAMENTO'
  t1.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  t1.alignment = { horizontal: 'center', vertical: 'middle' }
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } }
  ws.getRow(1).height = 26

  ws.mergeCells('A2:E2')
  const t2 = ws.getCell('A2')
  t2.value = 'Escola de Líderes IBAU — Lista de Chamada'
  t2.font = { bold: true, size: 11, color: { argb: VERDE } }
  t2.alignment = { horizontal: 'center' }
  ws.getRow(2).height = 20

  // ---------- Dados do encontro ----------
  const info: [string, string][] = [
    ['Turma', dados.turma],
    ['Curso', dados.curso ?? '—'],
    ['Professor', dados.professor ?? '—'],
    ['Encontro', dados.titulo],
    ['Data', formatarData(dados.data)],
  ]

  let linha = 4
  for (const [rotulo, valor] of info) {
    ws.getCell(`A${linha}`).value = rotulo
    ws.getCell(`A${linha}`).font = { bold: true, color: { argb: VERDE } }
    ws.mergeCells(`B${linha}:E${linha}`)
    ws.getCell(`B${linha}`).value = valor
    linha++
  }

  // ---------- Tabela ----------
  linha++
  const cabecalho = ws.getRow(linha)
  cabecalho.values = ['#', 'Nome do aluno', 'E-mail', 'Presença', 'Observação']
  cabecalho.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } }
    c.alignment = { horizontal: 'left', vertical: 'middle' }
  })
  cabecalho.height = 22

  dados.linhas.forEach((l, i) => {
    linha++
    const r = ws.getRow(linha)
    r.values = [i + 1, l.nome, l.email, l.presente ? 'Presente' : 'Ausente', l.observacao ?? '']

    if (i % 2 === 1) {
      r.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } }
      })
    }
    const cp = r.getCell(4)
    cp.font = { bold: true, color: { argb: l.presente ? 'FF12805A' : 'FFC62828' } }
  })

  // ---------- Resumo ----------
  linha += 2
  ws.getCell(`A${linha}`).value = 'Presentes'
  ws.getCell(`A${linha}`).font = { bold: true, color: { argb: VERDE } }
  ws.getCell(`B${linha}`).value = dados.presentes

  ws.getCell(`C${linha}`).value = 'Ausentes'
  ws.getCell(`C${linha}`).font = { bold: true, color: { argb: VERDE } }
  ws.getCell(`D${linha}`).value = dados.total - dados.presentes

  linha++
  ws.getCell(`A${linha}`).value = 'Frequência'
  ws.getCell(`A${linha}`).font = { bold: true, color: { argb: VERDE } }
  ws.getCell(`B${linha}`).value = dados.total
    ? `${Math.round((dados.presentes / dados.total) * 100)}%`
    : '0%'

  const buffer = await wb.xlsx.writeBuffer()

  const nomeArquivo = `chamada-${dados.turma}-${dados.data}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nomeArquivo}.xlsx"`,
    },
  })
}
