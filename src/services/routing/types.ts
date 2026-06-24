export type Plate = 'blauw' | 'geel'

export interface LngLat {
  lng: number
  lat: number
}

export interface RouteStep {
  text: string // instructie, bv. "Sla rechtsaf op de Hoofdstraat"
  lng: number
  lat: number
}

export interface Route {
  coordinates: [number, number][] // [lng, lat] — klaar voor MapLibre
  distanceKm: number
  durationMin: number
  steps: RouteStep[] // turn-by-turn instructies
}

/**
 * Eén interface voor routeberekening. Nu: Valhalla.
 * Een andere engine (OSRM, GraphHopper) zou dezelfde interface implementeren.
 */
export interface RoutingBackend {
  /**
   * Bereken tot 3 routes (snelste + alternatieven) voor het gekozen kenteken.
   * avoidPaths = wegafsluiting-lijnen die vermeden moeten worden (exclude_polygons).
   */
  route(
    from: LngLat,
    to: LngLat,
    plate: Plate,
    avoidPaths?: [number, number][][],
  ): Promise<Route[]>

  /** Eén route via tussenpunten — gebruikt om rond een afsluiting heen te sturen. */
  routeVia(points: LngLat[], plate: Plate, avoidPaths?: [number, number][][]): Promise<Route[]>
}
