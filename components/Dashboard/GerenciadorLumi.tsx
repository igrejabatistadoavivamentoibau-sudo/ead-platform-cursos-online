'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, X, Send } from 'lucide-react'
import {
  criarNovidade,
  alternarNovidade,
  removerNovidade,
  reenviarSaudacaoDeHoje,
} from '@/app/dashboard/admin/actions'
import { Botao, Card, CardTitulo, Alerta, Selo, CAMPO, Campo, Selecao } from '@/components/ui'

export interface NovidadeItem {
  id: string
  titulo: string
  descricao: string | null
  tipo: 'novidade' | 'melhoria' | 'correcao' | 'aviso'
  publico: 'todos' | 'aluno' | 'professor' | 'admin'
  publicada: boolean
  created_at: string
}

const TIPO = {
  novidade: { icone: '✨', label: 'Novidade' },
  melhoria: { icone: '⚡', label: 'Melhoria' },
  correcao: { icone: '🔧', label: 'Correção' },
  aviso: { icone: '📌', label: 'Aviso' },
}

const PUBLICO = { todos: 'Todos', aluno: 'Só alunos', professor: 'Só professores', admin: 'Só admins' }

export default function GerenciadorLumi({ novidades }: { novidades: NovidadeItem[] }) {
  const [criando, setCriando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
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
        criarNovidade({
          titulo: f.get('titulo') as string,
          descricao: (f.get('descricao') as string) || undefined,
          tipo: f.get('tipo') as NovidadeItem['tipo'],
          publico: f.get('publico') as NovidadeItem['publico'],
        }),
      () => {
        form.reset()
        setCriando(false)
      }
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {!criando && (
          <Botao icone="Plus" onClick={() => setCriando(true)}>
            Escrever novidade
          </Botao>
        )}
        <Botao
          variante="secundario"
          icone="Send"
          disabled={isPending}
          onClick={() =>
            agir(reenviarSaudacaoDeHoje, () =>
              setAviso('Pronto! Todo mundo recebe a saudação de novo no próximo acesso.')
            )
          }
        >
          Reenviar saudação de hoje
        </Botao>
      </div>

      {aviso && <Alerta tom="sucesso">{aviso}</Alerta>}
      {error && <Alerta>{error}</Alerta>}

      {criando && (
        <Card>
          <form onSubmit={criar}>
            <div className="mb-4 flex items-center justify-between">
              <CardTitulo icone="Sparkles">O que a LUMI vai contar</CardTitulo>
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
              <Campo label="Título" dica="Curto e direto. É o que a pessoa lê primeiro.">
                <input
                  name="titulo"
                  type="text"
                  required
                  placeholder="Ex: Agora você entrega trabalhos pela plataforma"
                  className={CAMPO}
                />
              </Campo>

              <Campo label="Explicação (opcional)">
                <textarea
                  name="descricao"
                  rows={2}
                  placeholder="Uma frase contando como usar"
                  className={`${CAMPO} resize-y leading-relaxed`}
                />
              </Campo>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Tipo">
                  <Selecao
                    name="tipo"
                    valorInicial="novidade"
                    opcoes={Object.entries(TIPO).map(([v, t]) => ({
                      valor: v,
                      rotulo: `${t.icone}  ${t.label}`,
                    }))}
                  />
                </Campo>
                <Campo label="Quem deve ver">
                  <Selecao
                    name="publico"
                    valorInicial="todos"
                    opcoes={Object.entries(PUBLICO).map(([v, l]) => ({ valor: v, rotulo: l }))}
                  />
                </Campo>
              </div>

              <div className="flex gap-2">
                <Botao type="submit" icone="Check" disabled={isPending}>
                  {isPending ? 'Salvando...' : 'Publicar novidade'}
                </Botao>
                <Botao type="button" variante="fantasma" onClick={() => setCriando(false)}>
                  Cancelar
                </Botao>
              </div>
            </div>
          </form>
        </Card>
      )}

      {novidades.length > 0 ? (
        <Card padding={false} className="px-5">
          <ul className="divide-y divide-gray-100">
            {novidades.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-3.5">
                <span className="mt-0.5 shrink-0 text-[15px]">{TIPO[n.tipo].icone}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13.5px] font-semibold text-gray-900">{n.titulo}</span>
                    <Selo tom={n.publico === 'todos' ? 'verde' : 'azul'}>{PUBLICO[n.publico]}</Selo>
                    {!n.publicada && <Selo tom="neutro">Não publicada</Selo>}
                  </div>
                  {n.descricao && (
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
                      {n.descricao}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={n.publicada}
                    aria-label={`Publicar ${n.titulo}`}
                    disabled={isPending}
                    onClick={() => agir(() => alternarNovidade(n.id, !n.publicada))}
                    className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                      n.publicada ? 'bg-brand-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        n.publicada ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => agir(() => removerNovidade(n.id))}
                    aria-label="Apagar"
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
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
          Nenhuma novidade escrita ainda. A LUMI vai saudar sem anunciar nada.
        </p>
      )}
    </div>
  )
}
