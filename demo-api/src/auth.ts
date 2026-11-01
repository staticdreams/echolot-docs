// Sign-in for the demo shop: HS256 JWTs, valid for an hour. The credentials are public (they are in the docs);
// the tokens only unlock Heidi's demo orders, which are the same for everyone.

import { demoClient, demoPassword, user } from './catalog'
import { problem } from './http'

const encoder = new TextEncoder()
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromBase64url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

const keys = new Map<string, Promise<CryptoKey>>()
function key(secret: string) {
  let found = keys.get(secret)
  if (!found) {
    found = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
    keys.set(secret, found)
  }
  return found
}

export const TOKEN_LIFETIME = 3600
export const ISSUER = 'https://demo.echolot.dev'

export async function issueToken(secret: string, subject: 'user' | 'client', now = Math.floor(Date.now() / 1000)) {
  const header = base64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const claims =
    subject === 'user'
      ? { iss: ISSUER, sub: user.id, email: user.email, name: user.name, scope: 'orders:read orders:write', iat: now, exp: now + TOKEN_LIFETIME }
      : { iss: ISSUER, sub: demoClient.id, scope: 'catalog:read orders:read', iat: now, exp: now + TOKEN_LIFETIME }
  const payload = base64url(encoder.encode(JSON.stringify(claims)))
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(`${header}.${payload}`)))
  return `${header}.${payload}.${base64url(signature)}`
}

export type Claims = { sub: string; scope: string; exp: number; email?: string }

/** The token's claims, or the 401 to answer with. */
export async function authenticate(req: Request, secret: string): Promise<Claims | Response> {
  const challenge = { 'WWW-Authenticate': 'Bearer realm="alpenglow", error="invalid_token"' }
  const header = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  if (!match)
    return problem(
      401,
      'Unauthorized',
      'Send an access token: Authorization: Bearer <token>. Get one with POST /v1/auth/token.',
      {},
      { 'WWW-Authenticate': 'Bearer realm="alpenglow"' },
    )
  const parts = match[1].split('.')
  if (parts.length !== 3) return problem(401, 'Unauthorized', 'The token is not a JWT.', {}, challenge)
  try {
    const valid = await crypto.subtle.verify('HMAC', await key(secret), fromBase64url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`))
    if (!valid) return problem(401, 'Unauthorized', 'The token signature does not match.', {}, challenge)
    const claims = JSON.parse(new TextDecoder().decode(fromBase64url(parts[1]))) as Claims
    if (claims.exp < Date.now() / 1000) return problem(401, 'Unauthorized', 'The token has expired; sign in again.', {}, challenge)
    return claims
  } catch {
    return problem(401, 'Unauthorized', 'The token could not be read.', {}, challenge)
  }
}

/** POST /v1/auth/token: JSON {email, password}, or an OAuth 2 client-credentials form. */
export async function tokenEndpoint(req: Request, body: string, secret: string) {
  const type = req.headers.get('content-type') ?? ''
  const token = (access_token: string, scope: string) => ({ access_token, token_type: 'Bearer', expires_in: TOKEN_LIFETIME, scope })
  if (type.includes('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(body)
    // Client credentials may come in the form or as Basic auth (RFC 6749 section 2.3.1).
    let id = form.get('client_id')
    let clientSecret = form.get('client_secret')
    const basic = /^Basic\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')
    if (basic) {
      const [u, p] = atob(basic[1]).split(':')
      id = decodeURIComponent(u ?? '')
      clientSecret = decodeURIComponent(p ?? '')
    }
    if (form.get('grant_type') !== 'client_credentials')
      return Response.json({ error: 'unsupported_grant_type', error_description: 'The demo supports grant_type=client_credentials.' }, { status: 400 })
    if (id !== demoClient.id || clientSecret !== demoClient.secret)
      return Response.json({ error: 'invalid_client', error_description: `Use client_id ${demoClient.id} and client_secret ${demoClient.secret}.` }, { status: 401 })
    return Response.json(token(await issueToken(secret, 'client'), 'catalog:read orders:read'), { headers: { 'Cache-Control': 'no-store' } })
  }
  let credentials: { email?: string; password?: string }
  try {
    credentials = JSON.parse(body)
  } catch {
    return problem(400, 'Bad Request', 'Send JSON {"email": …, "password": …}, or an OAuth 2 client-credentials form.')
  }
  if (credentials.email?.toLowerCase() !== user.email || credentials.password !== demoPassword)
    return problem(401, 'Unauthorized', `Wrong email or password. The demo account is ${user.email} with the password ${demoPassword}.`)
  return Response.json(token(await issueToken(secret, 'user'), 'orders:read orders:write'), { headers: { 'Cache-Control': 'no-store' } })
}
