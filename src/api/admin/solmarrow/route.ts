import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SOLMARROW_MODULE } from "../../../modules/solmarrow"
import type SolMarrowModuleService from "../../../modules/solmarrow/service"
import { sendError } from "./errors"

/** GET /admin/solmarrow: connection status for the settings page (admin only; never returns the key). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: SolMarrowModuleService = req.scope.resolve(SOLMARROW_MODULE)
    res.json(await service.status())
  } catch (e) {
    sendError(res, e)
  }
}
