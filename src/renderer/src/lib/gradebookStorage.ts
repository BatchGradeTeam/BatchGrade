/**
 * @file gradebookStorage.ts
 * @description Stores and loads Gradebook records for the temporary
 * localStorage-based Gradebook integration.
 */

import type { GradebookRecord } from '../../../shared/gradebookTypes'
import { loadServerGradebookRecords, saveServerGradebookRecord } from './serverData'

const GRADEBOOK_STORAGE_KEY = 'gradebookRecords'

async function loadLocalGradebookRecords(): Promise<GradebookRecord[]> {
  try {
    const rawData = localStorage.getItem(GRADEBOOK_STORAGE_KEY)

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
 * Loads all saved Gradebook records from localStorage.
 *
 * @returns Promise resolving to all saved Gradebook records
 */
export async function loadGradebookRecords(): Promise<GradebookRecord[]> {
  try {
    const serverRecords = await loadServerGradebookRecords()
    return serverRecords
  } catch (error) {
    console.error('Failed to load server Gradebook records, using local cache:', error)
  }

  return loadLocalGradebookRecords()
}

/**
 * Saves a new Gradebook record to localStorage.
 *
 * @param record - Gradebook record to save
 * @returns Promise resolving when save is complete
 */
export async function saveGradebookRecord(record: GradebookRecord): Promise<void> {
  try {
    await saveServerGradebookRecord(record)
  } catch (error) {
    console.error('Failed to save server Gradebook record, using local cache:', error)
  }

  try {
    const existingRecords = await loadLocalGradebookRecords()
    const updatedRecords = [...existingRecords, record]

    localStorage.setItem(GRADEBOOK_STORAGE_KEY, JSON.stringify(updatedRecords))
  } catch (error) {
    console.error('Failed to save Gradebook record:', error)
  }
}

/**
 * Clears all saved Gradebook records from localStorage.
 *
 * @returns Promise resolving when records are cleared
 */
export async function clearGradebookRecords(): Promise<void> {
  try {
    localStorage.removeItem(GRADEBOOK_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear Gradebook records:', error)
  }
}
