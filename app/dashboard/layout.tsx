import type { ReactNode } from 'react'
import { RegistroDaRota } from '@/components/ui/Voltar'
import LuzQueSegue from '@/components/Sistema/LuzQueSegue'

/* ============================================================
   A CAMADA MAIS DE FORA DO PAINEL

   Ela não desenha nada. Existe para ligar, em TODAS as telas do painel de
   uma vez, duas coisas que não podem depender de cada tela lembrar:

   1. O REGISTRO DA TRILHA (lib/trilha.ts). Começou tela por tela — mas aí
      toda tela nova precisaria lembrar de se registrar, e a que
      esquecesse abriria um buraco silencioso: o "voltar" da tela seguinte
      prometeria um destino e entregaria outro.

   2. A LUZ QUE SEGUE O CURSOR nos cartões. Mesmo motivo, e mais um: é UM
      ouvinte para a plataforma inteira. Por cartão seriam trinta numa
      tela de cursos.

   Aqui, quem esquece não existe.
   ============================================================ */

export default function LayoutDoPainel({ children }: { children: ReactNode }) {
  return (
    <>
      <RegistroDaRota />
      <LuzQueSegue />
      {children}
    </>
  )
}
