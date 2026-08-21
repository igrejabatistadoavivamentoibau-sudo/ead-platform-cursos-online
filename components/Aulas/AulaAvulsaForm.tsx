'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, Film } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { autorizarEnvioDeVideo, registrarAulaEnviada } from '@/app/dashboard/professor/actions'
import { Botao, Card, Alerta, CAMPO, Campo, Progresso } from '@/components/ui'

/** Limite do armazenamento por arquivo. Acima disso, o caminho é o link. */
const LIMITE_MB = 50
const TIPOS = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']

/**
 * Envio de uma aula gravada.
 *
 * O arquivo vai DIRETO do navegador para o armazenamento, sem passar pelo
 * servidor da aplicação. Isso não é detalhe de implementação: o servidor
 * recusa requisições acima de ~4,5 MB, então a versão anterior — que mandava
 * o vídeo por dentro dele — travava e falhava calada em qualquer vídeo real.
 *
 * O servidor participa só nas pontas: autoriza o envio e registra a aula
 * depois. As duas conversas são de texto curto.
 */
export default function AulaAvulsaForm({
  cursoId,
  modulos = [],
}: {
  cursoId: string
  /** Os módulos do curso. Com um só, a escolha nem aparece. */
  modulos?: { id: string; nome: string; ordem: number }[]
}) {
  const emOrdem = [...modulos].sort((a, b) => a.ordem - b.ordem)
  const escolheModulo = emOrdem.length > 1
  const [aberto, setAberto] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [pct, setPct] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  const enviando = pct !== null

  /** Envia por XHR para conseguir mostrar progresso — o fetch não informa. */
  const subirArquivo = (url: string, token: string, file: File) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url, true)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.setRequestHeader('x-upsert', 'false')
      if (file.type) xhr.setRequestHeader('Content-Type', file.type)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve()
        if (xhr.status === 413) {
          return reject(new Error(`O vídeo passa de ${LIMITE_MB} MB. Use o campo de link da aula.`))
        }
        let detalhe = ''
        try {
          detalhe = JSON.parse(xhr.responseText)?.message ?? ''
        } catch {
          detalhe = ''
        }
        reject(new Error(detalhe || `Falha no envio (código ${xhr.status}).`))
      }
      xhr.onerror = () => reject(new Error('A conexão caiu durante o envio.'))
      xhr.send(file)
    })

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const dados = new FormData(e.currentTarget)
    const titulo = (dados.get('titulo') as string)?.trim()
    const descricao = (dados.get('descricao') as string)?.trim()
    const moduloId = (dados.get('modulo_id') as string) || emOrdem[0]?.id

    if (!arquivo) return setError('Escolha o arquivo de vídeo.')
    if (!TIPOS.includes(arquivo.type)) {
      return setError('Formato não suportado. Use MP4, WEBM, OGG ou MOV.')
    }
    if (arquivo.size > LIMITE_MB * 1024 * 1024) {
      return setError(
        `Este vídeo tem ${(arquivo.size / 1024 / 1024).toFixed(0)} MB e o limite de envio é ${LIMITE_MB} MB. ` +
          'Para vídeo grande, suba no YouTube, Google Drive ou OneDrive e use o campo de link da aula.'
      )
    }

    setPct(0)
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Sua sessão expirou. Entre de novo.')

      const { videoPath } = await autorizarEnvioDeVideo(cursoId, arquivo.name)

      await subirArquivo(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/aulas/${videoPath}`,
        session.access_token,
        arquivo
      )

      await registrarAulaEnviada({ cursoId, moduloId, titulo, descricao, videoPath })

      formRef.current?.reset()
      setArquivo(null)
      if (inputRef.current) inputRef.current.value = ''
      setAberto(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar a aula.')
    } finally {
      setPct(null)
    }
  }

  if (!aberto) {
    return (
      <Botao variante="secundario" icone="Film" onClick={() => setAberto(true)}>
        Enviar aula gravada
      </Botao>
    )
  }

  return (
    <Card>
      <form ref={formRef} onSubmit={enviar}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-[15px] font-bold text-gray-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Film className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            Aula gravada
          </h3>
          {!enviando && (
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Fechar"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          )}
        </div>

        <p className="mb-4 text-[13px] leading-relaxed text-gray-500">
          Grave o encontro e envie aqui para quem faltou poder assistir. Arquivos até {LIMITE_MB} MB
          — acima disso, suba no YouTube, Drive ou OneDrive e use o campo de link da aula.
        </p>

        <div className="space-y-4">
          {/* O módulo vem antes do nome: é ele que decide quem vai ver esta
              aula. Com um módulo só, não há decisão a tomar. */}
          {escolheModulo && (
            <Campo label="Módulo">
              <select name="modulo_id" disabled={enviando} className={CAMPO} defaultValue={emOrdem[0]?.id}>
                {emOrdem.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          <Campo label="Nome da aula">
            <input
              name="titulo"
              type="text"
              required
              disabled={enviando}
              placeholder="Ex: Encontro de 12/03 — Caráter do líder"
              className={CAMPO}
            />
          </Campo>

          <Campo label="Descrição (opcional)">
            <input
              name="descricao"
              type="text"
              disabled={enviando}
              placeholder="Um resumo curto do que foi tratado"
              className={CAMPO}
            />
          </Campo>

          <label
            className={`flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-4 transition-colors ${
              enviando
                ? 'cursor-not-allowed border-gray-200 opacity-60'
                : 'cursor-pointer border-gray-200 hover:border-brand-400 hover:bg-brand-50/40'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              disabled={enviando}
              accept="video/mp4,video/webm,video/ogg,video/quicktime"
              onChange={(e) => {
                setError(null)
                setArquivo(e.target.files?.[0] ?? null)
              }}
              className="sr-only"
            />
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Upload className="h-4.5 w-4.5" strokeWidth={1.9} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-gray-800">
                {arquivo ? arquivo.name : 'Escolher arquivo de vídeo'}
              </span>
              <span className="block text-[11.5px] text-gray-500">
                {arquivo
                  ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB`
                  : `MP4, WEBM ou MOV — até ${LIMITE_MB} MB`}
              </span>
            </span>
          </label>

          {error && <Alerta>{error}</Alerta>}

          {enviando && (
            <div className="rounded-lg bg-brand-50/70 px-3.5 py-3 ring-1 ring-brand-200">
              <div className="mb-2 flex items-center justify-between text-[12.5px]">
                <span className="font-semibold text-brand-800">
                  {pct < 100 ? 'Enviando o vídeo...' : 'Finalizando...'}
                </span>
                <span className="font-bold tabular-nums text-brand-800">{pct}%</span>
              </div>
              <Progresso valor={pct} />
              <p className="mt-2 text-[11.5px] text-brand-900/70">
                Não feche a página até terminar.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Botao type="submit" icone="Upload" disabled={enviando || !arquivo}>
              {enviando ? 'Enviando...' : 'Enviar aula'}
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              disabled={enviando}
              onClick={() => setAberto(false)}
            >
              Cancelar
            </Botao>
          </div>
        </div>
      </form>
    </Card>
  )
}
