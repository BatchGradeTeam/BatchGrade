// Potentially Temporary File: May be deleted in the future.
/* TEST ONLY DELETE WHEN DONE */
// This info was more or less copied from: https://www.electronjs.org/docs/latest/tutorial/ipc
// Fitted to our project needs
import { dialog } from 'electron'

async function selectFile(): Promise<string | undefined> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile']
  })
  if (!canceled) {
    return filePaths[0]
  }
  return undefined
}

async function stringifyFile(filePath: string): Promise<string> {
  const fs = await import('fs/promises')
  const fileContent = await fs.readFile(filePath, 'utf-8')
  return fileContent
}
/* TEST ONLY DELETE WHEN DONE */

// @ Issue 9: For compiling files
async function selectCppFiles(): Promise<string[]> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'C++ Files',
        extensions: ['cpp', 'h', 'cc', 'cxx', 'hpp', 'cp']
      }
    ]
  })

  if (!canceled) {
    return filePaths
  }

  return []
}

/**
 * Represents all C++ files found inside one student folder.
 */
type SubmissionFolderGroup = {
  folderName: string
  folderPath: string
  cppFiles: string[]
}

/**
 * Opens a parent submissions folder and scans each direct subfolder.
 * For each subfolder, all C++ files are collected and grouped together.
 *
 * Example structure:
 * submissions/
 *   student1/
 *     main.cpp
 *     helper.cpp
 *   student2/
 *     solution.cpp
 *
 * @returns Array of grouped student submissions
 */
async function selectSubmissionFolder(): Promise<SubmissionFolderGroup[]> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })

  if (canceled || filePaths.length === 0) {
    return []
  }

  const fs = await import('fs/promises')
  const path = await import('path')

  const parentFolderPath = filePaths[0]

  // Read all entries inside the selected parent folder
  const entries = await fs.readdir(parentFolderPath, { withFileTypes: true })

  // Valid C++ file extensions
  const cppExtensions = new Set(['.cpp', '.h', '.cc', '.cxx', '.hpp', '.cp'])

  // Store grouped student submissions
  const submissionGroups: SubmissionFolderGroup[] = []

  // Loop through each entry in the parent folder
  for (const entry of entries) {
    // Skip anything that is not a folder (we only want student folders)
    if (!entry.isDirectory()) {
      continue
    }

    const studentFolderPath = path.join(parentFolderPath, entry.name)

    // Read all files inside the student folder
    const studentFolderEntries = await fs.readdir(studentFolderPath, { withFileTypes: true })

    // Collect all valid C++ files inside this folder
    const cppFiles = studentFolderEntries
      .filter((child) => child.isFile())
      .map((child) => path.join(studentFolderPath, child.name))
      .filter((fullPath) => cppExtensions.has(path.extname(fullPath).toLowerCase()))

    // Only include folders that contain at least one C++ file
    if (cppFiles.length > 0) {
      submissionGroups.push({
        folderName: entry.name,
        folderPath: studentFolderPath,
        cppFiles
      })
    }
  }

  return submissionGroups
}

export { selectFile, stringifyFile, selectCppFiles, selectSubmissionFolder }
