/**
 * @file gradebookStorage.ts
 * @description Stores and loads Gradebook records for local, guest,
 * and server-backed Gradebook modes.
 */

import type { GradebookRecord } from '../../../shared/gradebookTypes'
import { loadServerGradebookRecords } from './serverData'

const GRADEBOOK_STORAGE_KEYS = {
  local: 'gradebookRecords',
  guest: 'guestGradebookRecords'
} as const

export type GradebookStorageMode = 'server' | 'local' | 'guest'

export async function loadLocalGradebookRecords(
  mode: Exclude<GradebookStorageMode, 'server'> = 'local'
): Promise<GradebookRecord[]> {
  try {
    const rawData = localStorage.getItem(GRADEBOOK_STORAGE_KEYS[mode])

    if (!rawData) {
      return []
    }

    return JSON.parse(rawData) as GradebookRecord[]
  } catch (error) {
    console.error('Failed to load local Gradebook records:', error)
    return []
  }
}

/**
 * Loads saved Gradebook records from the selected storage mode.
 *
 * @returns Promise resolving to all saved Gradebook records
 */
export async function loadGradebookRecords(
  mode: GradebookStorageMode = 'server'
): Promise<GradebookRecord[]> {
  if (mode === 'server') {
    try {
      const serverRecords = await loadServerGradebookRecords()
      return serverRecords
    } catch (error) {
      console.error('Failed to load server Gradebook records, using local cache:', error)
    }
  }

  return loadLocalGradebookRecords(mode === 'guest' ? 'guest' : 'local')
}

/**
 * Saves a new Gradebook record to the selected local storage mode.
 *
 * @param record - Gradebook record to save
 * @returns Promise resolving when save is complete
 */
export async function saveGradebookRecord(
  record: GradebookRecord,
  mode: GradebookStorageMode = 'local'
): Promise<void> {
  await saveLocalGradebookRecord(record, mode === 'guest' ? 'guest' : 'local')
}

export async function saveLocalGradebookRecord(
  record: GradebookRecord,
  mode: Exclude<GradebookStorageMode, 'server'> = 'local'
): Promise<void> {
  try {
    const existingRecords = await loadLocalGradebookRecords(mode)
    const updatedRecords = [...existingRecords, record]

    localStorage.setItem(GRADEBOOK_STORAGE_KEYS[mode], JSON.stringify(updatedRecords))
  } catch (error) {
    console.error('Failed to save Gradebook record:', error)
  }
}

/**
 * Clears all saved Gradebook records from localStorage.
 *
 * @returns Promise resolving when records are cleared
 */
export async function clearGradebookRecords(
  mode: Exclude<GradebookStorageMode, 'server'> = 'local'
): Promise<void> {
  try {
    localStorage.removeItem(GRADEBOOK_STORAGE_KEYS[mode])
  } catch (error) {
    console.error('Failed to clear Gradebook records:', error)
  }
}
