const REPOSITORY = 'https://github.com/ThiagoBfim/house-shopping'

/** Só versões de release ("v1.3.0") têm página no GitHub; builds locais ("v1.2.0-3-gabc") não. */
const isRelease = (version: string) => /^v\d+\.\d+\.\d+$/.test(version)

/** Rodapé: copyright e versão da aplicação. */
export function Footer({ version = __APP_VERSION__ }: { version?: string }) {
  return (
    <footer class="app-footer container">
      <span>© {new Date().getFullYear()} Thiago Bomfim · House Shopping</span>
      <span>
        Versão{' '}
        {isRelease(version) ? (
          <a
            href={`${REPOSITORY}/releases/tag/${version}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {version}
          </a>
        ) : (
          version
        )}
      </span>
    </footer>
  )
}
