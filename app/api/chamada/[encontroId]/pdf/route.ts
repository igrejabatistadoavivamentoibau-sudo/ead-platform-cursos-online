import { NextResponse } from 'next/server'
import { carregarChamada, formatarData } from '@/lib/chamada'

/**
 * Lista de chamada em papel timbrado, pronta para impressão/PDF.
 *
 * Optei por gerar uma página HTML com CSS de impressão em vez de montar um
 * PDF binário no servidor. Motivos: o resultado é idêntico em qualquer
 * navegador ("Salvar como PDF" é nativo), o arquivo sai leve, e mudar o
 * timbre depois é editar HTML — não recompilar um gerador de PDF. A página
 * já abre com o diálogo de impressão.
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

  const esc = (t: string) =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

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

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Lista de Chamada — ${esc(dados.turma)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
    color: #12211b; margin: 0; font-size: 11.5pt;
  }

  /* ---------- Papel timbrado ---------- */
  .timbre {
    display: flex; align-items: center; gap: 14px;
    border-bottom: 2.5px solid #12805a; padding-bottom: 12px; margin-bottom: 6px;
  }
  .timbre .marca { display: flex; align-items: center; gap: 11px; }
  .brasao {
    width: 46px; height: 46px; border-radius: 50%;
    background: conic-gradient(#1a7f37 0 25%, #d32f2f 0 50%, #1565c0 0 75%, #f5a623 0);
    position: relative; flex: 0 0 auto;
  }
  .brasao::after {
    content: ''; position: absolute; inset: 12px; background: #fff; border-radius: 50%;
  }
  .timbre h1 { font-size: 15pt; margin: 0; letter-spacing: -0.2px; }
  .timbre .sub { font-size: 9pt; color: #4a6157; margin-top: 2px; letter-spacing: .4px; }
  .timbre .dir { margin-left: auto; text-align: right; font-size: 8.5pt; color: #6b7f76; }

  h2 { font-size: 13pt; margin: 16px 0 10px; }

  /* ---------- Dados do encontro ---------- */
  .info {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 22px;
    background: #f4faf7; border: 1px solid #d8ece3; border-radius: 6px;
    padding: 10px 13px; margin-bottom: 16px; font-size: 10pt;
  }
  .info b { color: #0f664a; font-weight: 600; }

  /* ---------- Tabela ---------- */
  table { width: 100%; border-collapse: collapse; }
  th {
    background: #0f664a; color: #fff; font-size: 9.5pt; font-weight: 600;
    text-align: left; padding: 7px 9px; letter-spacing: .3px;
  }
  td { padding: 7px 9px; border-bottom: 1px solid #e3ece8; font-size: 10.5pt; }
  tr:nth-child(even) td { background: #fafcfb; }
  .num { width: 34px; color: #6b7f76; text-align: center; }
  .mark { width: 60px; text-align: center; }
  .assin { width: 190px; }
  .p { color: #12805a; font-weight: 700; }
  .f { color: #c62828; font-weight: 700; }

  /* ---------- Rodapé ---------- */
  .resumo {
    margin-top: 14px; display: flex; gap: 26px; font-size: 10pt;
    border-top: 1.5px solid #d8ece3; padding-top: 10px;
  }
  .resumo b { color: #0f664a; }
  .assinatura {
    margin-top: 46px; display: flex; justify-content: space-around;
    text-align: center; font-size: 9.5pt; color: #4a6157;
  }
  .assinatura div { border-top: 1px solid #9aada5; padding-top: 5px; width: 210px; }
  .rodape {
    position: fixed; bottom: 0; left: 0; right: 0;
    font-size: 8pt; color: #8fa39a; text-align: center;
  }
  @media print { .noprint { display: none !important; } }
  .noprint {
    position: fixed; top: 12px; right: 12px; display: flex; gap: 8px;
  }
  .noprint button {
    font: inherit; font-size: 10pt; padding: 8px 14px; border-radius: 8px;
    border: 0; cursor: pointer; background: #12805a; color: #fff; font-weight: 600;
  }
</style>
</head>
<body>
  <div class="noprint"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>

  <header class="timbre">
    <div class="marca">
      <div class="brasao"></div>
      <div>
        <h1>Igreja Batista do Avivamento</h1>
        <div class="sub">ESCOLA DE LÍDERES IBAU</div>
      </div>
    </div>
    <div class="dir">
      Documento gerado pela plataforma<br>
      Escola de Líderes IBAU
    </div>
  </header>

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
  </div>

  <div class="rodape">Escola de Líderes IBAU — Igreja Batista do Avivamento</div>

  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 400))</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
