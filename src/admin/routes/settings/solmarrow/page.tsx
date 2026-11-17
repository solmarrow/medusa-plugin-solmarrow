import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { Status, errorMessage, sdk } from "../../../lib/sdk"

const README = "https://github.com/solmarrow/medusa-plugin-solmarrow#readme"

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-2 items-center px-6 py-4">
    <Text size="small" weight="plus" leading="compact">
      {label}
    </Text>
    <Text size="small" leading="compact" className="text-ui-fg-subtle break-all">
      {children}
    </Text>
  </div>
)

const SolMarrowSettingsPage = () => {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setStatus(await sdk.client.fetch<Status>("/admin/solmarrow"))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">SolMarrow</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Send products to SolMarrow as social media drafts.
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={load} isLoading={loading}>
          Check again
        </Button>
      </div>
      {error && (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-error">{error}</Text>
        </div>
      )}
      {status && (
        <>
          <Row label="Connection">
            {status.configured ? <Badge color="green" size="2xsmall">Connected</Badge> : <Badge color="red" size="2xsmall">Not connected</Badge>}
          </Row>
          <Row label="Workspace">{status.workspace ?? "–"}</Row>
          <Row label="API key">{status.key_preview ?? "Not set"}</Row>
          <Row label="Product link">{status.product_url ?? "Not set (drafts are saved without a link)"}</Row>
          <Row label="Product image">{status.send_image ? "Added when it has a public https address" : "Off"}</Row>
          {status.problems.length > 0 && (
            <div className="px-6 py-4">
              {status.problems.map((p) => (
                <Text key={p} size="small" className="text-ui-fg-error">{p}</Text>
              ))}
            </div>
          )}
        </>
      )}
      <div className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          The API key and options are set in <code>medusa-config.ts</code>, so they never reach the browser.{" "}
          <a href={README} target="_blank" rel="noopener noreferrer" className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover">
            Setup guide
          </a>
        </Text>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "SolMarrow",
})

export default SolMarrowSettingsPage
