// Rit-statistieken in localStorage (retentie-feature, geen server). Totalen over alle ritten.
export interface RideStats {
  rides: number
  km: number
  minutes: number
  controls: number // gepasseerde politie-/rollerbank-controles
}

const KEY = 'scooter-nav.stats'
const empty: RideStats = { rides: 0, km: 0, minutes: 0, controls: 0 }

export function loadStats(): RideStats {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty, ...(JSON.parse(raw) as Partial<RideStats>) }
  } catch {
    /* corrupte opslag → leeg */
  }
  return { ...empty }
}

/** Eén afgeronde rit optellen bij de totalen. */
export function addRide(km: number, minutes: number, controls: number): RideStats {
  const s = loadStats()
  s.rides += 1
  s.km += km
  s.minutes += minutes
  s.controls += controls
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* opslag vol/geblokkeerd */
  }
  return s
}
