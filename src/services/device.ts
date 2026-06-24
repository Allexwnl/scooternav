const KEY = 'scooter-nav.deviceId'

/**
 * Stabiele, anonieme apparaat-id (zoals Waze zonder account). Eén id per apparaat,
 * zodat een gebruiker maar één keer per melding kan stemmen.
 *
 * NB: client-side id; de échte backend moet dit serverseitig afdwingen (uniek per
 * apparaat/gebruiker per melding) zodat het niet te omzeilen is.
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `d-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
    localStorage.setItem(KEY, id)
  }
  return id
}
