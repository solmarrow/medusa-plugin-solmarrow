import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SOLMARROW_MODULE } from "../../../../../modules/solmarrow"
import type { Product } from "../../../../../modules/solmarrow/lib"
import type SolMarrowModuleService from "../../../../../modules/solmarrow/service"
import { sendError } from "../../errors"

/** POST /admin/solmarrow/products/:id: saves the product as a SolMarrow draft (admin only). */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const id = String(req.params.id ?? "")
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      res.status(400).json({ type: "invalid_data", message: "Unknown product." })
      return
    }
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "subtitle", "description", "handle", "thumbnail"],
      filters: { id },
    })
    const product = data?.[0] as Product | undefined
    if (!product) {
      res.status(404).json({ type: "not_found", message: "Product not found." })
      return
    }
    const service: SolMarrowModuleService = req.scope.resolve(SOLMARROW_MODULE)
    res.json(await service.sendProduct(product))
  } catch (e) {
    sendError(res, e)
  }
}
