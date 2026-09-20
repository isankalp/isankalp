/**
 * A thin client for calling the Claude API directly from the browser with the user's own key
 * (Epic 58: bring-your-own-key). `anthropic-dangerous-direct-browser-access` is Anthropic's own
 * documented header for exactly this pattern — a personal API key used only by its owner, never
 * proxied through a server this app doesn't have.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-5'
const ANTHROPIC_VERSION = '2023-06-01'
const REQUEST_TIMEOUT_MS = 30_000

export type ClaudeErrorKind = 'invalid_key' | 'rate_limited' | 'unavailable' | 'network' | 'unknown'

export interface ClaudeError {
  kind: ClaudeErrorKind
  message: string
}

export type ClaudeResult<T> = { ok: true; data: T } | { ok: false; error: ClaudeError }

/** AK-7: rate limit / outage messaging is deliberately uniform across every AI feature. */
const UNAVAILABLE_MESSAGE = 'AI temporarily unavailable — try again shortly'

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }

interface RawResponse {
  content: Array<{ type: string; text?: string; name?: string; input?: unknown }>
}

async function callClaude(apiKey: string, body: Record<string, unknown>): Promise<ClaudeResult<RawResponse>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: MODEL, ...body }),
      signal: controller.signal,
    })
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError'
    return {
      ok: false,
      error: timedOut
        ? { kind: 'network', message: UNAVAILABLE_MESSAGE }
        : { kind: 'network', message: "Couldn't reach the AI service — check your connection and try again." },
    }
  } finally {
    clearTimeout(timeout)
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: { kind: 'invalid_key', message: 'Key invalid or rejected' } }
  }
  if (res.status === 429) {
    return { ok: false, error: { kind: 'rate_limited', message: UNAVAILABLE_MESSAGE } }
  }
  if (res.status >= 500) {
    return { ok: false, error: { kind: 'unavailable', message: UNAVAILABLE_MESSAGE } }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, error: { kind: 'unknown', message: text.slice(0, 300) || `Request failed (${res.status})` } }
  }
  const json = (await res.json()) as RawResponse
  return { ok: true, data: json }
}

/** AK-2: a minimal, cheap call used purely to confirm the key is accepted. */
export async function validateApiKey(apiKey: string): Promise<ClaudeResult<true>> {
  const result = await callClaude(apiKey, { max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] })
  if (!result.ok) return result
  return { ok: true, data: true }
}

export async function generateText(
  apiKey: string,
  opts: { system?: string; messages: ClaudeMessage[]; maxTokens?: number },
): Promise<ClaudeResult<string>> {
  const result = await callClaude(apiKey, {
    system: opts.system,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 1024,
  })
  if (!result.ok) return result
  const text = result.data.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
  return { ok: true, data: text }
}

/** Forces a structured JSON response matching `inputSchema` via tool-use, rather than parsing free text. */
export async function generateStructured<T>(
  apiKey: string,
  opts: {
    system?: string
    messages: ClaudeMessage[]
    toolName: string
    toolDescription: string
    inputSchema: Record<string, unknown>
    maxTokens?: number
  },
): Promise<ClaudeResult<T>> {
  const result = await callClaude(apiKey, {
    system: opts.system,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 2048,
    tools: [{ name: opts.toolName, description: opts.toolDescription, input_schema: opts.inputSchema }],
    tool_choice: { type: 'tool', name: opts.toolName },
  })
  if (!result.ok) return result
  const toolUse = result.data.content.find((b) => b.type === 'tool_use' && b.name === opts.toolName)
  if (!toolUse) {
    return { ok: false, error: { kind: 'unknown', message: "The AI didn't return the expected structured response." } }
  }
  return { ok: true, data: toolUse.input as T }
}
