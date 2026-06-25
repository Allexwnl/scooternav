<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import MapView from './components/MapView.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { createRoutingBackend, snapToRoad, cyclewayTransitions } from './services/routing'
import type { Route, LngLat, Plate } from './services/routing'
import { createReportsBackend, DENY_THRESHOLD } from './services/reports'
import type { Report, ReportType, BoundingBox } from './services/reports'
import { PURMEREND_CENTER, GOOGLE_CLIENT_ID } from './config'
import { settings } from './stores/settings'
import { getDeviceId } from './services/device'
import { auth, initAuth, renderButton, signIn, signOut } from './services/auth'
import { cumulative, nearestIndex, pointAtDistance, distM, snapToPolyline } from './services/geo'
import { enableWakeLock, disableWakeLock } from './services/wakeLock'
import { geocode, type GeoResult } from './services/geocoding'
import { t } from './services/i18n'

const routing = createRoutingBackend()
const reportsBackend = createReportsBackend()

const myPos = ref<LngLat | null>(null)
const destination = ref<LngLat | null>(null)
const routes = ref<Route[]>([])
const routeBlocked = ref<boolean[]>([])
const selectedIndex = ref(0)
const loading = ref(false)
const error = ref('')
const showSettings = ref(false)
const gbtn = ref<HTMLDivElement | null>(null)

const reports = ref<Report[]>([])
const selectedReport = ref<Report | null>(null)
const deviceId = getDeviceId()
const votedIds = ref<string[]>([])
let lastBounds: BoundingBox | null = null
let pollTimer: number | undefined

// Alleen niet-gefilterde meldingen tonen (instelling).
const visibleReports = computed(() => reports.value.filter((r) => !settings.hiddenTypes.includes(r.type)))

// --- Zoeken (geocoding) ---
const searchQuery = ref('')
const searchResults = ref<GeoResult[]>([])
const searching = ref(false)
let searchTimer: number | undefined
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  if (searchQuery.value.trim().length < 3) {
    searchResults.value = []
    return
  }
  searchTimer = window.setTimeout(async () => {
    searching.value = true
    try {
      searchResults.value = await geocode(searchQuery.value)
    } catch {
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }, 400)
}
function pickResult(r: GeoResult) {
  destination.value = { lng: r.lng, lat: r.lat }
  searchResults.value = []
  searchQuery.value = r.label.split(',')[0]
}

// --- Melden (Waze-stijl) ---
const REPORT_TYPES: { type: ReportType; emoji: string; key: string }[] = [
  { type: 'politie', emoji: '🚓', key: 'rt_politie' },
  { type: 'rollerbank', emoji: '⚙️', key: 'rt_rollerbank' },
  { type: 'hulpdienst', emoji: '🚑', key: 'rt_hulpdienst' },
  { type: 'gevaarlijk_wegdek', emoji: '⚠️', key: 'rt_gevaarlijk_wegdek' },
  { type: 'wegafsluiting', emoji: '🚧', key: 'rt_wegafsluiting' },
]
const showTypePicker = ref(false)
const drawingClosure = ref(false)
const closureStart = ref<LngLat | null>(null)
const toast = ref('')

const bannerText = computed(() => (closureStart.value ? t('closure_end') : t('closure_start')))
const remainingDenials = computed(() =>
  selectedReport.value ? DENY_THRESHOLD - (selectedReport.value.denials ?? 0) : 0,
)
const hasVoted = computed(() =>
  selectedReport.value ? votedIds.value.includes(selectedReport.value.id) : false,
)

function emojiFor(type: ReportType): string {
  return REPORT_TYPES.find((x) => x.type === type)?.emoji ?? '📍'
}
function labelFor(type: ReportType): string {
  const k = REPORT_TYPES.find((x) => x.type === type)?.key
  return k ? t(k) : type
}

// --- Navigatie-alerts + turn-by-turn (B4 + Fase 3) ---
const ALERT_DISTANCE_M = 1000
const ON_ROUTE_M = 45
const alert = ref<{ emoji: string; label: string; meters: number } | null>(null)
const navStep = ref<{ text: string; meters: number } | null>(null)
const simulating = ref(false)
const simPos = ref<LngLat | null>(null)
let simTimer: number | undefined
let lastSpoken = -1
const activePos = computed<LngLat | null>(() => (simulating.value ? simPos.value : myPos.value))
const navMode = ref(false) // navigatie actief (third-person camera, volgend)
const navBearing = ref(0)
let prevNavPos: LngLat | null = null
let lastReroute = 0
const pathHints = ref<{ text: string; lng: number; lat: number }[]>([]) // fietspad op/af

// Precieze locatie: tijdens navigatie de positie op de route "snappen" (map-matching),
// zodat de stip niet zijwaarts springt door GPS-ruis. Te ver weg → ruwe positie (off-route).
const navDisplayPos = computed<LngLat | null>(() => {
  if (!navMode.value) return null
  const pos = activePos.value
  if (!pos) return null
  const route = routes.value[selectedIndex.value]
  if (!route || route.coordinates.length < 2) return pos
  const snapped = snapToPolyline(pos.lng, pos.lat, route.coordinates)
  if (snapped && distM(pos.lng, pos.lat, snapped.lng, snapped.lat) < 60) return snapped
  return pos
})
const currentSpeed = ref<number | null>(null) // m/s, uit GPS
const recenterSignal = ref(0)
const navRemaining = ref<{ km: number; min: number } | null>(null)

function currentLocation(): LngLat {
  if (myPos.value) return myPos.value
  if (lastBounds) {
    return {
      lng: (lastBounds.minLng + lastBounds.maxLng) / 2,
      lat: (lastBounds.minLat + lastBounds.maxLat) / 2,
    }
  }
  return { lng: PURMEREND_CENTER[0], lat: PURMEREND_CENTER[1] }
}

function bearingBetween(a: LngLat, b: LngLat): number {
  const toRad = Math.PI / 180
  const dLon = (b.lng - a.lng) * toRad
  const y = Math.sin(dLon) * Math.cos(b.lat * toRad)
  const x =
    Math.cos(a.lat * toRad) * Math.sin(b.lat * toRad) -
    Math.sin(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.cos(dLon)
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360
}

function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) toast.value = ''
  }, 2800)
}
function handleWriteError(e: unknown) {
  const msg = String((e as Error)?.message ?? e)
  if (msg.includes('401') || msg.includes('503')) {
    showToast(t('login_needed'))
    signIn()
  } else {
    showToast(t('something_wrong'))
  }
}

function speak(text: string) {
  if (!settings.voice || !('speechSynthesis' in window)) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = settings.locale === 'en' ? 'en-US' : 'nl-NL'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch {
    /* tts niet beschikbaar */
  }
}

// --- Stemmen ---
// Melden vereist inloggen (accountability) zodra login is geconfigureerd.
function onReportClick() {
  if (GOOGLE_CLIENT_ID && !auth.user) {
    showToast(t('login_needed'))
    signIn()
    return
  }
  showTypePicker.value = true
}

function pickType(type: ReportType) {
  showTypePicker.value = false
  if (type === 'wegafsluiting') {
    drawingClosure.value = true
    closureStart.value = null
  } else {
    placePointReport(type)
  }
}
async function placePointReport(type: ReportType) {
  const loc = currentLocation()
  try {
    await reportsBackend.create({ type, lng: loc.lng, lat: loc.lat })
    await refreshReports()
    showToast(`${emojiFor(type)} ${t('report_placed')}`)
  } catch (e) {
    handleWriteError(e)
  }
}
function cancelClosure() {
  drawingClosure.value = false
  closureStart.value = null
}
function onSelectReport(id: string) {
  selectedReport.value = reports.value.find((r) => r.id === id) ?? null
}
async function vote(stillThere: boolean) {
  if (!selectedReport.value || hasVoted.value) return
  const id = selectedReport.value.id
  const wasClosure = selectedReport.value.type === 'wegafsluiting'
  try {
    await reportsBackend.confirm(id, stillThere, deviceId)
    votedIds.value = [...votedIds.value, id]
    await refreshReports()
    const still = reports.value.find((r) => r.id === id)
    if (!still) {
      selectedReport.value = null
      showToast(t('removed'))
      if (wasClosure && destination.value) await compute()
    } else {
      selectedReport.value = still
      showToast(stillThere ? t('confirmed') : t('noted'))
    }
  } catch (e) {
    handleWriteError(e)
  }
}

// --- Kaart-events ---
function onPosition(p: { lng: number; lat: number; speed: number | null }) {
  myPos.value = { lng: p.lng, lat: p.lat }
  currentSpeed.value = p.speed
}
function recenter() {
  recenterSignal.value++
}
function onSelectRoute(i: number) {
  selectedIndex.value = i
  void loadPathHints()
}
async function onPick(p: LngLat) {
  if (drawingClosure.value) {
    if (!closureStart.value) closureStart.value = p
    else {
      await createClosure(closureStart.value, p)
      cancelClosure()
    }
    return
  }
  // Route al gekozen? Dan verandert een tik op de kaart de route NIET (gebruik "wissen" of zoeken).
  if (destination.value) return
  destination.value = p
}
async function createClosure(a: LngLat, b: LngLat) {
  let path: [number, number][]
  try {
    path = await snapToRoad([a, b])
  } catch {
    path = [
      [a.lng, a.lat],
      [b.lng, b.lat],
    ]
  }
  try {
    await reportsBackend.create({
      type: 'wegafsluiting',
      lng: (a.lng + b.lng) / 2,
      lat: (a.lat + b.lat) / 2,
      path,
    })
    await refreshReports()
    showToast(t('closure_placed'))
    if (destination.value) await compute()
  } catch (e) {
    handleWriteError(e)
  }
}

// --- Meldingen ophalen + pollen ---
async function fetchReports(b: BoundingBox) {
  lastBounds = b
  try {
    reports.value = await reportsBackend.getInBounds(b)
  } catch {
    /* niet kritiek */
  }
}
function onBounds(b: BoundingBox) {
  fetchReports(b)
}
async function refreshReports() {
  if (lastBounds) await fetchReports(lastBounds)
}
onMounted(async () => {
  pollTimer = window.setInterval(() => {
    if (lastBounds) fetchReports(lastBounds)
  }, 20_000)
  await initAuth()
  if (gbtn.value) renderButton(gbtn.value)
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  stopNavigation()
})

// --- Routeberekening + afsluiting-vermijding ---
function closurePaths(): [number, number][][] {
  return reports.value
    .filter((r) => r.type === 'wegafsluiting' && r.path && r.path.length > 1)
    .map((r) => r.path as [number, number][])
}
function routeCrossesClosure(coords: [number, number][], paths: [number, number][][]): boolean {
  const TH = 0.0002
  for (const [lng, lat] of coords)
    for (const path of paths)
      for (const [clng, clat] of path) if (Math.abs(lng - clng) < TH && Math.abs(lat - clat) < TH) return true
  return false
}
async function compute() {
  if (!destination.value) return
  const from = myPos.value ?? { lng: PURMEREND_CENTER[0], lat: PURMEREND_CENTER[1] }
  const avoid = closurePaths()
  loading.value = true
  error.value = ''
  try {
    let result = await routing.route(from, destination.value, settings.plate, avoid)
    let blocked = result.map((r) => routeCrossesClosure(r.coordinates, avoid))
    if (avoid.length > 0 && result.length > 0 && blocked.every((b) => b)) {
      const detour = await findDetour(from, destination.value, settings.plate, avoid, result)
      if (detour) {
        result = [detour, ...result]
        blocked = result.map((r) => routeCrossesClosure(r.coordinates, avoid))
      }
    }
    routes.value = result
    routeBlocked.value = blocked
    const firstOpen = blocked.findIndex((b) => !b)
    selectedIndex.value = firstOpen >= 0 ? firstOpen : 0
    void loadPathHints()
    if (result.length === 0) error.value = t('no_route')
  } catch (e) {
    error.value = `${t('no_route')} (${(e as Error).message})`
    routes.value = []
    routeBlocked.value = []
  } finally {
    loading.value = false
  }
}
async function findDetour(
  from: LngLat,
  to: LngLat,
  plate: Plate,
  avoid: [number, number][][],
  current: Route[],
): Promise<Route | null> {
  const origMin = Math.min(...current.map((r) => r.distanceKm))
  for (const path of avoid) {
    if (path.length < 2) continue
    const mid = path[Math.floor(path.length / 2)]
    const a = path[0]
    const b = path[path.length - 1]
    let dx = b[0] - a[0]
    let dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const px = -dy
    const py = dx
    const lat = mid[1]
    for (const off of [0.0015, 0.003, 0.005]) {
      for (const sign of [1, -1]) {
        const via: LngLat = {
          lng: mid[0] + px * (off / Math.cos((lat * Math.PI) / 180)) * sign,
          lat: mid[1] + py * off * sign,
        }
        try {
          const r = (await routing.routeVia([from, via, to], plate, avoid))[0]
          if (r && r.coordinates.length > 0 && !routeCrossesClosure(r.coordinates, avoid) && r.distanceKm <= origMin * 3 + 1) {
            return r
          }
        } catch {
          /* volgende kandidaat */
        }
      }
    }
  }
  return null
}

// Off-route? Herbereken de route vanaf je huidige positie (alleen echt GPS, niet sim).
function maybeReroute(pos: LngLat | null) {
  if (!navMode.value || simulating.value || loading.value || !destination.value || !pos) return
  const route = routes.value[selectedIndex.value]
  if (!route || route.coordinates.length < 2) return
  const near = nearestIndex(route.coordinates, pos.lng, pos.lat)
  if (near.dist > 55 && Date.now() - lastReroute > 8000) {
    lastReroute = Date.now()
    showToast(t('rerouting'))
    void compute()
  }
}

// Fietspad op/af-overgangen ophalen voor de gekozen route (kenteken-afhankelijk).
async function loadPathHints() {
  const route = routes.value[selectedIndex.value]
  if (!route || route.coordinates.length < 4) {
    pathHints.value = []
    return
  }
  try {
    const tr = await cyclewayTransitions(route.coordinates, settings.plate)
    pathHints.value = tr.map((x) => ({
      text: x.onto ? t('cycle_on') : t('cycle_off'),
      lng: x.lng,
      lat: x.lat,
    }))
  } catch {
    pathHints.value = []
  }
}

// --- Begeleiding onderweg: meldingen-alert + volgende afslag + stem ---
function recomputeGuidance() {
  const pos = activePos.value
  const route = routes.value[selectedIndex.value]
  if (!pos || !route || route.coordinates.length < 2) {
    alert.value = null
    navStep.value = null
    navRemaining.value = null
    return
  }
  const coords = route.coordinates
  const cum = cumulative(coords)
  const userDist = cum[nearestIndex(coords, pos.lng, pos.lat).idx]
  const totalM = cum[cum.length - 1]
  const remainM = Math.max(0, totalM - userDist)
  navRemaining.value = { km: remainM / 1000, min: route.durationMin * (totalM > 0 ? remainM / totalM : 0) }

  // melding vóór je op de route
  let bestAlert: { emoji: string; label: string; meters: number } | null = null
  for (const r of visibleReports.value) {
    const ri = nearestIndex(coords, r.lng, r.lat)
    if (ri.dist > ON_ROUTE_M) continue
    const ahead = cum[ri.idx] - userDist
    if (ahead > 5 && ahead <= ALERT_DISTANCE_M && (!bestAlert || ahead < bestAlert.meters)) {
      bestAlert = { emoji: emojiFor(r.type), label: labelFor(r.type), meters: ahead }
    }
  }
  alert.value = bestAlert

  // volgende afslag / fietspad-overgang (turn-by-turn)
  const guide = [...route.steps, ...pathHints.value]
  let next: { text: string; meters: number } | null = null
  let nextIdx = -1
  guide.forEach((s, i) => {
    const sd = cum[nearestIndex(coords, s.lng, s.lat).idx]
    const ahead = sd - userDist
    if (ahead > 8 && (!next || ahead < next.meters)) {
      next = { text: s.text, meters: ahead }
      nextIdx = i
    }
  })
  navStep.value = next
  // stem: spreek de instructie uit bij naderen (één keer per stap)
  if (next && simulating.value && (next as { meters: number }).meters < 140 && nextIdx !== lastSpoken) {
    lastSpoken = nextIdx
    speak((next as { text: string }).text)
  }
}

watch([destination, () => settings.plate], compute)
watch(activePos, (pos) => {
  recomputeGuidance()
  maybeReroute(pos)
})
watch(navDisplayPos, (pos) => {
  if (pos && prevNavPos) {
    const moved = Math.hypot(pos.lng - prevNavPos.lng, pos.lat - prevNavPos.lat)
    if (moved > 0.000015) navBearing.value = bearingBetween(prevNavPos, pos)
  }
  prevNavPos = pos
})
watch([selectedIndex, reports], recomputeGuidance)

// --- Navigatie starten/stoppen (echt GPS of simulatie) + scherm aan ---
function startNavigation() {
  if (!routes.value.length) return
  navMode.value = true
  lastSpoken = -1
  prevNavPos = null
  if (settings.keepAwake) void enableWakeLock()
}
function startSim() {
  const route = routes.value[selectedIndex.value]
  if (!route || route.coordinates.length < 2) return
  const coords = route.coordinates
  const cum = cumulative(coords)
  const total = cum[cum.length - 1]
  simulating.value = true
  navMode.value = true
  lastSpoken = -1
  prevNavPos = null
  if (settings.keepAwake) void enableWakeLock()
  simPos.value = { lng: coords[0][0], lat: coords[0][1] }
  let meters = 0
  simTimer = window.setInterval(() => {
    meters += 18
    if (meters >= total) {
      stopNavigation()
      return
    }
    const [lng, lat] = pointAtDistance(coords, cum, meters)
    simPos.value = { lng, lat }
  }, 200)
}
function stopNavigation() {
  navMode.value = false
  simulating.value = false
  if (simTimer) clearInterval(simTimer)
  simTimer = undefined
  simPos.value = null
  navStep.value = null
  prevNavPos = null
  void disableWakeLock()
}

function clearRoute() {
  stopNavigation()
  alert.value = null
  destination.value = null
  routes.value = []
  routeBlocked.value = []
  error.value = ''
}

function fmtDur(min: number): string {
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h} u ${m} min`
}
function arrivalTime(min: number): string {
  const d = new Date(Date.now() + min * 60_000)
  return d.toLocaleTimeString(settings.locale === 'en' ? 'en-GB' : 'nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <header class="topbar">
    <span class="brand">🛵 {{ t('brand') }}</span>
    <div class="toggle">
      <button :class="{ active: settings.plate === 'blauw' }" @click="settings.plate = 'blauw'">
        {{ t('plate_blue') }}
      </button>
      <button :class="{ active: settings.plate === 'geel' }" @click="settings.plate = 'geel'">
        {{ t('plate_yellow') }}
      </button>
    </div>
    <button class="act" :aria-label="t('report')" @click="onReportClick">➕</button>
    <button class="act" :aria-label="t('settings')" @click="showSettings = true">⚙️</button>
    <span v-if="auth.user" class="me" :title="auth.user.email">
      <img v-if="auth.user.picture" :src="auth.user.picture" alt="" referrerpolicy="no-referrer" />
      <button class="act" :aria-label="t('logout')" :title="t('logout')" @click="signOut">⎋</button>
    </span>
    <div v-else ref="gbtn" class="gbtn"></div>
  </header>

  <!-- Zoekbalk onderaan (Waze-stijl) — alleen als er nog geen route is -->
  <div v-if="!navMode && !destination" class="search">
    <input
      v-model="searchQuery"
      type="search"
      :placeholder="t('search_placeholder')"
      @input="onSearchInput"
    />
    <ul v-if="searchResults.length" class="results">
      <li v-for="(r, i) in searchResults" :key="i" @click="pickResult(r)">{{ r.label }}</li>
    </ul>
    <p v-else-if="searching" class="searching">{{ t('searching') }}</p>
  </div>

  <MapView
    :routes="routes"
    :selected-index="selectedIndex"
    :destination="destination"
    :reports="visibleReports"
    :nav-position="navDisplayPos"
    :nav-active="navMode"
    :nav-bearing="navBearing"
    :recenter-signal="recenterSignal"
    @position="onPosition"
    @pick="onPick"
    @select-route="onSelectRoute"
    @select-report="onSelectReport"
    @bounds="onBounds"
  />

  <!-- Volgende afslag / melding (buiten nav-modus; in nav-modus toont de overlay dit) -->
  <div v-if="navStep && !navMode" class="nav-banner">
    ➡️ {{ navStep.text }} · {{ t('in_meters', { m: Math.round(navStep.meters / 10) * 10 }) }}
  </div>
  <div v-if="alert && !navMode" class="alert-banner" :class="{ stacked: !!navStep }">
    {{ alert.emoji }} {{ alert.label }} · {{ t('in_meters', { m: Math.round(alert.meters / 10) * 10 }) }}
  </div>

  <!-- Navigatie-overlay (third-person modus, Waze-stijl) -->
  <div v-if="navMode" class="nav-overlay">
    <div class="nav-top">
      <div class="nav-instruction">
        <span v-if="navStep">➡️ {{ navStep.text }}</span>
        <span v-else>🏁 {{ t('arrive') }}</span>
        <span v-if="navStep" class="dist">{{ t('in_meters', { m: Math.round(navStep.meters / 10) * 10 }) }}</span>
      </div>
      <div v-if="alert" class="nav-alert">
        {{ alert.emoji }} {{ alert.label }} · {{ t('in_meters', { m: Math.round(alert.meters / 10) * 10 }) }}
      </div>
    </div>
    <div v-if="currentSpeed != null && currentSpeed >= 0" class="speed-pill">
      {{ Math.round(currentSpeed * 3.6) }}<small>km/u</small>
    </div>
    <div class="nav-bottom">
      <div class="nav-eta">
        <strong v-if="navRemaining">{{ arrivalTime(navRemaining.min) }}</strong>
        <span v-if="navRemaining">{{ Math.round(navRemaining.min) }} min · {{ navRemaining.km.toFixed(1) }} km</span>
      </div>
      <button class="nav-stop" @click="stopNavigation">✕ {{ t('stop_nav') }}</button>
    </div>
  </div>

  <!-- Centreer-op-mij-knop -->
  <button v-if="navMode || !destination" class="fab-recenter" aria-label="Centreer" @click="recenter">◎</button>

  <div v-if="drawingClosure" class="report-banner">
    <span>{{ bannerText }}</span>
    <button @click="cancelClosure">{{ t('cancel') }}</button>
  </div>

  <div v-if="toast" class="toast">{{ toast }}</div>

  <div v-if="!navMode && destination" class="panel">
    <div class="panel-head">
      <strong>{{ t('routes') }}</strong>
      <span class="approx">{{ settings.plate === 'blauw' ? t('snorfiets_approx') : t('bromfiets') }}</span>
      <button class="link" @click="clearRoute">{{ t('clear') }}</button>
    </div>

    <p v-if="loading" class="hint">{{ t('calculating') }}</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <ul v-else class="routes">
      <li v-for="(r, i) in routes" :key="i" :class="{ active: i === selectedIndex }" @click="selectedIndex = i">
        <span class="bar" :class="{ active: i === selectedIndex }"></span>
        <span class="label">
          {{ t('route') }} {{ i + 1 }}<em v-if="i === 0"> · {{ t('fastest') }}</em>
          <span v-if="routeBlocked[i]" class="warn">⚠ {{ t('along_closure') }}</span>
        </span>
        <span class="meta">{{ r.distanceKm.toFixed(1) }} km · {{ fmtDur(r.durationMin) }}</span>
      </li>
    </ul>
    <p v-if="routes.length && routeBlocked.length && routeBlocked.every((b) => b)" class="warn-note">
      ⚠ {{ t('no_free_route') }}
    </p>
    <div v-if="routes.length && !loading" class="nav-actions">
      <button class="go-btn" @click="startNavigation">▶ {{ t('start_nav') }}</button>
      <button class="sim-btn" @click="startSim">🧪 {{ t('simulate') }}</button>
    </div>
  </div>

  <!-- Bevestig-popup -->
  <div v-if="selectedReport" class="confirm-card">
    <div class="cc-head">
      <span>{{ emojiFor(selectedReport.type) }} {{ labelFor(selectedReport.type) }}</span>
      <button class="x" aria-label="X" @click="selectedReport = null">✕</button>
    </div>
    <p class="cc-q">{{ t('still_there') }}</p>
    <div v-if="!hasVoted" class="cc-actions">
      <button class="yes" @click="vote(true)">{{ t('yes') }}</button>
      <button class="no" @click="vote(false)">{{ t('gone') }}</button>
    </div>
    <p v-else class="cc-voted">{{ t('already_voted') }}</p>
    <p class="cc-prog">{{ remainingDenials }}× "{{ t('gone') }}" {{ t('votes_until_removed') }}.</p>
  </div>

  <!-- Type-kiezer -->
  <div v-if="showTypePicker" class="picker-overlay" @click.self="showTypePicker = false">
    <div class="picker">
      <strong>{{ t('what_to_report') }}</strong>
      <div class="types">
        <button v-for="rt in REPORT_TYPES" :key="rt.type" @click="pickType(rt.type)">
          <span class="emoji">{{ rt.emoji }}</span>
          <span class="t-label">{{ t(rt.key) }}</span>
          <span class="t-hint">{{ rt.type === 'wegafsluiting' ? t('draw_on_map') : t('on_your_location') }}</span>
        </button>
      </div>
    </div>
  </div>

  <SettingsPanel v-if="showSettings" @close="showSettings = false" />
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: #111;
  color: #fff;
  flex: 0 0 auto;
}
.brand {
  font-weight: 600;
  white-space: nowrap;
}
.toggle {
  display: flex;
  margin-left: auto;
  border: 1px solid #444;
  border-radius: 999px;
  overflow: hidden;
}
.toggle button {
  border: 0;
  background: transparent;
  color: #bbb;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}
.toggle button.active {
  background: #1e88e5;
  color: #fff;
}
.act {
  border: 0;
  background: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
}
.me {
  display: flex;
  align-items: center;
  gap: 4px;
}
.me img {
  width: 26px;
  height: 26px;
  border-radius: 50%;
}
.gbtn {
  min-height: 32px;
  display: flex;
  align-items: center;
}

.search {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 16px;
  z-index: 500;
}
.search input {
  width: 100%;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font-size: 16px;
  box-shadow: 0 3px 14px rgba(0, 0, 0, 0.25);
}
.search .results {
  list-style: none;
  margin: 0;
  padding: 0;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 58px; /* boven het zoekveld (pill staat onderaan) */
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}
.search .results li {
  padding: 12px 14px;
  cursor: pointer;
  font-size: 14px;
  border-bottom: 1px solid var(--border);
}
.search .results li:last-child {
  border-bottom: 0;
}
.search .searching {
  position: absolute;
  bottom: 58px;
  left: 0;
  background: var(--surface);
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-muted);
}
.fab-recenter {
  position: fixed;
  right: 12px;
  bottom: 130px;
  z-index: 550;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 0;
  background: var(--surface);
  color: var(--text);
  font-size: 22px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}

.nav-banner {
  position: fixed;
  top: 104px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 620;
  background: #1e88e5;
  color: #fff;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  max-width: 90%;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
.alert-banner {
  position: fixed;
  top: 104px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 619;
  background: #c62828;
  color: #fff;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
.alert-banner.stacked {
  top: 152px;
}
.report-banner {
  position: fixed;
  top: 104px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 600;
  display: flex;
  align-items: center;
  gap: 14px;
  background: #111;
  color: #fff;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.report-banner button {
  border: 0;
  background: none;
  color: #ffd54f;
  cursor: pointer;
}
.toast {
  position: fixed;
  bottom: calc(38vh + 16px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 650;
  background: #111;
  color: #fff;
  padding: 10px 16px;
  border-radius: 999px;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.confirm-card {
  position: fixed;
  bottom: calc(38vh + 16px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 660;
  width: min(320px, 92vw);
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
.cc-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}
.cc-head .x {
  border: 0;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
}
.cc-q {
  margin: 8px 0;
}
.cc-actions {
  display: flex;
  gap: 10px;
}
.cc-actions button {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 15px;
}
.cc-actions .yes {
  background: #e8f5e9;
  border-color: #a5d6a7;
}
.cc-actions .no {
  background: #ffebee;
  border-color: #ef9a9a;
}
.cc-voted {
  margin: 6px 2px 0;
  color: var(--accent);
  font-weight: 600;
}
.cc-prog {
  margin: 10px 2px 0;
  font-size: 12px;
  color: var(--text-muted);
}

.panel {
  flex: 0 0 auto;
  max-height: 38vh;
  overflow-y: auto;
  background: var(--surface);
  color: var(--text);
  border-top: 1px solid var(--border);
  padding: 10px 14px;
}
.hint {
  margin: 6px 2px;
  color: var(--text-muted);
}
.error {
  margin: 6px 2px;
  color: #e5534b;
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.panel-head .approx {
  font-size: 12px;
  color: var(--text-muted);
}
.panel-head .link {
  margin-left: auto;
  border: 0;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 13px;
}
.routes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.routes li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
}
.routes li.active {
  border-color: var(--accent);
  background: var(--surface-2);
}
.routes .bar {
  width: 6px;
  align-self: stretch;
  border-radius: 3px;
  background: #9aa0a6;
}
.routes .bar.active {
  background: var(--accent);
}
.routes .label {
  font-weight: 600;
}
.routes .label em {
  font-weight: 400;
  font-style: normal;
  color: var(--accent);
}
.routes .label .warn {
  display: block;
  font-weight: 400;
  font-size: 12px;
  color: #e5534b;
}
.routes .meta {
  margin-left: auto;
  color: var(--text);
  font-size: 14px;
}
.warn-note {
  margin: 8px 2px 0;
  font-size: 13px;
  color: #e5534b;
}
.nav-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.go-btn {
  flex: 2;
  padding: 12px;
  border: 0;
  background: var(--accent);
  color: #fff;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
}
.sim-btn {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
}

/* Navigatie-overlay (third-person modus) */
.nav-overlay {
  position: fixed;
  inset: 0;
  z-index: 800;
  pointer-events: none;
}
.nav-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: linear-gradient(#111, rgba(17, 17, 17, 0.82));
  color: #fff;
}
.nav-instruction {
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.nav-instruction .dist {
  font-size: 16px;
  font-weight: 500;
  color: #9ecbff;
}
.nav-alert {
  margin-top: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #ff8a80;
}
.nav-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  background: linear-gradient(rgba(17, 17, 17, 0.82), #111);
  color: #fff;
}
.nav-eta {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.nav-eta strong {
  font-size: 20px;
}
.nav-eta span {
  font-size: 13px;
  color: #cfd6dd;
}
.nav-stop {
  border: 0;
  background: #c62828;
  color: #fff;
  padding: 12px 22px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.speed-pill {
  position: absolute;
  left: 14px;
  bottom: 92px;
  pointer-events: none;
  background: #fff;
  color: #111;
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
.speed-pill small {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: #666;
}

.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 700;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.picker {
  width: min(420px, 100%);
  background: var(--surface);
  color: var(--text);
  border-radius: 14px 14px 0 0;
  padding: 16px;
}
.picker > strong {
  display: block;
  margin-bottom: 10px;
}
.picker .types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.picker .types button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  text-align: center;
}
.picker .types .emoji {
  font-size: 28px;
}
.picker .types .t-label {
  font-weight: 600;
}
.picker .types .t-hint {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
