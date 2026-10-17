import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-api-workspace-controller'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
import { internals } from '@deepseek-ai/dsh-web-app'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

export const name = 'api'
export const inject = ['webServer', 'workspaceController', 'sessionController', 'connection']

const OPEN_ROUTE = '/api/open'
const LAUNCH_ROUTE = '/api/launch'
const LOOPBACK = '127.0.0.1'
const MAX_BODY_BYTES = 64 * 1024
const HANDOFF_TTL_MS = 5 * 60 * 1000
const SELECTION_KEY = 'dsh.sessions.current'

type Handoff = {
  readonly sessionId: string
  readonly url: string
  readonly expires: number
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function sendError(res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { error: { code, message } })
}

function loopbackUrl(ctx: Context): string {
  return `http://${LOOPBACK}:${String(ctx.webServer.port)}`
}

async function readText(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error(`request body exceeds ${MAX_BODY_BYTES} bytes`)
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function requestedPath(req: IncomingMessage): Promise<string | undefined> {
  if (req.method === 'GET') {
    return new URL(req.url ?? '/', 'http://localhost').searchParams.get('path')?.trim() || undefined
  }
  const text = (await readText(req)).trim()
  if (text === '') return undefined
  if (!text.startsWith('{')) return text
  const body = JSON.parse(text) as unknown
  if (typeof body !== 'object' || body === null || !('path' in body) || typeof body.path !== 'string') {
    throw new TypeError('JSON body must be {"path":"<absolute directory>"}')
  }
  return body.path.trim() || undefined
}

async function requirePath(req: IncomingMessage, res: ServerResponse): Promise<string | undefined> {
  let path: string | undefined
  try {
    path = await requestedPath(req)
  } catch (error) {
    sendError(res, 400, 'api/bad-request', errorMessage(error))
    return undefined
  }
  if (path === undefined) {
    sendError(res, 400, 'api/bad-request', 'provide an absolute directory as "path" in the JSON body or the query string')
    return undefined
  }
  return path
}

function rejectMethod(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method === 'GET' || req.method === 'POST') return false
  res.writeHead(405, { allow: 'GET, POST' })
  res.end()
  return true
}

export function apply(ctx: Context) {
  const handoffs = new Map<string, Handoff>()

  const serveHandoff = (nonce: string, res: ServerResponse): void => {
    const handoff = handoffs.get(nonce)
    handoffs.delete(nonce)
    if (handoff === undefined || handoff.expires <= Date.now()) {
      res.writeHead(410, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      })
      res.end('<!doctype html><meta charset="utf-8"><title>DeepSeek Harness launch expired</title><p>This launch link has expired or was already used. Call the API again.</p>')
      return
    }
    const sessionId = JSON.stringify(handoff.sessionId).replaceAll('<', '\\u003c')
    const target = JSON.stringify(handoff.url).replaceAll('<', '\\u003c')
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    })
    res.end(`<!doctype html><meta charset="utf-8"><title>Opening DeepSeek Harness</title><script>try{localStorage.setItem(${JSON.stringify(SELECTION_KEY)},JSON.stringify({sessionId:${sessionId}}))}catch{}location.replace(${target})</script>`)
  }

  const handleOpen = async (req: IncomingMessage, res: ServerResponse) => {
    if (rejectMethod(req, res)) return
    const url = loopbackUrl(ctx)
    try {
      await internals.openBrowser(ctx.connection.authenticatedUrl(url))
      sendJson(res, 200, { opened: true, url })
    } catch (error) {
      sendError(res, 500, 'api/open-failed', errorMessage(error))
    }
  }

  const handleLaunch = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET') {
      const nonce = new URL(req.url ?? '/', 'http://localhost').searchParams.get('nonce')
      if (nonce !== null) {
        serveHandoff(nonce, res)
        return
      }
    }
    if (rejectMethod(req, res)) return
    const path = await requirePath(req, res)
    if (path === undefined) return
    let registration: Awaited<ReturnType<typeof ctx.workspaceController.create>>
    try {
      registration = await ctx.workspaceController.create({ path })
    } catch (error) {
      const failure = remoteErrorOf(error)
      sendError(res, failure === undefined ? 500 : 400, failure?.code ?? 'api/internal', errorMessage(error))
      return
    }
    let session: Awaited<ReturnType<typeof ctx.sessionController.create>>
    try {
      session = await ctx.sessionController.create({ workspaceId: registration.workspace.workspaceId })
    } catch (error) {
      const failure = remoteErrorOf(error)
      sendError(res, failure === undefined ? 500 : 400, failure?.code ?? 'api/session-failed', errorMessage(error))
      return
    }
    const created = registration.created
    let workspace = registration.workspace
    try {
      workspace = (await ctx.workspaceController.create({ path })).workspace
    } catch {}
    const url = loopbackUrl(ctx)
    const nonce = randomUUID()
    const now = Date.now()
    for (const [key, handoff] of handoffs) if (handoff.expires <= now) handoffs.delete(key)
    handoffs.set(nonce, {
      sessionId: session.sessionId,
      url: ctx.connection.authenticatedUrl(url),
      expires: now + HANDOFF_TTL_MS,
    })
    let openError: string | undefined
    try {
      await internals.openBrowser(`${url}${LAUNCH_ROUTE}?nonce=${encodeURIComponent(nonce)}`)
    } catch (error) {
      openError = errorMessage(error)
      handoffs.delete(nonce)
    }
    sendJson(res, 200, {
      created,
      workspace,
      session,
      opened: openError === undefined,
      url,
      ...(openError === undefined ? {} : { error: { code: 'api/open-failed', message: openError } }),
    })
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: OPEN_ROUTE, handler: handleOpen }), 'api: open route')
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: LAUNCH_ROUTE, handler: handleLaunch }), 'api: launch route')
}
