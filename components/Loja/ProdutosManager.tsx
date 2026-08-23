'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  X,
  Pencil,
  Trash2,
  EyeOff,
  Eye,
  BookOpen,
  FileText,
  Shirt,
  Package,
  AlertCircle,
} from 'lucide-react'
import {
  criarProduto,
  atualizarProduto,
  definirProdutoAtivo,
  removerProduto,
  type DadosDoProduto,
} from '@/app/dashboard/admin/loja/actions'
import { reais } from '@/lib/precos'
import { Card, CardTitulo, Campo, CAMPO, Botao, EstadoVazio } from '@/components/ui'

export interface ProdutoNaTela {
  id: string
  nome: string
  descricao: string | null
  categoria: 'livro' | 'apostila' | 'vestuario' | 'outro'
  preco_centavos: number
  estoque: number | null
  ativo: boolean
  vendidos: number
}

const CATEGORIAS: { valor: ProdutoNaTela['categoria']; rotulo: string; icone: typeof BookOpen }[] = [
  { valor: 'livro', rotulo: 'Livro', icone: BookOpen },
  { valor: 'apostila', rotulo: 'Apostila', icone: FileText },
  { valor: 'vestuario', rotulo: 'Camiseta / vestuário', icone: Shirt },
  { valor: 'outro', rotulo: 'Outro', icone: Package },
]

const VAZIO: DadosDoProduto = {
  nome: '',
  descricao: '',
  categoria: 'livro',
  preco: '',
  estoque: '',
  ativo: true,
}

/* ============================================================
   OS PRODUTOS DA LOJA

   Duas decisões de desenho que valem explicar:

   O PREÇO É UM CAMPO DE TEXTO, e não um campo de número. Campo de número
   no celular briga com vírgula, e quem digita preço digita "49,90". O
   texto é convertido em centavos no servidor, aceitando vírgula ou ponto.

   "TIRAR DA LOJA" VEM ANTES DE "APAGAR", e apagar é recusado para produto
   já vendido. O produto está dentro de pedidos antigos: apagá-lo apagaria
   parte do histórico de vendas. Tirar da vitrine é o que a coordenação
   quer dizer quase sempre quando fala em remover.
   ============================================================ */

export default function ProdutosManager({ produtos }: { produtos: ProdutoNaTela[] }) {
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<DadosDoProduto>(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const fechar = () => {
    setCriando(false)
    setEditando(null)
    setForm(VAZIO)
    setErro(null)
  }

  const salvar = () => {
    setErro(null)
    startTransition(async () => {
      const r = editando ? await atualizarProduto(editando, form) : await criarProduto(form)
      if (!r.ok) return setErro(r.erro)
      fechar()
      router.refresh()
    })
  }

  const acao = (fn: () => Promise<{ ok: boolean; erro?: string }>) => {
    setErro(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) return setErro(r.erro ?? 'Não consegui fazer isso.')
      router.refresh()
    })
  }

  const abrirEdicao = (p: ProdutoNaTela) => {
    setEditando(p.id)
    setCriando(false)
    setErro(null)
    setForm({
      nome: p.nome,
      descricao: p.descricao ?? '',
      categoria: p.categoria,
      preco: (p.preco_centavos / 100).toFixed(2).replace('.', ','),
      estoque: p.estoque === null ? '' : String(p.estoque),
      ativo: p.ativo,
    })
  }

  const formulario = (
    <div className="rounded-2xl bg-gray-50/70 p-4 ring-1 ring-brand-950/[0.06] sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-gray-900">
          {editando ? 'Editando produto' : 'Novo produto'}
        </h3>
        <button type="button" onClick={fechar} className="text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo label="Nome">
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Apostila — Escola de Líderes, Módulo 1"
              className={CAMPO}
            />
          </Campo>
        </div>

        <Campo label="Tipo">
          <select
            value={form.categoria}
            onChange={(e) =>
              setForm({ ...form, categoria: e.target.value as ProdutoNaTela['categoria'] })
            }
            className={CAMPO}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Preço">
          <input
            type="text"
            inputMode="decimal"
            value={form.preco}
            onChange={(e) => setForm({ ...form, preco: e.target.value })}
            placeholder="49,90"
            className={CAMPO}
          />
        </Campo>

        <Campo label="Estoque">
          <input
            type="text"
            inputMode="numeric"
            value={form.estoque}
            onChange={(e) => setForm({ ...form, estoque: e.target.value })}
            placeholder="deixe vazio se não quiser controlar"
            className={CAMPO}
          />
          <p className="mt-1 text-[11.5px] leading-relaxed text-gray-500">
            Vazio = sem controle. Com número, a loja desconta a cada compra e avisa quando acaba.
          </p>
        </Campo>

        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-[13.5px] font-medium text-gray-700">
            <input
              type="checkbox"
              checked={form.ativo !== false}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="h-4 w-4 accent-brand-600"
            />
            Aparecer na loja
          </label>
        </div>

        <div className="sm:col-span-2">
          <Campo label="Descrição (opcional)">
            <textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              rows={2}
              placeholder="Uma linha sobre o produto"
              className={CAMPO}
            />
          </Campo>
        </div>
      </div>

      {erro && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[13px] text-red-800 ring-1 ring-red-200">
          <AlertCircle className="mt-px h-4 w-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Botao onClick={salvar} disabled={isPending}>
          {isPending ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar à loja'}
        </Botao>
        <Botao variante="secundario" onClick={fechar}>
          Cancelar
        </Botao>
      </div>
    </div>
  )

  return (
    <Card>
      <CardTitulo icone="ShoppingBag">Produtos</CardTitulo>

      <div className="mb-4">
        {!criando && !editando ? (
          <button
            type="button"
            onClick={() => {
              setCriando(true)
              setForm(VAZIO)
              setErro(null)
            }}
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-glow active:scale-[0.98]"
          >
            <Plus
              className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90"
              strokeWidth={2.5}
            />
            Novo produto
          </button>
        ) : (
          formulario
        )}
      </div>

      {erro && !criando && !editando && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[13px] text-red-800 ring-1 ring-red-200">
          <AlertCircle className="mt-px h-4 w-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </div>
      )}

      {produtos.length === 0 ? (
        <EstadoVazio
          icone="ShoppingBag"
          titulo="Nenhum produto cadastrado ainda"
          descricao="Cadastre o primeiro livro ou apostila e ele aparece na loja do aluno na hora."
        />
      ) : (
        <ul className="divide-y divide-gray-100">
          {produtos.map((p) => {
            const Icone = CATEGORIAS.find((c) => c.valor === p.categoria)?.icone ?? Package
            const emEdicao = editando === p.id
            if (emEdicao) return <li key={p.id} className="py-3">{formulario}</li>

            return (
              <li key={p.id} className={`py-3.5 ${p.ativo ? '' : 'opacity-60'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Icone className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800">{p.nome}</p>
                        {!p.ativo && (
                          <span className="rounded-md bg-gray-200 px-1.5 py-0.5 text-[11px] font-bold text-gray-600">
                            Fora da loja
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[13px] font-bold text-brand-700">
                        {reais(p.preco_centavos)}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-gray-500">
                        {p.estoque === null
                          ? 'Estoque livre'
                          : p.estoque === 0
                            ? 'Esgotado'
                            : `${p.estoque} em estoque`}
                        {p.vendidos > 0 && ` · ${p.vendidos} vendido(s)`}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => abrirEdicao(p)}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                      Editar
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => acao(() => definirProdutoAtivo(p.id, !p.ativo))}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40"
                    >
                      {p.ativo ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" strokeWidth={2.25} />
                          Tirar da loja
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" strokeWidth={2.25} />
                          Voltar para a loja
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => acao(() => removerProduto(p.id))}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      Apagar
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
