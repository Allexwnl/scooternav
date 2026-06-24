import { decodePolyline } from './polyline'
import { VALHALLA_URL } from '../../config'
import type { LngLat } from './types'

/**
 * Snap een reeks punten aan het echte wegennet en geef de wegvolgende lijn terug
 * ([lng,lat][]). Zo volgt bijv. een wegafsluiting exact de straat (Waze-stijl),
 * in plaats van een rechte lijn dwars door bebouwing.
 *
 * Bewust costing 'pedestrian': dat volgt de straat direct en negeert eenrichting,
 * dus je krijgt het wegsegment zelf zonder omwegen.
 */
export async function snapToRoad(points: LngLat[]): Promise<[number, number][]> {
  if (points.length < 2) return points.map((p) => [p.lng, p.lat] as [number, number])

  const body = {
    locations: points.map((p) => ({ lat: p.lat, lon: p.lng })),
    costing: 'pedestrian',
    directions_options: { units: 'kilometers' },
  }

  const res = await fetch(`${VALHALLA_URL}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Valhalla snap ${res.status}`)

  const data = (await res.json()) as { trip?: { legs?: { shape?: string }[] } }
  const coords: [number, number][] = []
  for (const leg of data.trip?.legs ?? []) {
    if (leg.shape) coords.push(...decodePolyline(leg.shape, 6))
  }
  return coords
}
