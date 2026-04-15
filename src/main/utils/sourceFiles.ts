// Helper file for commpileCppFiles.ts and submitCppSubmission.ts
import { basename, dirname, extname, relative, resolve, sep } from 'node:path'

// Find and return common working directory
function getCommonWorkingDirectory(sourceFiles: string[]): string {
  // If no files were selected, just return current folder
  if (sourceFiles.length === 0) {
    return process.cwd()
  }

  // Convert every file path to absolute directory path
  // For example: dirname("C:\proj\a\main.cpp") -> "C:\proj\a"
  const directories = sourceFiles.map((filePath) => resolve(dirname(filePath)))

  // Use the first directory as the starting reference then compare every other directory against it
  const [firstDirectory, ...restDirectories] = directories

  // Break paths into an array of strings
  const firstSegments = firstDirectory.split(sep)
  // Assume the shared path is the whole thing
  let sharedLength = firstSegments.length
  // Compare the first path with each remaining path
  for (const nextDirectory of restDirectories) {
    const nextSegments = nextDirectory.split(sep)
    let index = 0

    while (
      index < sharedLength &&
      index < nextSegments.length &&
      firstSegments[index].toLowerCase() === nextSegments[index].toLowerCase()
    ) {
      index += 1
    }

    // Update the shared prefix
    sharedLength = index
  }

  // If the files don't share, fall back to first file's folder
  if (sharedLength === 0) {
    return dirname(resolve(sourceFiles[0]))
  }

  // Rebuild the common path from the shared path pieces
  const sharedSegments = firstSegments.slice(0, sharedLength)
  const sharedDirectory = sharedSegments.join(sep)

  // On Windows, a drive-only prefix such as "C:" should resolve to the drive root "C:\"
  if (/^[A-Za-z]:$/.test(sharedDirectory)) {
    return `${sharedDirectory}${sep}`
  }

  // If join returns an empty string -> return the filesystem root
  return sharedDirectory || sep
}

// Return only the C++ implementation files
function getCppImplementationFiles(sourceFiles: string[]): string[] {
  return sourceFiles.filter((filePath) => {
    const extension = extname(filePath).toLowerCase()

    return (
      extension === '.cpp' || extension === '.cc' || extension === '.cxx' || extension === '.cp'
    )
  })
}

// Build a path to store inside a submission folder
function getSubmissionRelativePath(rootDirectory: string, filePath: string): string {
  const relativePath = relative(rootDirectory, filePath)

  // If file is inside the root directory -> return its relative path
  // If file is outside the root directory -> return its filename
  return relativePath && !relativePath.startsWith('..') ? relativePath : basename(filePath)
}

export { getCommonWorkingDirectory, getCppImplementationFiles, getSubmissionRelativePath }
