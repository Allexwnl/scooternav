import type { ReportsBackend } from './types'
import { MockReportsBackend } from './mockReports'
import { ApiReportsBackend } from './apiReports'

/**
 * Backend wisselen via .env: VITE_REPORTS_BACKEND=mock|api.
 * - mock = voorbeeldmeldingen (geen server nodig)
 * - api  = je eigen REST-server (zie server/)
 * De rest van de app raakt dit nooit aan — die kent alleen de ReportsBackend-interface.
 */
export function createReportsBackend(): ReportsBackend {
  const choice = import.meta.env.VITE_REPORTS_BACKEND || 'mock'
  return choice === 'api' ? new ApiReportsBackend() : new MockReportsBackend()
}

export { DENY_THRESHOLD } from './types'
export type { ReportsBackend, Report, ReportType, NewReport, BoundingBox } from './types'
