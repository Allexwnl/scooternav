// Centrale config — pas hier de kaartstijl en het startpunt aan.

// Keyless kaartstijl via OpenFreeMap (geen account/sleutel nodig).
// MapTiler gebruiken? Zet VITE_MAP_STYLE_URL in .env naar je MapTiler-style-URL incl. ?key=...
export const MAP_STYLE_URL =
  import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty'

// Startpunt: centrum van Purmerend. LET OP: MapLibre verwacht [lng, lat].
export const PURMEREND_CENTER: [number, number] = [4.9597, 52.5052]

export const DEFAULT_ZOOM = 13

// Valhalla routeserver. In dev gaat dit via de Vite-proxy (/valhalla → publieke
// FOSSGIS-instance) om CORS te vermijden. Later: je eigen self-hosted Valhalla
// via VITE_VALHALLA_URL (Fase 2).
export const VALHALLA_URL = import.meta.env.VITE_VALHALLA_URL || '/valhalla'

// Eigen REST-API (zelf te hosten). Alleen nodig als VITE_REPORTS_BACKEND=api.
export const API_URL = import.meta.env.VITE_API_URL || ''

// Google OAuth client-id (WEB) voor "Inloggen met Google". Moet gelijk zijn aan
// GOOGLE_CLIENT_ID op de server. Leeg = login uitgeschakeld.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
