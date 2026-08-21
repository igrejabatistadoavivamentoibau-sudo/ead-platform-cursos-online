/**
 * A moldura que se refaz a cada navegação.
 *
 * Um `template` é remontado a cada troca de tela (o `layout`, não) — é
 * exatamente o gancho de que a entrada suave precisa. A barra lateral fica
 * parada, porque ela mora no layout; só o conteúdo entra.
 *
 * A animação está em app/globals.css, com o motivo dos 140ms escrito lá.
 */
export default function Moldura({ children }: { children: React.ReactNode }) {
  return <div className="entrada-de-tela">{children}</div>
}
