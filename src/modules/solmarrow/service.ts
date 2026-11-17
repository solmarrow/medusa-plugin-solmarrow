import { randomUUID } from "node:crypto"
import {
  PluginOptions,
  Product,
  Requester,
  SolMarrowError,
  Workspace,
  createDraft,
  isApiKey,
  keyPreview,
  keyWorkspace,
  productToText,
  productUrlProblem,
  publicImageUrl,
  uploadImage,
} from "./lib"

const TIMEOUT_MS = 20_000
const WORKSPACE_TTL_MS = 10 * 60_000

const fetchRequester: Requester = async (req) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body, signal: ctrl.signal })
    const raw = await res.text()
    let json: unknown = null
    try {
      json = raw ? JSON.parse(raw) : null
    } catch {
      json = null
    }
    return { status: res.status, json }
  } catch {
    throw new SolMarrowError("Could not reach SolMarrow. Check the server's internet connection and try again.", 502)
  } finally {
    clearTimeout(timer)
  }
}

export interface StatusResult {
  configured: boolean
  key_preview: string | null
  workspace: string | null
  product_url: string | null
  send_image: boolean
  problems: string[]
}

export interface SendResult {
  post_id: string
  calendar_url: string
  image: "added" | "skipped" | "none"
  link: boolean
}

export default class SolMarrowModuleService {
  protected readonly options: PluginOptions
  protected request: Requester = fetchRequester
  private cached: { key: string; workspace: Workspace; at: number } | null = null

  constructor(_container: Record<string, unknown>, options: PluginOptions = {}) {
    this.options = {
      apiKey: typeof options.apiKey === "string" ? options.apiKey.trim() : undefined,
      productUrl: typeof options.productUrl === "string" ? options.productUrl.trim() : undefined,
      sendImage: options.sendImage !== false,
    }
  }

  private async workspace(): Promise<Workspace> {
    const key = this.options.apiKey ?? ""
    if (this.cached && this.cached.key === key && Date.now() - this.cached.at < WORKSPACE_TTL_MS) return this.cached.workspace
    const workspace = await keyWorkspace(this.request, key)
    this.cached = { key, workspace, at: Date.now() }
    return workspace
  }

  /** What the settings page shows. Never returns the key itself. */
  async status(): Promise<StatusResult> {
    const { apiKey, productUrl, sendImage } = this.options
    const problems: string[] = []
    const urlProblem = productUrl ? productUrlProblem(productUrl) : null
    if (urlProblem) problems.push(urlProblem)
    let workspace: string | null = null
    try {
      workspace = (await this.workspace()).name
    } catch (e) {
      problems.unshift((e as Error).message)
    }
    return {
      configured: !!workspace,
      key_preview: apiKey && isApiKey(apiKey) ? keyPreview(apiKey) : null,
      workspace,
      product_url: productUrl && !urlProblem ? productUrl : null,
      send_image: sendImage !== false,
      problems,
    }
  }

  /** Saves one product as a SolMarrow draft. */
  async sendProduct(product: Product): Promise<SendResult> {
    const apiKey = this.options.apiKey ?? ""
    const workspace = await this.workspace()
    const { text, link } = productToText(product, this.options.productUrl)
    if (!text.trim()) throw new SolMarrowError("This product has no title or description to send.")

    let image: SendResult["image"] = "none"
    const media: string[] = []
    const imageUrl = this.options.sendImage !== false ? publicImageUrl(product.thumbnail) : null
    if (this.options.sendImage !== false && product.thumbnail) image = "skipped"
    if (imageUrl) {
      try {
        const id = await uploadImage(this.request, apiKey, workspace.id, imageUrl)
        if (id) {
          media.push(id)
          image = "added"
        }
      } catch {
        // The draft still goes in without its image.
      }
    }

    const draft = await createDraft(this.request, apiKey, workspace.id, text, media, `medusa-${product.id}-${randomUUID()}`)
    return { post_id: draft.postId, calendar_url: draft.calendarUrl, image, link: !!link }
  }
}
