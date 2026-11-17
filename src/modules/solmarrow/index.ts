import { Module } from "@medusajs/framework/utils"
import SolMarrowModuleService from "./service"

export const SOLMARROW_MODULE = "solmarrow"

export default Module(SOLMARROW_MODULE, {
  service: SolMarrowModuleService,
})
