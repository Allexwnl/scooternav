import { reactive, ref, watch } from 'vue'
import type { Plate } from '../services/routing/types'
import type { ReportType } from '../services/reports/types'

export type ThemeMode = 'licht' | 'donker' | 'auto'
export type Locale = 'nl' | 'en'

export interface Settings {
  theme: ThemeMode
  plate: Plate
  locale: Locale
  voice: boolean // gesproken navigatie-instructies
  speedWarning: boolean // waarschuwing bij te hard rijden
  keepAwake: boolean // scherm aan tijdens navigatie
  hiddenTypes: ReportType[] // verborgen meldingtypes (filter)
  home: { lng: number; lat: number; label: string } | null
  work: { lng: number; lat: number; label: string } | null
  snapToRoad: boolean // pijl op de weg vastzetten (aan) of exacte ruwe GPS tonen (uit)
  onboarded: boolean // eerste-keer-uitleg al gezien
}

const STORAGE_KEY = 'scooter-nav.settings'

const defaults: Settings = {
  theme: 'auto',
  plate: 'geel',
  locale: 'nl',
  voice: true,
  speedWarning: true,
  keepAwake: true,
  hiddenTypes: [],
  home: null,
  work: null,
  snapToRoad: true,
  onboarded: false,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    /* corrupte opslag → defaults */
  }
  return { ...defaults }
}

/** Eén reactieve, persistente instellingen-store. */
export const settings = reactive<Settings>(load())

watch(
  settings,
  (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch {
      /* opslag vol/geblokkeerd */
    }
  },
  { deep: true },
)

// Thema toepassen. 'auto' = volg het systeem (dag/nacht) via prefers-color-scheme —
// geen zonsondergang-berekening nodig, het OS weet het al.
// Reactieve, opgeloste dag/nacht-stand (auto meegerekend). Zowel de CSS als de
// kaartstijl (MapView) lezen dit, zodat 'auto' overal klopt.
export const isDark = ref(false)
const mql = window.matchMedia('(prefers-color-scheme: dark)')
function applyTheme() {
  isDark.value = settings.theme === 'donker' || (settings.theme === 'auto' && mql.matches)
  document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light'
}
watch(() => settings.theme, applyTheme, { immediate: true })
mql.addEventListener('change', applyTheme) // 's avonds vanzelf donker, ook zonder heropenen
