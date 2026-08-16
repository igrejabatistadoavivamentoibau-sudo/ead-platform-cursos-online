export type TipoCampo =
  | 'texto'
  | 'texto_longo'
  | 'numero'
  | 'data'
  | 'telefone'
  | 'email'
  | 'selecao'
  | 'sim_nao'

export interface CampoInscricao {
  id: string
  rotulo: string
  ajuda: string | null
  tipo: TipoCampo
  opcoes: string[]
  obrigatorio: boolean
  papel: 'aluno' | 'professor' | 'ambos'
  ordem: number
  ativo: boolean
}

/** Nome e comportamento de cada tipo de pergunta, num lugar só. */
export const TIPOS_CAMPO: Record<TipoCampo, { label: string; descricao: string; temOpcoes?: boolean }> = {
  texto: { label: 'Texto curto', descricao: 'Uma linha. Ex: nome da célula, profissão.' },
  texto_longo: { label: 'Texto longo', descricao: 'Várias linhas. Ex: testemunho, expectativas.' },
  numero: { label: 'Número', descricao: 'Só números. Ex: idade, anos de conversão.' },
  data: { label: 'Data', descricao: 'Calendário. Ex: data de nascimento, batismo.' },
  telefone: { label: 'Telefone', descricao: 'Abre o teclado numérico no celular.' },
  email: { label: 'E-mail', descricao: 'Confere o formato do endereço.' },
  selecao: { label: 'Escolha uma opção', descricao: 'Lista que você define.', temOpcoes: true },
  sim_nao: { label: 'Sim ou não', descricao: 'Duas opções apenas.' },
}

/** As perguntas que valem para uma ficha específica, já na ordem certa. */
export function camposDoPapel(
  campos: CampoInscricao[],
  papel: 'aluno' | 'professor'
): CampoInscricao[] {
  return campos
    .filter((c) => c.ativo && (c.papel === 'ambos' || c.papel === papel))
    .sort((a, b) => a.ordem - b.ordem)
}
