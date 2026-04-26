// Potentially Temporary File: May be deleted in the future.
/* TEST ONLY DELETE WHEN DONE */
// This info was more or less copied from: https://www.electronjs.org/docs/latest/tutorial/ipc
// Fitted to our project needs
import { app, dialog } from 'electron'

type ServerSubmissionFile = {
  relativePath: string
  fileName: string
  content: string
}

type ServerSubmissionBundle = {
  submissionId: string
  studentId: string
  studentName: string
  files: ServerSubmissionFile[]
}

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
  studentId?: string
  studentName?: string
  serverSubmissionId?: string
}

function sanitizeFileSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file'
}

function buildSafeRelativePath(relativePath: string, fallbackFileName: string): string[] {
  const parts = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .map(sanitizeFileSegment)

  return parts.length > 0 ? parts : [sanitizeFileSegment(fallbackFileName)]
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

/**
 * Opens one folder and returns all files directly inside it.
 */
async function selectFilesFromFolder(): Promise<string[]> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })

  if (canceled || filePaths.length === 0) {
    return []
  }

  const fs = await import('fs/promises')
  const path = await import('path')

  const folderPath = filePaths[0]
  const entries = await fs.readdir(folderPath, { withFileTypes: true })

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(folderPath, entry.name))
    .sort((a, b) => a.localeCompare(b))

  return files
}

async function materializeServerSubmissions(
  bundles: ServerSubmissionBundle[]
): Promise<SubmissionFolderGroup[]> {
  const fs = await import('fs/promises')
  const path = await import('path')
  const rootFolderPath = path.join(app.getPath('temp'), 'batchgrade-server-submissions')

  await fs.mkdir(rootFolderPath, { recursive: true })

  return Promise.all(
    bundles.map(async (bundle) => {
      const displayName = bundle.studentName || bundle.studentId || bundle.submissionId
      const folderName = sanitizeFileSegment(`${displayName}-${bundle.submissionId}`)
      const folderPath = path.join(rootFolderPath, folderName)
      const cppFiles: string[] = []

      await fs.mkdir(folderPath, { recursive: true })

      for (const file of bundle.files) {
        const safeRelativeParts = buildSafeRelativePath(file.relativePath, file.fileName)
        const filePath = path.join(folderPath, ...safeRelativeParts)

        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, file.content, 'utf8')
        cppFiles.push(filePath)
      }

      return {
        folderName,
        folderPath,
        cppFiles,
        studentId: bundle.studentId,
        studentName: bundle.studentName,
        serverSubmissionId: bundle.submissionId
      }
    })
  )
}

export {
  selectFile,
  stringifyFile,
  selectCppFiles,
  selectSubmissionFolder,
  selectFilesFromFolder,
  materializeServerSubmissions
}
