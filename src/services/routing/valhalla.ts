import type { RoutingBackend, Route, LngLat, Plate } from './types'
import { decodePolyline } from './polyline'
import { bufferPolygon } from './avoid'
import { VALHALLA_URL } from '../../config'
import { settings } from '../../stores/settings'

function narrativeLanguage(): string {
  return settings.locale === 'en' ? 'en-US' : 'nl-NL'
}

// Profiel per kenteken — al een realistischere benadering (Fase 2):
// - geel (bromfiets): motor_scooter, top 45 km/u, vermijdt snelwegen (inherent).
// - blauw (snorfiets): bicycle-profiel zodat fietspaden meetellen, ~25 km/u.
interface PlateProfile {
  costing: string
  costing_options: Record<string, Record<string, unknown>>
}

const PROFILE: Record<Plate, PlateProfile> = {
  geel: {
    costing: 'motor_scooter',
    costing_options: { motor_scooter: { top_speed: 45 } },
  },
  blauw: {
    costing: 'bicycle',
    costing_options: { bicycle: { bicycle_type: 'hybrid', cycling_speed: 25 } },
  },
}

interface ValhallaManeuver {
  instruction?: string
  begin_shape_index?: number
}
interface ValhallaTrip {
  legs?: { shape?: string; maneuvers?: ValhallaManeuver[] }[]
  summary?: { length?: number; time?: number }
}

function tripToRoute(trip: ValhallaTrip): Route {
  const coordinates: [number, number][] = []
  const steps: { text: string; lng: number; lat: number }[] = []
  for (const leg of trip.legs ?? []) {
    const legCoords = leg.shape ? decodePolyline(leg.shape, 6) : []
    for (const m of leg.maneuvers ?? []) {
      const idx = Math.min(m.begin_shape_index ?? 0, Math.max(0, legCoords.length - 1))
      const pos = legCoords[idx]
      if (pos && m.instruction) steps.push({ text: m.instruction, lng: pos[0], lat: pos[1] })
    }
    coordinates.push(...legCoords)
  }
  return {
    coordinates,
    distanceKm: trip.summary?.length ?? 0,
    durationMin: (trip.summary?.time ?? 0) / 60,
    steps,
  }
}

/**
 * Detecteert overgangen fietspad ↔ weg langs een route (voor "ga hier het fietspad op/af").
 * Gebruikt Valhalla trace_attributes (edge.use per segment), met het kenteken-profiel.
 * Geel (motor_scooter) rijdt niet op fietspaden → levert dan vanzelf geen overgangen.
 */
export async function cyclewayTransitions(
  coords: [number, number][],
  plate: Plate,
): Promise<{ lng: number; lat: number; onto: boolean }[]> {
  if (coords.length < 4) return []
  const shape = coords.filter((_, i) => i % 2 === 0).map(([lon, lat]) => ({ lat, lon }))
  try {
    const res = await fetch(`${VALHALLA_URL}/trace_attributes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shape,
        costing: PROFILE[plate].costing,
        shape_match: 'walk_or_snap',
        filters: { attributes: ['edge.use', 'edge.begin_shape_index'], action: 'include' },
      }),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { edges?: { use?: string; begin_shape_index?: number }[] }
    const out: { lng: number; lat: number; onto: boolean }[] = []
    let prev: boolean | null = null
    for (const e of data.edges ?? []) {
      const isCycle = e.use === 'cycleway'
      if (prev !== null && isCycle !== prev) {
        const idx = Math.min((e.begin_shape_index ?? 0) * 2, coords.length - 1)
        const [lng, lat] = coords[idx]
        out.push({ lng, lat, onto: isCycle })
      }
      prev = isCycle
    }
    return out
  } catch {
    return []
  }
}

export class ValhallaRouting implements RoutingBackend {
  private exclude(avoidPaths?: [number, number][][]): [number, number][][] {
    return (avoidPaths ?? []).map((p) => bufferPolygon(p)).filter((r) => r.length > 0)
  }

  private async send(body: Record<string, unknown>): Promise<Route[]> {
    const res = await fetch(`${VALHALLA_URL}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Valhalla ${res.status} ${text.slice(0, 140)}`)
    }
    const data = (await res.json()) as {
      trip?: ValhallaTrip
      alternates?: { trip: ValhallaTrip }[]
    }
    const trips: ValhallaTrip[] = [
      ...(data.trip ? [data.trip] : []),
      ...(data.alternates ?? []).map((a) => a.trip),
    ]
    return trips.map(tripToRoute)
  }

  async route(
    from: LngLat,
    to: LngLat,
    plate: Plate,
    avoidPaths?: [number, number][][],
  ): Promise<Route[]> {
    const profile = PROFILE[plate]
    const body: Record<string, unknown> = {
      locations: [
        { lat: from.lat, lon: from.lng },
        { lat: to.lat, lon: to.lng },
      ],
      costing: profile.costing,
      costing_options: profile.costing_options,
      alternates: 2, // tot 2 extra routes → max 3 totaal
      directions_options: { units: 'kilometers', language: narrativeLanguage() },
    }
    const exclude = this.exclude(avoidPaths)
    if (exclude.length) body.exclude_polygons = exclude
    return this.send(body)
  }

  async routeVia(
    points: LngLat[],
    plate: Plate,
    avoidPaths?: [number, number][][],
  ): Promise<Route[]> {
    const profile = PROFILE[plate]
    const body: Record<string, unknown> = {
      // Via-punten ruimer aan de weg snappen (radius) → minder "no path"-fouten bij omleiden.
      locations: points.map((p, i) => {
        const loc: Record<string, unknown> = { lat: p.lat, lon: p.lng }
        if (i > 0 && i < points.length - 1) loc.radius = 100
        return loc
      }),
      costing: profile.costing,
      costing_options: profile.costing_options,
      directions_options: { units: 'kilometers', language: narrativeLanguage() },
    }
    const exclude = this.exclude(avoidPaths)
    if (exclude.length) body.exclude_polygons = exclude
    return this.send(body)
  }
}
