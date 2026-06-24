import { PURMEREND_CENTER } from '../config'

export interface GeoResult {
  label: string
  lng: number
  lat: number
}

/**
 * Adres/plaats zoeken via Nominatim (OpenStreetMap, gratis). Resultaten worden rond
 * Purmerend gebiased. NB: Nominatim heeft een fair-use-limiet (max ~1 req/s) — voor
 * productie/schaal beter een eigen geocoder of een provider. Zie HANDOVER/ROADMAP.
 */
export async function geocode(query: string): Promise<GeoResult[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const [lng, lat] = PURMEREND_CENTER
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '5',
    viewbox: `${lng - 0.4},${lat + 0.4},${lng + 0.4},${lat - 0.4}`,
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`geocode ${res.status}`)

  const data = (await res.json()) as { display_name: string; lon: string; lat: string }[]
  return data.map((d) => ({ label: d.display_name, lng: Number(d.lon), lat: Number(d.lat) }))
}
