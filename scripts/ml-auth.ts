// Autoriza o app do Mercado Livre e guarda o refresh token em .ml-token.json (fora do git).
//   npm run ml:auth            → mostra o link de autorização
//   npm run ml:auth -- <code>  → troca o código (ou a URL inteira do redirect) pelo token
// Lê ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REDIRECT_URI do .env.local. Nunca imprime segredos.
import { loadEnvLocal } from './lib/catalog-files.ts'
import { API, saveRefreshToken } from './lib/ml-api.ts'

loadEnvLocal()
const { ML_CLIENT_ID, ML_CLIENT_SECRET } = process.env
const redirectUri = process.env.ML_REDIRECT_URI || 'https://github.com/ThiagoBfim'
const input = process.argv[2]

const fail = (message: string) => {
  console.error(`✖ ${message}`)
  process.exit(1)
}

if (!ML_CLIENT_ID) fail('ML_CLIENT_ID vazio no .env.local.')

if (!input) {
  const url = new URL('https://auth.mercadolivre.com.br/authorization')
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: ML_CLIENT_ID!,
    redirect_uri: redirectUri,
  }).toString()
  console.log('1. Abra este link no navegador (logado no Mercado Livre) e autorize o app:\n')
  console.log(`   ${url.href}\n`)
  console.log(
    `2. Você vai cair em ${redirectUri}?code=TG-… — copie o endereço inteiro (ou só o código).`,
  )
  console.log('3. Rode: npm run ml:auth -- "<endereço ou código>"   (o código vale poucos minutos)')
} else {
  if (!ML_CLIENT_SECRET) fail('ML_CLIENT_SECRET vazio no .env.local.')
  const code = input.includes('code=') ? new URL(input).searchParams.get('code') : input.trim()
  if (!code) fail('Não achei o código (code=TG-…) no que foi informado.')

  const response = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: ML_CLIENT_ID!,
      client_secret: ML_CLIENT_SECRET!,
      code: code!,
      redirect_uri: redirectUri,
    }),
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok || typeof body.refresh_token !== 'string') {
    // Mostra só o erro da API (nunca tokens).
    fail(
      `Autorização recusada (${response.status}): ${body.error ?? ''} ${body.message ?? ''}`.trim(),
    )
  }
  saveRefreshToken(body.refresh_token as string)
  console.log('✔ App autorizado. Refresh token salvo em .ml-token.json (fora do git).')
  console.log('  Agora rode: npm run sync:ml')
}
