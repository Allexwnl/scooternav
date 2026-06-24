/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAP_STYLE_URL?: string
  readonly VITE_REPORTS_BACKEND?: 'mock' | 'api'
  readonly VITE_VALHALLA_URL?: string
  readonly VITE_API_URL?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
