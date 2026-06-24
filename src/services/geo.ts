// Kleine geo-helpers voor afstanden langs een route (B4 – alerts onderweg).

/** Afstand in meters tussen twee [lng,lat]-punten (haversine). */
export function distM(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const R = 6371000
  const toRad = Math.PI / 180
  const dLat = (bLat - aLat) * toRad
  const dLng = (bLng - aLng) * toRad
  const la1 = aLat * toRad
  const la2 = bLat * toRad
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Cumulatieve afstand (m) per punt langs de lijn. */
export function cumulative(coords: [number, number][]): number[] {
  const cum = [0]
  for (let i = 1; i < coords.length; i++) {
    cum[i] = cum[i - 1] + distM(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1])
  }
  return cum
}

/** Dichtstbijzijnde punt-index op de lijn + die afstand (m). */
export function nearestIndex(coords: [number, number][], lng: number, lat: number) {
  let idx = 0
  let best = Infinity
  for (let i = 0; i < coords.length; i++) {
    const d = distM(coords[i][0], coords[i][1], lng, lat)
    if (d < best) {
      best = d
      idx = i
    }
  }
  return { idx, dist: best }
}

/**
 * Snap een punt op de dichtstbijzijnde plek op de lijn (projectie op het segment) —
 * "map-matching" zodat de locatie-stip netjes op de weg blijft i.p.v. te springen.
 */
export function snapToPolyline(
  lng: number,
  lat: number,
  coords: [number, number][],
): { lng: number; lat: number } | null {
  if (coords.length < 2) return null
  const k = Math.cos((lat * Math.PI) / 180) || 1 // lengtegraad-schaal corrigeren
  const px = lng * k
  const py = lat
  let best: [number, number] | null = null
  let bestD = Infinity
  for (let i = 1; i < coords.length; i++) {
    const ax = coords[i - 1][0] * k
    const ay = coords[i - 1][1]
    const bx = coords[i][0] * k
    const by = coords[i][1]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    const cx = ax + dx * t
    const cy = ay + dy * t
    const d = (px - cx) ** 2 + (py - cy) ** 2
    if (d < bestD) {
      bestD = d
      best = [cx / k, cy]
    }
  }
  return best ? { lng: best[0], lat: best[1] } : null
}

/** Punt op `meters` langs de lijn (lineair geïnterpoleerd) — voor de rit-simulatie. */
export function pointAtDistance(
  coords: [number, number][],
  cum: number[],
  meters: number,
): [number, number] {
  if (meters <= 0) return coords[0]
  let i = 1
  while (i < cum.length && cum[i] < meters) i++
  if (i >= cum.length) return coords[coords.length - 1]
  const t = (meters - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
  const [aLng, aLat] = coords[i - 1]
  const [bLng, bLat] = coords[i]
  return [aLng + (bLng - aLng) * t, aLat + (bLat - aLat) * t]
}
