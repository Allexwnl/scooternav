import type { RoutingBackend } from './types'
import { ValhallaRouting } from './valhalla'

/** Eén plek die bepaalt welke route-engine we gebruiken. Nu: Valhalla. */
export function createRoutingBackend(): RoutingBackend {
  return new ValhallaRouting()
}

export { snapToRoad } from './snap'
export { cyclewayTransitions } from './valhalla'
export type { RoutingBackend, Route, LngLat, Plate } from './types'
