import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { PageHeader, Indicador, EstadoVazio, Card, CardTitulo } from '@/components/ui'
import InscricaoRow, { type InscricaoItem } from '@/components/Dashboard/InscricaoRow'
import ConviteCard from '@/components/Dashboard/ConviteCard'
import TurmaInscricaoToggle from '@/components/Dashboard/TurmaInscricaoToggle'

export const dynamic = 'force-dynamic'

export default async function InscricoesPage() {
  await exigirSessao()
  const supabase = await createClient()

  // O endereço do site vem do cabeçalho da própria requisição, não de uma
  // variável fixa: assim o link e o QR Code funcionam igual no domínio de
  // produção, num domínio novo ou numa pré-visualização, sem reconfigurar.
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const protocolo = host.startsWith('localhost') ? 'http' : 'https'
  const base = `${protocolo}://${host}`

  const linkAluno = `${base}/inscricao/aluno`
  const linkProfessor = `${base}/inscricao/professor`

  const opcoesQr = { width: 320, margin: 1, color: { dark: '#05261d', light: '#ffffff' } }
  const [qrAluno, qrProfessor] = await Promise.all([
    QRCode.toDataURL(linkAluno, opcoesQr),
    QRCode.toDataURL(linkProfessor, opcoesQr),
  ])

  const [{ data: inscricoes }, { data: turmas }] = await Promise.all([
    supabase
      .from('inscricoes')
      .select('id, nome, email, telefone, papel, turma_id, mensagem, status, motivo, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('turmas')
      .select('id, nome, inscricoes_abertas, status')
      .neq('status', 'encerrada')
      .order('nome'),
  ])

  const nomeDaTurma = new Map((turmas ?? []).map((t) => [t.id, t.nome]))

  const lista: InscricaoItem[] = (inscricoes ?? []).map((i) => ({
    id: i.id,
    nome: i.nome,
    email: i.email,
    telefone: i.telefone,
    papel: i.papel,
    turma: i.turma_id ? (nomeDaTurma.get(i.turma_id) ?? 'Turma removida') : null,
    mensagem: i.mensagem,
    status: i.status,
    motivo: i.motivo,
    created_at: i.created_at,
  }))

  const pendentes = lista.filter((i) => i.status === 'pendente')
  const decididas = lista.filter((i) => i.status !== 'pendente')
  const abertas = (turmas ?? []).filter((t) => t.inscricoes_abertas).length

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Inscrições"
        descricao="Divulgue o link ou o QR Code, e aprove quem se inscrever. Ninguém entra na plataforma sem passar por aqui."
      />

      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        <Indicador
          icone="Inbox"
          valor={pendentes.length}
          label="Esperando sua análise"
          destaque={pendentes.length > 0}
        />
        <Indicador icone="UserCheck" valor={lista.filter((i) => i.status === 'aprovada').length} label="Aprovadas" />
        <Indicador icone="DoorOpen" valor={abertas} label="Turmas com inscrição aberta" />
      </div>

      {/* ---------- Links e QR Codes ---------- */}
      <div className="mb-7 grid gap-4 lg:grid-cols-2">
        <ConviteCard
          titulo="Link do Aluno"
          descricao="Para quem vai estudar. A pessoa escolhe a turma na hora da inscrição."
          url={linkAluno}
          qr={qrAluno}
          tom="azul"
        />
        <ConviteCard
          titulo="Link do Professor"
          descricao="Para quem vai ensinar. Conta a experiência e aguarda sua aprovação."
          url={linkProfessor}
          qr={qrProfessor}
          tom="roxo"
        />
      </div>

      {/* ---------- Quais turmas aparecem no formulário ---------- */}
      <Card className="mb-7">
        <CardTitulo icone="DoorOpen">Turmas abertas para inscrição</CardTitulo>
        <p className="mb-4 -mt-2 text-[12.5px] leading-relaxed text-gray-500">
          Só as turmas ligadas aqui aparecem para quem abre o link do aluno. Turma fechada continua
          existindo normalmente — apenas não é oferecida a novos inscritos.
        </p>
        {turmas && turmas.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {turmas.map((t) => (
              <TurmaInscricaoToggle
                key={t.id}
                turmaId={t.id}
                nome={t.nome}
                abertas={t.inscricoes_abertas}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-gray-500">Nenhuma turma criada ainda.</p>
        )}
      </Card>

      {/* ---------- Fila de aprovação ---------- */}
      <h2 className="mb-3 font-display text-[15px] font-bold text-gray-900">
        Esperando análise
        {pendentes.length > 0 && (
          <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">
            {pendentes.length}
          </span>
        )}
      </h2>

      {pendentes.length > 0 ? (
        <Card padding={false} className="mb-8 px-5">
          <ul className="divide-y divide-gray-100">
            {pendentes.map((i) => (
              <InscricaoRow key={i.id} inscricao={i} />
            ))}
          </ul>
        </Card>
      ) : (
        <div className="mb-8">
          <EstadoVazio
            icone="Inbox"
            titulo="Nenhuma inscrição esperando"
            descricao="Quando alguém se inscrever pelo link, aparece aqui para você aprovar ou recusar."
          />
        </div>
      )}

      {decididas.length > 0 && (
        <>
          <h2 className="mb-3 font-display text-[15px] font-bold text-gray-900">Já decididas</h2>
          <Card padding={false} className="px-5">
            <ul className="divide-y divide-gray-100">
              {decididas.map((i) => (
                <InscricaoRow key={i.id} inscricao={i} />
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
