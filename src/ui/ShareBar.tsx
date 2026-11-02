import { cachedShort, shortenUrl } from './shortener.ts'

interface Props {
  url: string
  text: string
  /** `short`: o link copiado é o encurtado. */
  onCopied: (ok: boolean, short: boolean) => void
  /** Aviso rápido (toast). */
  onMessage: (message: string) => void
  /** Baixa a lista em Excel (.xlsx). */
  onExport: () => void
}

/**
 * Compartilhar sempre tenta o link curto (is.gd) e, se o encurtador falhar, usa o completo.
 * Os navegadores só deixam abrir aba, copiar e compartilhar durante o clique, então cada botão
 * começa a ação no clique e completa quando o link chega.
 */
export function ShareBar({ url, text, onCopied, onMessage, onExport }: Props) {
  const whatsappUrl = (link: string) =>
    `https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  const openWhatsApp = (event: MouseEvent) => {
    event.preventDefault()
    const ready = cachedShort(url)
    if (ready) {
      window.open(whatsappUrl(ready), '_blank', 'noopener')
      return
    }
    // A aba abre já no clique (senão vira pop-up bloqueado) e vai ao WhatsApp com o link.
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    void shortenUrl(url).then((link) => {
      if (tab) tab.location.href = whatsappUrl(link)
      else window.location.href = whatsappUrl(link)
    })
  }

  const copy = async () => {
    const link = shortenUrl(url)
    try {
      // Safari só copia durante o clique: o ClipboardItem recebe a promessa do link.
      const blob = link.then((value) => new Blob([value], { type: 'text/plain' }))
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
    } catch {
      try {
        await navigator.clipboard.writeText(await link)
      } catch {
        onCopied(false, false)
        return
      }
    }
    onCopied(true, (await link) !== url)
  }

  const share = async () => {
    const link = cachedShort(url) ?? (await shortenUrl(url))
    try {
      await navigator.share({ title: 'House Shopping', text, url: link })
    } catch (error) {
      // O link demorou e o navegador deixou de considerar o clique: o próximo toque é imediato.
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        onMessage('Link pronto: toque em “Compartilhar…” de novo.')
      }
    }
  }

  return (
    <div class="share-bar">
      <a
        class="small-button share-whatsapp"
        href={whatsappUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={openWhatsApp}
      >
        WhatsApp
      </a>
      <button type="button" class="small-button" onClick={copy}>
        Copiar link
      </button>
      {canShare && (
        <button type="button" class="small-button" onClick={share}>
          Compartilhar…
        </button>
      )}
      <button type="button" class="small-button" onClick={onExport}>
        Baixar Excel
      </button>
    </div>
  )
}
