/**
 * Maakt een dun vermijд-polygoon (een "lint") rond een wegafsluiting-lijn, zodat
 * Valhalla die edges kan uitsluiten (exclude_polygons). Geeft een ring [lng,lat][].
 *
 * NB: werkt alleen op een Valhalla waar exclude_polygons aanstaat (self-hosted, Fase 2).
 * De publieke FOSSGIS-instance negeert dit.
 */
export function bufferPolygon(path: [number, number][], meters = 14): [number, number][] {
  if (path.length < 2) return []

  const latOff = meters / 111320
  const left: [number, number][] = []
  const right: [number, number][] = []

  for (let i = 0; i < path.length; i++) {
    const [lng, lat] = path[i]
    const prev = path[Math.max(0, i - 1)]
    const next = path[Math.min(path.length - 1, i + 1)]
    let dx = next[0] - prev[0]
    let dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const lngOff = meters / (111320 * Math.cos((lat * Math.PI) / 180))
    const nx = -dy * lngOff // perpendiculair
    const ny = dx * latOff
    left.push([lng + nx, lat + ny])
    right.push([lng - nx, lat - ny])
  }

  return [...left, ...right.reverse(), left[0]]
}
