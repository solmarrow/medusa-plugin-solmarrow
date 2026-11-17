import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
  debug: false,
  auth: { type: "session" },
})

export type Status = {
  configured: boolean
  key_preview: string | null
  workspace: string | null
  product_url: string | null
  send_image: boolean
  problems: string[]
}

export type SendResult = {
  post_id: string
  calendar_url: string
  image: "added" | "skipped" | "none"
  link: boolean
}

export const APP_URL = "https://app.solmarrow.com"

export function errorMessage(e: unknown): string {
  const msg = (e as { message?: unknown })?.message
  return typeof msg === "string" && msg ? msg : "Something went wrong. Try again."
}
