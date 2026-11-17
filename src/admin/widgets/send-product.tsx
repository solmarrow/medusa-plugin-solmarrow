import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useState } from "react"
import { Link } from "react-router-dom"
import { APP_URL, SendResult, errorMessage, sdk } from "../lib/sdk"

const SendProductWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)

  const send = async () => {
    setSending(true)
    setResult(null)
    try {
      const out = await sdk.client.fetch<SendResult>(`/admin/solmarrow/products/${encodeURIComponent(data.id)}`, { method: "POST" })
      setResult(out)
      if (out.image === "skipped") toast.warning("Draft saved without the image", { description: "SolMarrow can only fetch images from a public https address." })
      else toast.success("Draft saved in SolMarrow")
    } catch (e) {
      toast.error("Not sent", { description: errorMessage(e) })
    } finally {
      setSending(false)
    }
  }

  const calendar = result?.calendar_url?.startsWith(APP_URL) ? result.calendar_url : `${APP_URL}/calendar`

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">SolMarrow</Heading>
      </div>
      <div className="flex flex-col gap-y-3 px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Save this product as a social media draft. Pick accounts and schedule it in SolMarrow.
        </Text>
        <Button size="small" variant="secondary" onClick={send} isLoading={sending} disabled={sending}>
          Send to SolMarrow
        </Button>
        {result && (
          <Text size="small">
            <a href={calendar} target="_blank" rel="noopener noreferrer" className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover">
              Open the draft in SolMarrow
            </a>
          </Text>
        )}
        <Text size="xsmall" className="text-ui-fg-muted">
          <Link to="/settings/solmarrow" className="hover:text-ui-fg-subtle">
            SolMarrow settings
          </Link>
        </Text>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
})

export default SendProductWidget
