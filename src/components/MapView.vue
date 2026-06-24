<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { Map as MlMap, Marker, NavigationControl, LngLatBounds } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_STYLE_URL, PURMEREND_CENTER, DEFAULT_ZOOM } from '../config'
import { createLocationProvider } from '../services/location'
import type { Route, LngLat } from '../services/routing'
import type { Report, ReportType, BoundingBox } from '../services/reports'

const props = defineProps<{
  routes: Route[]
  selectedIndex: number
  destination: LngLat | null
  reports: Report[]
  navPosition: LngLat | null
  navActive: boolean
  navBearing: number
}>()

const emit = defineEmits<{
  position: [pos: LngLat]
  pick: [pos: LngLat]
  selectRoute: [index: number]
  selectReport: [id: string]
  bounds: [bbox: BoundingBox]
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
const map = shallowRef<MlMap | null>(null)
const status = ref('Kaart laden…')

let stopWatch: (() => void) | null = null
let meMarker: Marker | null = null
let destMarker: Marker | null = null
let reportMarkers: Marker[] = []
let navMarker: Marker | null = null
let styleReady = false

const EMPTY_FC = { type: 'FeatureCollection', features: [] }

const REPORT_EMOJI: Record<ReportType, string> = {
  politie: '🚓',
  rollerbank: '⚙️',
  hulpdienst: '🚑',
  gevaarlijk_wegdek: '⚠️',
  wegafsluiting: '🚧',
}

onMounted(() => {
  if (!mapContainer.value) return

  const m = new MlMap({
    container: mapContainer.value,
    style: MAP_STYLE_URL,
    center: PURMEREND_CENTER,
    zoom: DEFAULT_ZOOM,
  })
  map.value = m
  m.addControl(new NavigationControl(), 'top-right')

  // Stille placeholder voor ontbrekende sprite-icoontjes in de kaartstijl
  // (voorkomt "Image ... could not be loaded"-waarschuwingen).
  m.on('styleimagemissing', (e) => {
    if (!m.hasImage(e.id)) m.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) })
  })

  m.on('load', () => {
    styleReady = true

    // Routes
    m.addSource('routes', { type: 'geojson', data: EMPTY_FC as never })
    m.addLayer({
      id: 'routes-line',
      type: 'line',
      source: 'routes',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        'line-sort-key': ['case', ['get', 'selected'], 1, 0],
      },
      paint: {
        'line-color': ['case', ['get', 'selected'], '#1e88e5', '#9aa0a6'],
        'line-width': ['case', ['get', 'selected'], 7, 4],
        'line-opacity': ['case', ['get', 'selected'], 1, 0.65],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // Wegafsluitingen — rode lijn (van–tot), Waze-stijl, boven de routes.
    m.addSource('closures', { type: 'geojson', data: EMPTY_FC as never })
    m.addLayer({
      id: 'closures-line',
      type: 'line',
      source: 'closures',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#e53935',
        'line-width': 6,
        'line-dasharray': [1.5, 1],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    m.on('click', 'routes-line', (e) => {
      const idx = e.features?.[0]?.properties?.index
      if (idx !== undefined && idx !== null) emit('selectRoute', Number(idx))
    })
    m.on('mouseenter', 'routes-line', () => (m.getCanvas().style.cursor = 'pointer'))
    m.on('mouseleave', 'routes-line', () => (m.getCanvas().style.cursor = ''))

    // Klik op een afsluitingslijn → die melding selecteren (om te stemmen).
    m.on('click', 'closures-line', (e) => {
      const id = e.features?.[0]?.properties?.id
      if (id) emit('selectReport', String(id))
    })
    m.on('mouseenter', 'closures-line', () => (m.getCanvas().style.cursor = 'pointer'))
    m.on('mouseleave', 'closures-line', () => (m.getCanvas().style.cursor = ''))

    m.on('click', (e) => {
      const hits = m.queryRenderedFeatures(e.point, { layers: ['routes-line', 'closures-line'] })
      if (hits.length > 0) return
      emit('pick', { lng: e.lngLat.lng, lat: e.lngLat.lat })
    })

    emitBounds(m)
    m.on('moveend', () => emitBounds(m))

    status.value = 'Tik op de kaart voor een bestemming.'
    startLocation(m)
    drawRoutes()
    drawDestination()
    drawReports()
    drawClosures()
    drawNav()
  })

  m.on('error', (e) => {
    const msg = (e as { error?: { message?: string } }).error?.message ?? 'onbekend'
    status.value = `Kaartfout: ${msg}`
  })
})

function emitBounds(m: MlMap) {
  const b = m.getBounds()
  emit('bounds', {
    minLng: b.getWest(),
    minLat: b.getSouth(),
    maxLng: b.getEast(),
    maxLat: b.getNorth(),
  })
}

function startLocation(m: MlMap) {
  const location = createLocationProvider()

  const el = document.createElement('div')
  el.className = 'me-dot'
  meMarker = new Marker({ element: el })

  let firstFix = true
  stopWatch = location.watch(
    (pos) => {
      meMarker!.setLngLat([pos.lng, pos.lat]).addTo(m)
      emit('position', { lng: pos.lng, lat: pos.lat })
      if (firstFix) {
        m.easeTo({ center: [pos.lng, pos.lat], zoom: 15 })
        firstFix = false
      }
    },
    (err) => (status.value = `Geen locatie (route start dan vanaf kaartmidden): ${err.message}`),
  )
}

function drawRoutes() {
  const m = map.value
  if (!m || !styleReady) return
  const src = m.getSource('routes') as { setData: (d: unknown) => void } | undefined
  if (!src) return

  const features = props.routes.map((r, i) => ({
    type: 'Feature',
    properties: { index: i, selected: i === props.selectedIndex },
    geometry: { type: 'LineString', coordinates: r.coordinates },
  }))
  src.setData({ type: 'FeatureCollection', features })
}

function fitToRoutes() {
  const m = map.value
  if (!m || props.routes.length === 0) return
  const b = new LngLatBounds()
  for (const r of props.routes) for (const c of r.coordinates) b.extend(c)
  if (props.destination) b.extend([props.destination.lng, props.destination.lat])
  m.fitBounds(b, { padding: 70, maxZoom: 16, duration: 600 })
}

function drawDestination() {
  const m = map.value
  if (!m) return
  if (props.destination) {
    if (!destMarker) {
      const el = document.createElement('div')
      el.className = 'dest-pin'
      el.textContent = '📍'
      destMarker = new Marker({ element: el, anchor: 'bottom' })
    }
    destMarker.setLngLat([props.destination.lng, props.destination.lat]).addTo(m)
  } else if (destMarker) {
    destMarker.remove()
  }
}

function drawReports() {
  const m = map.value
  if (!m) return
  for (const mk of reportMarkers) mk.remove()
  reportMarkers = []
  for (const r of props.reports) {
    const el = document.createElement('div')
    el.className = 'report-pin'
    el.textContent = REPORT_EMOJI[r.type] ?? '❓'
    el.title = r.type
    el.style.cursor = 'pointer'
    el.addEventListener('click', (ev) => {
      ev.stopPropagation()
      emit('selectReport', r.id)
    })
    reportMarkers.push(new Marker({ element: el }).setLngLat([r.lng, r.lat]).addTo(m))
  }
}

function drawClosures() {
  const m = map.value
  if (!m || !styleReady) return
  const src = m.getSource('closures') as { setData: (d: unknown) => void } | undefined
  if (!src) return

  const features = props.reports
    .filter((r) => r.type === 'wegafsluiting' && r.path && r.path.length > 1)
    .map((r) => ({
      type: 'Feature',
      properties: { id: r.id },
      geometry: { type: 'LineString', coordinates: r.path },
    }))
  src.setData({ type: 'FeatureCollection', features })
}

watch(() => props.selectedIndex, drawRoutes)
watch(
  () => props.routes,
  () => {
    drawRoutes()
    fitToRoutes()
  },
)
watch(() => props.destination, drawDestination)
watch(
  () => props.reports,
  () => {
    drawReports()
    drawClosures()
  },
)

function drawNav() {
  const m = map.value
  if (!m) return
  if (props.navPosition) {
    if (!navMarker) {
      const el = document.createElement('div')
      el.className = 'nav-dot'
      navMarker = new Marker({ element: el })
    }
    navMarker.setLngLat([props.navPosition.lng, props.navPosition.lat]).addTo(m)
    if (props.navActive) {
      // Third-person: gekanteld, ingezoomd, meedraaiend met de rijrichting (Waze-stijl).
      m.easeTo({
        center: [props.navPosition.lng, props.navPosition.lat],
        bearing: props.navBearing,
        pitch: 60,
        zoom: 17,
        duration: 280,
      })
    } else {
      m.easeTo({ center: [props.navPosition.lng, props.navPosition.lat], duration: 200 })
    }
  } else if (navMarker) {
    navMarker.remove()
  }
}
watch(() => props.navPosition, drawNav)
watch(
  () => props.navActive,
  (on) => {
    const m = map.value
    if (!m) return
    if (!on) {
      m.easeTo({ pitch: 0, bearing: 0, duration: 400 }) // terug naar plat noord-boven
      fitToRoutes()
    }
  },
)

onUnmounted(() => {
  stopWatch?.()
  map.value?.remove()
})
</script>

<template>
  <div class="map-wrap">
    <div ref="mapContainer" class="map"></div>
    <div class="status">{{ status }}</div>
  </div>
</template>

<style scoped>
.map-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}
.map {
  position: absolute;
  inset: 0;
}
.status {
  position: absolute;
  left: 8px;
  bottom: 8px;
  z-index: 1;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 13px;
  max-width: 75%;
}
</style>
