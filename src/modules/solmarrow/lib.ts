// Pure logic: no Medusa imports, so it can be tested with plain node.

export const API_URL = "https://app.solmarrow.com/api/v1"
export const APP_URL = "https://app.solmarrow.com"

/** Longest excerpt taken from a product; the draft is edited in SolMarrow anyway. */
export const EXCERPT_MAX = 280

export interface PluginOptions {
  /** SolMarrow API key (smk_...). Read it from an environment variable. */
  apiKey?: string
  /** Public product page, e.g. https://shop.example.com/products/{handle}. */
  productUrl?: string
  /** Attach the product thumbnail to the draft (default true). */
  sendImage?: boolean
}

export interface Product {
  id: string
  title?: string | null
  subtitle?: string | null
  description?: string | null
  handle?: string | null
  thumbnail?: string | null
}

export interface HttpRequest {
  url: string
  method: "GET" | "POST"
  headers: Record<string, string>
  body?: string
}
export interface HttpResponse {
  status: number
  json: unknown
}
export type Requester = (req: HttpRequest) => Promise<HttpResponse>

export class SolMarrowError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

export function isApiKey(value: unknown): value is string {
  return typeof value === "string" && /^smk_[A-Za-z0-9_-]{20,}$/.test(value.trim())
}

/** "smk_…a1b2": enough to recognise a key, never enough to use it. */
export function keyPreview(key: string): string {
  return `smk_…${key.trim().slice(-4)}`
}

/** The product URL template must be https and may use {handle} and {id}. */
export function productUrlProblem(template: string): string | null {
  const t = template.trim()
  if (!t) return null
  if (t.length > 500) return "productUrl is too long (500 characters at most)."
  if (!/^https:\/\/[^\s{}/]+/i.test(t)) return "productUrl must start with https:// and a domain."
  if (/\s/.test(t)) return "productUrl cannot contain spaces."
  if (!/^(?:[^{}]|\{(?:handle|id)\})*$/.test(t)) return "productUrl can only use the placeholders {handle} and {id}."
  return null
}

/** Reads a nested string or number from an unknown JSON value. */
export function pick(value: unknown, ...path: string[]): string | null {
  let cur: unknown = value
  for (const key of path) {
    if (typeof cur !== "object" || cur === null) return null
    cur = (cur as Record<string, unknown>)[key]
  }
  return typeof cur === "string" || typeof cur === "number" ? String(cur) : null
}

/** Plain text from HTML or Markdown (product descriptions may hold either). */
export function markupToText(value: string): string {
  return value
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/`{1,3}/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Cuts at a word boundary and adds "…" when the text is longer than max. */
export function shorten(text: string, max = EXCERPT_MAX): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`
}

/** The public product link, or null when there is no template or the product has no handle. */
export function productLink(template: string | undefined, product: Product): string | null {
  const t = (template ?? "").trim()
  if (!t || productUrlProblem(t)) return null
  let missing = false
  const out = t.replace(/\{(handle|id)\}/g, (_, name: "handle" | "id") => {
    const v = (product[name] ?? "").trim()
    if (!v) missing = true
    return encodeURIComponent(v)
  })
  return missing ? null : out
}

export interface DraftText {
  text: string
  link: string | null
}

/** The post text for one product: title, a short excerpt (subtitle, else description) and the product link. */
export function productToText(product: Product, productUrl?: string): DraftText {
  const title = shorten(product.title ?? "", 200)
  const subtitle = shorten(product.subtitle ?? "")
  const description = shorten(markupToText(product.description ?? ""))
  const excerpt = subtitle && subtitle !== title ? subtitle : description !== title ? description : ""
  const link = productLink(productUrl, product)
  return { text: [title, excerpt, link].filter(Boolean).join("\n\n"), link }
}

/** Only public https images can be fetched by SolMarrow. */
export function publicImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== "https:") return null
  const h = u.hostname.toLowerCase()
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/.test(h) || !h.includes(".")) return null
  return u.toString()
}

export interface Workspace {
  id: string
  name: string
}

const authHeaders = (apiKey: string) => ({ Authorization: `Bearer ${apiKey.trim()}`, Accept: "application/json" })

function statusError(status: number, json: unknown): SolMarrowError {
  if (status === 401) return new SolMarrowError("SolMarrow did not accept the API key. Check SOLMARROW_API_KEY.", 400)
  if (status === 403 || status === 404) return new SolMarrowError("SolMarrow could not find the workspace for this key. Create a new key in SolMarrow.", 400)
  if (status === 429) return new SolMarrowError("SolMarrow says too many requests. Wait a minute and try again.", 429)
  const msg = pick(json, "error", "message") || pick(json, "message")
  return new SolMarrowError(`SolMarrow said (${status}): ${msg || "no details"}`, 502)
}

const NO_KEY = "Add your SolMarrow API key to the plugin options (SOLMARROW_API_KEY) and restart Medusa."

/** The workspace an API key belongs to (a key is made for exactly one workspace). */
export async function keyWorkspace(request: Requester, apiKey: string | undefined): Promise<Workspace> {
  if (!apiKey?.trim()) throw new SolMarrowError(NO_KEY)
  if (!isApiKey(apiKey)) throw new SolMarrowError("The apiKey option is not a SolMarrow API key. It starts with smk_.")
  const res = await request({ url: `${API_URL}/workspaces`, method: "GET", headers: authHeaders(apiKey) })
  if (res.status < 200 || res.status >= 300) throw statusError(res.status, res.json)
  const list = typeof res.json === "object" && res.json !== null ? (res.json as Record<string, unknown>).workspaces : null
  const first = Array.isArray(list) ? list[0] : null
  const id = pick(first, "id")
  if (!id) throw new SolMarrowError("SolMarrow did not return a workspace for this key.", 502)
  return { id, name: pick(first, "name") || "Workspace" }
}

/** Uploads a public image to SolMarrow. Returns its media ID, or null if SolMarrow could not take it. */
export async function uploadImage(request: Requester, apiKey: string, workspaceId: string, imageUrl: string): Promise<string | null> {
  const res = await request({
    url: `${API_URL}/workspaces/${encodeURIComponent(workspaceId)}/media/from-url`,
    method: "POST",
    headers: { ...authHeaders(apiKey), "Content-Type": "application/json" },
    body: JSON.stringify({ url: imageUrl }),
  })
  if (res.status < 200 || res.status >= 300) return null
  return pick(res.json, "media_id") || pick(res.json, "id")
}

export interface DraftResult {
  postId: string
  calendarUrl: string
}

/** Saves one draft (no accounts, nothing scheduled or published). */
export async function createDraft(request: Requester, apiKey: string, workspaceId: string, text: string, mediaIds: string[], idempotencyKey: string): Promise<DraftResult> {
  if (!isApiKey(apiKey)) throw new SolMarrowError(NO_KEY)
  if (!text.trim()) throw new SolMarrowError("This product has no title or description to send.")
  const res = await request({
    url: `${API_URL}/workspaces/${encodeURIComponent(workspaceId)}/posts`,
    method: "POST",
    headers: { ...authHeaders(apiKey), "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.slice(0, 200) },
    body: JSON.stringify({ text, account_ids: [], media_ids: mediaIds, draft: true }),
  })
  if (res.status < 200 || res.status >= 300) throw statusError(res.status, res.json)
  const postId = pick(res.json, "post_id") || pick(res.json, "id")
  if (!postId) throw new SolMarrowError("SolMarrow saved the draft but did not return its ID.", 502)
  const url = pick(res.json, "calendar_url")
  return { postId, calendarUrl: url && url.startsWith(APP_URL) ? url : `${APP_URL}/calendar` }
}
