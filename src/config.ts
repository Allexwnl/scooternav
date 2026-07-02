// Centrale config — pas hier de kaartstijl en het startpunt aan.

// Eigen, zelf-gehoste kaartstijlen (100% legaal voor commercieel gebruik, €0/mnd).
// Ontwerp = OpenMapTiles Positron (licht "Sorbet") / Dark Matter (donker "Midnight"),
// BSD-3 + CC-BY; tegels/fonts/sprites komen van OpenFreeMap (gratis, keyless, óók
// commercieel). Licht ge-brand met sweetscoots-groen op fietspaden/parken.
// Eigen stijl? Zet VITE_MAP_STYLE_URL in .env (geldt dan voor licht én donker).
const ENV_STYLE = import.meta.env.VITE_MAP_STYLE_URL
export const MAP_STYLE_LIGHT = ENV_STYLE || '/map-styles/sweetscoots-light.json'
export const MAP_STYLE_DARK = ENV_STYLE || '/map-styles/sweetscoots-dark.json'

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
