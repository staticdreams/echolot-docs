// Responses with the headers a real API sends, and RFC 9457 problem details for errors.

export const MAX_BODY = 64 * 1024

export function requestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return `req_${[...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14).toUpperCase()}`
}

export const commonHeaders = (): Record<string, string> => ({
  'X-Request-Id': requestId(),
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'X-Request-Id, X-Total-Count, Link, Location, RateLimit-Policy, Retry-After, ETag',
})

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

export function problem(status: number, title: string, detail?: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return new Response(`${JSON.stringify({ type: 'about:blank', title, status, ...(detail ? { detail } : {}), ...extra }, null, 2)}\n`, {
    status,
    headers: { 'Content-Type': 'application/problem+json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

export const notFound = (what = 'Nothing here') => problem(404, 'Not Found', what, { docs: 'https://docs.echolot.dev/docs/tutorials/demo-api' })

export const methodNotAllowed = (allow: string[]) =>
  problem(405, 'Method Not Allowed', `Use ${allow.join(' or ')}.`, {}, { Allow: allow.join(', ') })

/** The body as text, refusing more than MAX_BODY bytes (413) before reading it all. */
export async function readText(req: Request): Promise<string | Response> {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY) return problem(413, 'Content Too Large', `The demo takes bodies up to ${MAX_BODY / 1024} KB.`)
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY) {
      await reader.cancel()
      return problem(413, 'Content Too Large', `The demo takes bodies up to ${MAX_BODY / 1024} KB.`)
    }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    all.set(c, at)
    at += c.byteLength
  }
  return new TextDecoder().decode(all)
}

/** A JSON body, or a 400 problem saying what is wrong with it. */
export async function readJSON<T = unknown>(req: Request): Promise<T | Response> {
  const text = await readText(req)
  if (text instanceof Response) return text
  if (!text.trim()) return problem(400, 'Bad Request', 'The body is empty; this endpoint takes JSON.')
  try {
    return JSON.parse(text) as T
  } catch (error) {
    return problem(400, 'Bad Request', `The body is not valid JSON: ${(error as Error).message}`)
  }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
