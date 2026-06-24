export interface Position {
  lng: number
  lat: number
  accuracy?: number
  heading?: number | null
  speed?: number | null
}

export type PositionCallback = (pos: Position) => void
export type PositionErrorCallback = (err: Error) => void

/**
 * Eén interface voor "waar ben ik?". De web-variant gebruikt de browser-GPS;
 * later komt er een Capacitor-variant met exact dezelfde methodes (native GPS).
 */
export interface LocationProvider {
  /** Start het volgen van de positie. Geeft een functie terug om te stoppen. */
  watch(onPos: PositionCallback, onErr?: PositionErrorCallback): () => void
}
