import type { ReportsBackend, BoundingBox, NewReport, Report } from './types'
import { API_URL } from '../../config'
import { auth } from '../auth'

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

// Schrijf-acties sturen het Google ID-token mee; de server verifieert het en bepaalt
// zelf de stem-id (geen manipulatie mogelijk).
function authHeaders(): Record<string, string> {
  return auth.token ? { Authorization: `Bearer ${auth.token}` } : {}
}

/**
 * Backend tegen je eigen REST-API (zelf te hosten). Zie HANDOVER.md §7 + server/.
 *   GET  {API}/reports?minLng&minLat&maxLng&maxLat  -> Report[]
 *   POST {API}/reports            body: NewReport    -> Report   (login vereist)
 *   POST {API}/reports/:id/vote   body: { stillThere, voterId } -> 204  (login vereist)
 */
export class ApiReportsBackend implements ReportsBackend {
  async getInBounds(b: BoundingBox): Promise<Report[]> {
    const q = new URLSearchParams({
      minLng: String(b.minLng),
      minLat: String(b.minLat),
      maxLng: String(b.maxLng),
      maxLat: String(b.maxLat),
    })
    return asJson<Report[]>(await fetch(`${API_URL}/reports?${q}`))
  }

  async create(report: NewReport): Promise<Report> {
    return asJson<Report>(
      await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(report),
      }),
    )
  }

  async confirm(id: string, stillThere: boolean, voterId: string): Promise<void> {
    const res = await fetch(`${API_URL}/reports/${id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ stillThere, voterId }),
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
  }
}
