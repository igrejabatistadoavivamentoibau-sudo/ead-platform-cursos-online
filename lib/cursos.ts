export type NivelCurso = 'iniciante' | 'intermediario' | 'avancado'
export type CorCurso = 'esmeralda' | 'oceano' | 'ambar' | 'violeta' | 'rubi' | 'grafite'

export interface Curso {
  id: string
  titulo: string
  subtitulo: string | null
  descricao: string | null
  categoria: string | null
  nivel: NivelCurso
  capa_path: string | null
  cor: CorCurso
  carga_horaria: number | null
  publicado: boolean
  ordem: number
}

export const NIVEL_LABEL: Record<NivelCurso, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

/**
 * Paleta por curso. Cada curso ganha uma identidade visual própria, o que
 * ajuda a pessoa a reconhecer o curso de relance no catálogo — mas todas
 * as opções convivem com o verde da marca sem brigar com ele.
 */
export const CORES_CURSO: Record<
  CorCurso,
  { nome: string; gradiente: string; solido: string; suave: string; texto: string; anel: string }
> = {
  esmeralda: {
    nome: 'Esmeralda',
    gradiente: 'from-brand-800 via-brand-600 to-brand-500',
    solido: 'bg-brand-600',
    suave: 'bg-brand-50',
    texto: 'text-brand-700',
    anel: 'ring-brand-200',
  },
  oceano: {
    nome: 'Oceano',
    gradiente: 'from-sky-900 via-sky-700 to-cyan-500',
    solido: 'bg-sky-600',
    suave: 'bg-sky-50',
    texto: 'text-sky-700',
    anel: 'ring-sky-200',
  },
  ambar: {
    nome: 'Âmbar',
    gradiente: 'from-amber-800 via-amber-600 to-yellow-500',
    solido: 'bg-amber-600',
    suave: 'bg-amber-50',
    texto: 'text-amber-700',
    anel: 'ring-amber-200',
  },
  violeta: {
    nome: 'Violeta',
    gradiente: 'from-violet-900 via-violet-700 to-purple-500',
    solido: 'bg-violet-600',
    suave: 'bg-violet-50',
    texto: 'text-violet-700',
    anel: 'ring-violet-200',
  },
  rubi: {
    nome: 'Rubi',
    gradiente: 'from-rose-900 via-rose-700 to-red-500',
    solido: 'bg-rose-600',
    suave: 'bg-rose-50',
    texto: 'text-rose-700',
    anel: 'ring-rose-200',
  },
  grafite: {
    nome: 'Grafite',
    gradiente: 'from-slate-900 via-slate-700 to-slate-500',
    solido: 'bg-slate-700',
    suave: 'bg-slate-100',
    texto: 'text-slate-700',
    anel: 'ring-slate-300',
  },
}

export function corDoCurso(cor: string | null | undefined) {
  return CORES_CURSO[(cor as CorCurso) ?? 'esmeralda'] ?? CORES_CURSO.esmeralda
}

/** URL pública da capa do curso guardada no Supabase Storage. */
export function urlDaCapa(capaPath: string | null | undefined): string | null {
  if (!capaPath) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/cursos/${capaPath}`
}
