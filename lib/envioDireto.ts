/* ============================================================
   ENVIO DIRETO DO NAVEGADOR PARA O ARMAZENAMENTO

   POR QUE NÃO SE MANDA ARQUIVO PELO SERVIDOR
   A hospedagem recusa requisição acima de ~4,5 MB, e o Next limita uma
   ação de servidor a 1 MB. Uma foto de celular passa de 1 MB com folga.
   Então todo arquivo de verdade morria no meio do caminho, e a pessoa
   via um erro sem explicação nenhuma.

   O caminho que funciona: o servidor só AUTORIZA e diz onde gravar; o
   navegador manda o arquivo direto. De quebra é mais rápido, porque o
   arquivo dá um salto a menos.

   POR QUE XHR E NÃO `fetch`
   Só o XHR informa o progresso do envio. Sem barra de progresso, um
   envio de três fotos em 4G parece que travou, a pessoa clica de novo, e
   aí sim quebra.
   ============================================================ */

export interface ProgressoDoEnvio {
  /** 0 a 100, do arquivo atual. */
  pct: number
  /** Qual arquivo da fila, começando em 1. */
  indice: number
  /** Quantos arquivos ao todo. */
  total: number
  nome: string
}

export function enviarAoArmazenamento(opcoes: {
  baseUrl: string
  bucket: string
  path: string
  token: string
  arquivo: File
  aoProgredir?: (pct: number) => void
}): Promise<void> {
  const { baseUrl, bucket, path, token, arquivo, aoProgredir } = opcoes

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${baseUrl}/storage/v1/object/${bucket}/${path}`, true)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('x-upsert', 'false')
    if (arquivo.type) xhr.setRequestHeader('Content-Type', arquivo.type)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && aoProgredir) aoProgredir(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      if (xhr.status === 413) {
        return reject(new Error(`"${arquivo.name}" é grande demais para o envio.`))
      }
      let detalhe = ''
      try {
        detalhe = JSON.parse(xhr.responseText)?.message ?? ''
      } catch {
        detalhe = ''
      }
      reject(new Error(detalhe || `Falha ao enviar "${arquivo.name}" (código ${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error('A conexão caiu durante o envio.'))
    xhr.send(arquivo)
  })
}
