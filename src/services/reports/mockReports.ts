import type { ReportsBackend, BoundingBox, NewReport, Report } from './types'
import { DENY_THRESHOLD } from './types'
import { snapToRoad } from '../routing/snap'

// Een wegafsluiting wordt opgegeven met twee punten op de weg; de getoonde lijn
// (path) wordt aan het wegennet gesnapt via Valhalla, zodat hij de straat exact volgt.
// votes: per stemmer (apparaat-id) één stem → 5× door dezelfde persoon telt als 1.
interface RawReport extends Report {
  endpoints?: [{ lng: number; lat: number }, { lng: number; lat: number }]
  votes?: Record<string, boolean> // voterId → true (staat er nog) / false (weg)
}

// Voorbeeldmeldingen rond Purmerend, zodat Track B (B1) zichtbaar werkt zonder database.
const SAMPLE: RawReport[] = [
  { id: 'm1', type: 'rollerbank', lng: 4.9648, lat: 52.5081, createdAt: Date.now() - 5 * 60_000 },
  { id: 'm2', type: 'politie', lng: 4.9502, lat: 52.5108, createdAt: Date.now() - 12 * 60_000 },
  { id: 'm3', type: 'gevaarlijk_wegdek', lng: 4.9712, lat: 52.5008, createdAt: Date.now() - 40 * 60_000 },
  { id: 'm4', type: 'hulpdienst', lng: 4.9555, lat: 52.5024, createdAt: Date.now() - 3 * 60_000 },
  {
    id: 'm5',
    type: 'wegafsluiting',
    lng: 4.961, // middelpunt voor de 🚧-pin
    lat: 52.5124,
    createdAt: Date.now() - 90 * 60_000,
    endpoints: [
      { lng: 4.9555, lat: 52.5121 },
      { lng: 4.9665, lat: 52.5128 },
    ],
  },
  { id: 'm6', type: 'rollerbank', lng: 4.9483, lat: 52.5037, createdAt: Date.now() - 20 * 60_000 },
]

function within(r: RawReport, b: BoundingBox): boolean {
  return r.lng >= b.minLng && r.lng <= b.maxLng && r.lat >= b.minLat && r.lat <= b.maxLat
}

export class MockReportsBackend implements ReportsBackend {
  async getInBounds(bbox: BoundingBox): Promise<Report[]> {
    const inBounds = SAMPLE.filter((r) => within(r, bbox))

    for (const r of inBounds) {
      if (r.type === 'wegafsluiting' && !r.path && r.endpoints) {
        try {
          r.path = await snapToRoad(r.endpoints)
        } catch {
          /* snap mislukt — lijn verschijnt bij een volgende poll opnieuw */
        }
      }
    }

    return inBounds
  }

  async create(report: NewReport): Promise<Report> {
    const r: RawReport = {
      id: `m${Date.now()}`,
      createdAt: Date.now(),
      confirmations: 0,
      denials: 0,
      votes: {},
      ...report,
    }
    SAMPLE.push(r)
    return r
  }

  async confirm(id: string, stillThere: boolean, voterId: string): Promise<void> {
    const idx = SAMPLE.findIndex((r) => r.id === id)
    if (idx < 0) return
    const r = SAMPLE[idx]
    r.votes = r.votes ?? {}

    // Eén stem per voterId — opnieuw stemmen overschrijft, telt dus niet dubbel.
    r.votes[voterId] = stillThere

    const values = Object.values(r.votes)
    r.confirmations = values.filter((v) => v).length
    r.denials = values.filter((v) => !v).length

    if (r.denials >= DENY_THRESHOLD) SAMPLE.splice(idx, 1) // 5 verschillende "weg"-stemmen → weg
  }
}
