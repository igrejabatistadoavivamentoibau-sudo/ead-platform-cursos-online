'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ArrowUp, ArrowDown, Trash2, GripVertical } from 'lucide-react'
import {
  criarCampoInscricao,
  alternarCampoInscricao,
  moverCampoInscricao,
  removerCampoInscricao,
} from '@/app/dashboard/admin/actions'
import { TIPOS_CAMPO, type CampoInscricao, type TipoCampo } from '@/lib/campos'
import { Botao, Card, CardTitulo, Alerta, Selo, CAMPO, Campo, Selecao } from '@/components/ui'

const PAPEL_LABEL = { aluno: 'Só aluno', professor: 'Só professor', ambos: 'Aluno e professor' }

export default function EditorDaFicha({ campos }: { campos: CampoInscricao[] }) {
  const [criando, setCriando] = useState(false)
  const [tipo, setTipo] = useState<TipoCampo>('texto')
  const [opcoes, setOpcoes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const agir = (fn: () => Promise<void>, aoTerminar?: () => void) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        aoTerminar?.()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar.')
      }
    })
  }

  const criar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const form = e.currentTarget
    agir(
      () =>
        criarCampoInscricao({
          rotulo: f.get('rotulo') as string,
          ajuda: (f.get('ajuda') as string) || undefined,
          tipo,
          opcoes: opcoes
            .split('\n')
            .map((o) => o.trim())
            .filter(Boolean),
          obrigatorio: f.get('obrigatorio') === 'on',
          papel: f.get('papel') as 'aluno' | 'professor' | 'ambos',
        }),
      () => {
        form.reset()
        setOpcoes('')
        setTipo('texto')
        setCriando(false)
      }
    )
  }

  return (
    <div className="space-y-4">
      {!criando ? (
        <Botao icone="Plus" onClick={() => setCriando(true)}>
          Adicionar pergunta
        </Botao>
      ) : (
        <Card>
          <form onSubmit={criar}>
            <div className="mb-4 flex items-center justify-between">
              <CardTitulo icone="ListPlus">Nova pergunta</CardTitulo>
              <button
                type="button"
                onClick={() => setCriando(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="space-y-4">
              <Campo label="Pergunta" dica="É o texto que a pessoa vê na ficha.">
                <input
                  name="rotulo"
                  type="text"
                  required
                  placeholder="Ex: Data de batismo"
                  className={CAMPO}
                />
              </Campo>

              <Campo label="Explicação (opcional)" dica="Uma linha de ajuda embaixo do campo.">
                <input
                  name="ajuda"
                  type="text"
                  placeholder="Ex: Deixe em branco se ainda não foi batizado"
                  className={CAMPO}
                />
              </Campo>

              <Campo label="Tipo de resposta">
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(TIPOS_CAMPO) as TipoCampo[]).map((t) => {
                    const ativo = tipo === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipo(t)}
                        aria-pressed={ativo}
                        className={`rounded-lg p-2.5 text-left ring-1 transition-all ${
                          ativo
                            ? 'bg-brand-50/70 ring-brand-300'
                            : 'bg-gray-50/60 ring-gray-200 hover:ring-gray-300'
                        }`}
                      >
                        <span
                          className={`block text-[12.5px] font-bold ${ativo ? 'text-brand-900' : 'text-gray-700'}`}
                        >
                          {TIPOS_CAMPO[t].label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
                          {TIPOS_CAMPO[t].descricao}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Campo>

              {TIPOS_CAMPO[tipo].temOpcoes && (
                <Campo label="Opções" dica="Uma por linha. Precisa de pelo menos duas.">
                  <textarea
                    rows={4}
                    value={opcoes}
                    onChange={(e) => setOpcoes(e.target.value)}
                    placeholder={'Manhã\nTarde\nNoite'}
                    className={`${CAMPO} resize-y leading-relaxed`}
                  />
                </Campo>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Aparece na ficha de">
                  <Selecao
                    name="papel"
                    valorInicial="aluno"
                    opcoes={[
                      { valor: 'aluno', rotulo: 'Só aluno' },
                      { valor: 'professor', rotulo: 'Só professor' },
                      { valor: 'ambos', rotulo: 'Aluno e professor' },
                    ]}
                  />
                </Campo>

                <label className="flex cursor-pointer items-center gap-2.5 self-end rounded-lg bg-gray-50/60 px-3.5 py-2.5 ring-1 ring-gray-200">
                  <input name="obrigatorio" type="checkbox" className="h-4 w-4 accent-brand-600" />
                  <span className="text-[13px] font-medium text-gray-700">
                    Resposta obrigatória
                  </span>
                </label>
              </div>

              {error && <Alerta>{error}</Alerta>}

              <div className="flex gap-2">
                <Botao type="submit" icone="Check" disabled={isPending}>
                  {isPending ? 'Salvando...' : 'Adicionar à ficha'}
                </Botao>
                <Botao type="button" variante="fantasma" onClick={() => setCriando(false)}>
                  Cancelar
                </Botao>
              </div>
            </div>
          </form>
        </Card>
      )}

      {error && !criando && <Alerta>{error}</Alerta>}

      {campos.length > 0 ? (
        <Card padding={false} className="px-5">
          <ul className="divide-y divide-gray-100">
            {campos.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <GripVertical className="h-4 w-4 shrink-0 text-gray-300" strokeWidth={2} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13.5px] font-semibold text-gray-900">{c.rotulo}</span>
                    {c.obrigatorio && <Selo tom="ambar">Obrigatória</Selo>}
                    {!c.ativo && <Selo tom="neutro">Desligada</Selo>}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-gray-500">
                    {TIPOS_CAMPO[c.tipo].label} · {PAPEL_LABEL[c.papel]}
                    {c.tipo === 'selecao' && c.opcoes.length > 0 && ` · ${c.opcoes.join(', ')}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={isPending || i === 0}
                    onClick={() => agir(() => moverCampoInscricao(c.id, 'cima'))}
                    aria-label="Subir"
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    disabled={isPending || i === campos.length - 1}
                    onClick={() => agir(() => moverCampoInscricao(c.id, 'baixo'))}
                    aria-label="Descer"
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" strokeWidth={2} />
                  </button>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.ativo}
                    aria-label={`Mostrar ${c.rotulo} na ficha`}
                    disabled={isPending}
                    onClick={() => agir(() => alternarCampoInscricao(c.id, !c.ativo))}
                    className={`relative ml-1 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                      c.ativo ? 'bg-brand-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        c.ativo ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => agir(() => removerCampoInscricao(c.id))}
                    aria-label="Apagar pergunta"
                    className="ml-1 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-[13px] text-gray-500">
          A ficha tem só os campos básicos. Adicione perguntas acima.
        </p>
      )}
    </div>
  )
}
