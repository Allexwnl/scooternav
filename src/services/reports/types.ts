export type ReportType =
  | 'politie'
  | 'rollerbank'
  | 'hulpdienst'
  | 'gevaarlijk_wegdek'
  | 'wegafsluiting'

export interface Report {
  id: string
  type: ReportType
  lng: number // punt, of middelpunt bij een lijn-melding (voor pin/label)
  lat: number
  /** Alleen bij lijn-meldingen (wegafsluiting): de afgesloten stretch als [lng,lat][]. */
  path?: [number, number][]
  createdAt: number // epoch ms
  confirmations?: number // 👍 staat er nog
  denials?: number // 👎 weg / weer open
}

/** Zoveel "weg"-stemmen → de melding wordt automatisch verwijderd. */
export const DENY_THRESHOLD = 5

export interface BoundingBox {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

export interface NewReport {
  type: ReportType
  lng: number
  lat: number
  path?: [number, number][]
}

/**
 * DE swap-laag. Dit is de enige interface die de rest van de app kent.
 * De mock- en api-backends (je eigen server) zijn slechts implementaties hiervan.
 * Backend wisselen = één adapter omzetten, niet de app herschrijven.
 *
 * Bewust geen realtime hier: meldingen halen we op via polling (getInBounds).
 */
export interface ReportsBackend {
  /** Meldingen binnen een gebied ophalen (polling, ~elke 15-30s of bij kaartbeweging). */
  getInBounds(bbox: BoundingBox): Promise<Report[]>

  /** Nieuwe melding plaatsen. */
  create(report: NewReport): Promise<Report>

  /**
   * Bevestigen of een melding er nog staat ("staat het er nog?" 👍/👎).
   * voterId zorgt dat één gebruiker maar één keer telt (geen 5× door dezelfde persoon).
   */
  confirm(id: string, stillThere: boolean, voterId: string): Promise<void>
}
