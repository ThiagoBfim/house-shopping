import { formatBRL } from '../engine/money.ts'

export function App() {
  return (
    <main class="container">
      <h1>House Shopping</h1>
      <p>Escolha um cômodo, defina um orçamento e receba a sua lista de compras.</p>
      <p class="muted">Em construção — orçamento de exemplo: {formatBRL(30000)}</p>
    </main>
  )
}
