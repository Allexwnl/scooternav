import { reactive, watch } from 'vue'
import type { Plate } from '../services/routing/types'
import type { ReportType } from '../services/reports/types'

export type ThemeMode = 'licht' | 'donker'
export type Locale = 'nl' | 'en'

export interface Settings {
  theme: ThemeMode
  plate: Plate
  locale: Locale
  voice: boolean // gesproken navigatie-instructies
  keepAwake: boolean // scherm aan tijdens navigatie
  hiddenTypes: ReportType[] // verborgen meldingtypes (filter)
}

const STORAGE_KEY = 'scooter-nav.settings'

const defaults: Settings = {
  theme: 'licht',
  plate: 'geel',
  locale: 'nl',
  voice: true,
  keepAwake: true,
  hiddenTypes: [],
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

watch(
  () => settings.theme,
  (t) => {
    document.documentElement.dataset.theme = t === 'donker' ? 'dark' : 'light'
  },
  { immediate: true },
)
