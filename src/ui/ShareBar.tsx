interface Props {
  url: string
  text: string
  onCopied: (ok: boolean) => void
}

export function ShareBar({ url, text, onCopied }: Props) {
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      onCopied(true)
    } catch {
      onCopied(false)
    }
  }

  return (
    <div class="share-bar">
      <a
        class="small-button share-whatsapp"
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
      >
        WhatsApp
      </a>
      <button type="button" class="small-button" onClick={copy}>
        Copiar link
      </button>
      {canShare && (
        <button
          type="button"
          class="small-button"
          onClick={() => navigator.share({ title: 'House Shopping', text, url }).catch(() => {})}
        >
          Compartilhar…
        </button>
      )}
    </div>
  )
}
