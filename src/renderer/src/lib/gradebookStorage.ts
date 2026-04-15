/**
 * @file gradebookStorage.ts
 * @description Stores and loads Gradebook records for the temporary
 * localStorage-based Gradebook integration.
 */

import type { GradebookRecord } from '../../../shared/gradebookTypes'

const GRADEBOOK_STORAGE_KEY = 'gradebookRecords'

/**
 * Loads all saved Gradebook records from localStorage.
 *
 * @returns Promise resolving to all saved Gradebook records
 */
export async function loadGradebookRecords(): Promise<GradebookRecord[]> {
  try {
    const rawData = localStorage.getItem(GRADEBOOK_STORAGE_KEY)

    if (!rawData) {
      return []
    }

    return JSON.parse(rawData) as GradebookRecord[]
  } catch (error) {
    console.error('Failed to load Gradebook records:', error)
    return []
  }
}

/**
 * Saves a new Gradebook record to localStorage.
 *
 * @param record - Gradebook record to save
 * @returns Promise resolving when save is complete
 */
export async function saveGradebookRecord(record: GradebookRecord): Promise<void> {
  try {
    const existingRecords = await loadGradebookRecords()
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
