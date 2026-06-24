import type { LocationProvider } from './types'
import { WebLocationProvider } from './webLocation'

/**
 * Eén plek die bepaalt welke locatiebron we gebruiken.
 * Nu: web (browser-GPS). Later op mobiel: return new CapacitorLocationProvider().
 */
export function createLocationProvider(): LocationProvider {
  return new WebLocationProvider()
}

export type { LocationProvider, Position } from './types'
