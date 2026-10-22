import { useState } from 'preact/hooks'
import { applyTheme, nextTheme, readTheme, THEME_LABELS } from './theme.ts'

/** Alterna o tema: automático → claro → escuro. */
export function ThemeToggle() {
  const [theme, setTheme] = useState(readTheme)
  const { icon, name } = THEME_LABELS[theme]
  const next = THEME_LABELS[nextTheme(theme)].name.toLowerCase()

  return (
    <button
      type="button"
      class="theme-toggle"
      aria-label={`Tema: ${name.toLowerCase()}. Mudar para ${next}`}
      title={`Mudar para ${next}`}
      onClick={() => {
        const updated = nextTheme(theme)
        applyTheme(updated)
        setTheme(updated)
      }}
    >
      <span aria-hidden="true">{icon}</span> {name}
    </button>
  )
}
