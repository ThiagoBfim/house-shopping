export type Theme = 'auto' | 'light' | 'dark'

/** Mesma chave lida pelo script em index.html (aplica o tema antes de pintar a página). */
export const THEME_KEY = 'house-shopping:theme'

export const THEME_LABELS: Record<Theme, { icon: string; name: string }> = {
  auto: { icon: '🌓', name: 'Automático' },
  light: { icon: '☀️', name: 'Claro' },
  dark: { icon: '🌙', name: 'Escuro' },
}

const ORDER: Theme[] = ['auto', 'light', 'dark']

export const nextTheme = (theme: Theme): Theme => ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'auto'
  } catch {
    return 'auto'
  }
}

/** Automático segue o sistema (sem data-theme); claro/escuro forçam pelo atributo no <html>. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'auto') delete root.dataset.theme
  else root.dataset.theme = theme
  try {
    if (theme === 'auto') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Sem localStorage: vale só até recarregar a página.
  }
}
