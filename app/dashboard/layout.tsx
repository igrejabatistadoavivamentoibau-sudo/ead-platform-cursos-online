import type { ReactNode } from 'react'
import { RegistroDaRota } from '@/components/ui/Voltar'

/* ============================================================
   A CAMADA MAIS DE FORA DO PAINEL

   Ela não desenha nada. Existe por um motivo só: ligar o registro da
   trilha (lib/trilha.ts) em TODAS as telas do painel de uma vez.

   Poderia estar tela por tela, e foi assim que começou — mas aí toda tela
   nova precisaria lembrar de se registrar, e a que esquecesse abriria um
   buraco silencioso: o "voltar" da tela seguinte prometeria um destino e
   entregaria outro. Aqui, quem esquece não existe.
   ============================================================ */

export default function LayoutDoPainel({ children }: { children: ReactNode }) {
  return (
    <>
      <RegistroDaRota />
      {children}
    </>
  )
}
