'use client'

import { CAMPO, Campo } from '@/components/ui'
import type { CampoInscricao } from '@/lib/campos'

/**
 * Desenha as perguntas que a liderança criou.
 *
 * Cada resposta é enviada com o nome "campo:<id>". Usar o id — e não o texto
 * da pergunta — é o que permite renomear "Célula" para "Qual sua célula?" sem
 * perder o vínculo com o que já foi respondido antes.
 */
export default function CamposPersonalizados({ campos }: { campos: CampoInscricao[] }) {
  if (campos.length === 0) return null

  return (
    <>
      {campos.map((c) => {
        const nome = `campo:${c.id}`
        const obrigatorio = c.obrigatorio

        return (
          <Campo key={c.id} label={obrigatorio ? c.rotulo : `${c.rotulo} (opcional)`} dica={c.ajuda ?? undefined}>
            {c.tipo === 'texto_longo' ? (
              <textarea name={nome} required={obrigatorio} rows={3} className={`${CAMPO} resize-y leading-relaxed`} />
            ) : c.tipo === 'selecao' ? (
              <select name={nome} required={obrigatorio} defaultValue="" className={`${CAMPO} bg-white`}>
                <option value="" disabled>
                  Escolha uma opção
                </option>
                {c.opcoes.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : c.tipo === 'sim_nao' ? (
              <select name={nome} required={obrigatorio} defaultValue="" className={`${CAMPO} bg-white`}>
                <option value="" disabled>
                  Escolha
                </option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            ) : (
              <input
                name={nome}
                required={obrigatorio}
                type={
                  c.tipo === 'numero'
                    ? 'number'
                    : c.tipo === 'data'
                      ? 'date'
                      : c.tipo === 'telefone'
                        ? 'tel'
                        : c.tipo === 'email'
                          ? 'email'
                          : 'text'
                }
                className={CAMPO}
              />
            )}
          </Campo>
        )
      })}
    </>
  )
}
