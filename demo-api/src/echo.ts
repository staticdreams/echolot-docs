// /echo: small endpoints for learning the request editor (an httpbin of our own): see what was sent, pick a status,
// wait, follow redirects, set cookies, try Basic and Bearer auth, read XML and HTML.

import { json, problem, readText, sleep } from './http'

/** Headers Cloudflare adds on the way in; not what the person sent. */
const added = /^(cf-|x-forwarded-|x-real-ip$|cdn-loop$|true-client-ip$)/i

function sentHeaders(req: Request) {
  const headers: Record<string, string> = {}
  for (const [name, value] of req.headers) if (!added.test(name)) headers[name] = value
  return headers
}

async function described(req: Request) {
  const url = new URL(req.url)
  const text = await readText(req)
  if (text instanceof Response) return text
  const type = req.headers.get('content-type') ?? ''
  let body: unknown = text || null
  let form: Record<string, string> | undefined
  if (text && type.includes('json')) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  } else if (text && type.includes('application/x-www-form-urlencoded')) {
    form = Object.fromEntries(new URLSearchParams(text))
  }
  return {
    method: req.method,
    url: req.url,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: sentHeaders(req),
    ...(form ? { form } : { body }),
    bodyBytes: new TextEncoder().encode(text).byteLength,
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<catalog shop="Alpenglow" currency="CHF">
  <product sku="TNT-MH-2P" category="tents">
    <name>Matterhorn 2P Tent</name>
    <price>549</price>
    <stock warehouse="zurich">42</stock>
    <stock warehouse="bern">17</stock>
  </product>
  <product sku="PCK-TIT-30" category="packs">
    <name>Titlis 30L Pack</name>
    <price>149</price>
    <stock warehouse="zurich">64</stock>
    <stock warehouse="bern">38</stock>
  </product>
</catalog>
`

const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Alpenglow</title></head>
<body>
  <h1>Alpenglow</h1>
  <p>Outdoor gear from Zurich and Bern. This page is here for Echolot's HTML viewer.</p>
  <ul><li>Matterhorn 2P Tent: CHF 549</li><li>Titlis 30L Pack: CHF 149</li></ul>
</body>
</html>
`

export async function handleEcho(req: Request, path: string): Promise<Response> {
  const url = new URL(req.url)
  const [, kind = '', ...rest] = path.split('/') // path is "/<kind>/<rest…>" below /echo

  switch (kind) {
    case '':
    case 'anything': {
      const result = await described(req)
      return result instanceof Response ? result : json(result)
    }
    case 'headers':
      return json({ headers: sentHeaders(req) })
    case 'status': {
      const code = Number(rest[0])
      if (!Number.isInteger(code) || code < 200 || code > 599) return problem(400, 'Bad Request', 'Use /echo/status/<200…599>.')
      const headers: Record<string, string> = {}
      if (code >= 300 && code < 400) headers.Location = '/echo/anything'
      if (code === 401) headers['WWW-Authenticate'] = 'Basic realm="alpenglow"'
      if (code === 429 || code === 503) headers['Retry-After'] = '5'
      if (code === 204 || code === 304) return new Response(null, { status: code, headers })
      return json({ status: code }, code, headers)
    }
    case 'delay': {
      const seconds = Number(rest[0] ?? 1)
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 5) return problem(400, 'Bad Request', 'Use /echo/delay/<0…5> (seconds).')
      await sleep(seconds * 1000)
      const result = await described(req)
      return result instanceof Response ? result : json({ delayed: seconds, ...result })
    }
    case 'redirect': {
      const n = Number(rest[0] ?? 1)
      if (!Number.isInteger(n) || n < 1 || n > 10) return problem(400, 'Bad Request', 'Use /echo/redirect/<1…10>.')
      const next = n === 1 ? '/echo/anything' : `/echo/redirect/${n - 1}`
      return new Response(null, { status: 302, headers: { Location: next } })
    }
    case 'cookies': {
      const action = rest[0]
      if (action === 'set' || action === 'delete') {
        const headers = new Headers({ Location: '/echo/cookies' })
        for (const [name, value] of url.searchParams) {
          if (!/^[\w-]{1,64}$/.test(name)) continue
          headers.append(
            'Set-Cookie',
            action === 'set'
              ? `${name}=${encodeURIComponent(value.slice(0, 256))}; Path=/; Max-Age=3600; SameSite=Lax`
              : `${name}=; Path=/; Max-Age=0`,
          )
        }
        return new Response(null, { status: 302, headers })
      }
      const cookies = Object.fromEntries(
        (req.headers.get('cookie') ?? '')
          .split(';')
          .map((c) => c.trim().split('='))
          .filter(([name]) => name)
          .map(([name, ...value]) => [name, decodeURIComponent(value.join('='))]),
      )
      return json({ cookies })
    }
    case 'basic-auth': {
      const [user, password] = rest
      if (!user || !password) return problem(400, 'Bad Request', 'Use /echo/basic-auth/<user>/<password>.')
      const match = /^Basic\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')
      let given: string | undefined
      try {
        given = match ? atob(match[1]) : undefined
      } catch {
        given = undefined
      }
      if (given !== `${user}:${password}`)
        return problem(401, 'Unauthorized', 'Send Basic auth with the user and password in the path.', {}, { 'WWW-Authenticate': 'Basic realm="alpenglow"' })
      return json({ authenticated: true, user })
    }
    case 'bearer': {
      const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')
      if (!match) return problem(401, 'Unauthorized', 'Send Authorization: Bearer <any token>.', {}, { 'WWW-Authenticate': 'Bearer' })
      return json({ authenticated: true, token: match[1] })
    }
    case 'bytes': {
      const n = Number(rest[0] ?? 1024)
      if (!Number.isInteger(n) || n < 1 || n > 1_048_576) return problem(400, 'Bad Request', 'Use /echo/bytes/<1…1048576>.')
      const bytes = new Uint8Array(n)
      for (let at = 0; at < n; at += 65_536) crypto.getRandomValues(bytes.subarray(at, Math.min(at + 65_536, n)))
      return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } })
    }
    case 'xml':
      return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
    case 'html':
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    default:
      return problem(404, 'Not Found', `No /echo/${kind}. See GET / for the list.`)
  }
}

/** Endpoints that take time or bytes: counted against the stricter limit. */
export const isHeavyEcho = (path: string) => /^\/(delay|bytes)\//.test(path)
