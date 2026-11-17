import type { MedusaResponse } from "@medusajs/framework/http"
import { SolMarrowError } from "../../../modules/solmarrow/lib"

/** Sends a clean JSON error. Unknown errors never leak details. */
export function sendError(res: MedusaResponse, e: unknown): void {
  if (e instanceof SolMarrowError) {
    res.status(e.status).json({ type: "solmarrow_error", message: e.message })
    return
  }
  res.status(500).json({ type: "unknown_error", message: "Something went wrong while talking to SolMarrow." })
}
