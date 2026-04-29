/*
  Language Definitions
  - Configurations for C++, Python, and Java
  - Each language specifies Docker image, compiler, extensions, and execution strategy
*/

export type Language = 'cpp' | 'python' | 'java'

// Language config info needed for compilation and execution
export interface LanguageConfig {
  id: Language
  name: string
  extensions: string[]
  dockerImage: string
  compiler: string
  exeExtension: string
  needsCompilation: boolean
}

// C++ configuration
export const cppConfig: LanguageConfig = {
  id: 'cpp',
  name: 'C++',
  extensions: ['.cpp', '.cc', '.cxx', '.cp', '.h', '.hpp'],
  dockerImage: 'gcc:14',
  compiler: 'g++',
  exeExtension: process.platform === 'win32' ? '.exe' : '',
  needsCompilation: true
}

// Python configuration
// Placeholder if we have time
export const pythonConfig: LanguageConfig = {
  id: 'python',
  name: 'Python',
  extensions: ['.py'],
  dockerImage: 'python:3.12-slim',
  compiler: 'python3',
  exeExtension: '',
  needsCompilation: false
}

// Java configuration
// Placeholder if we have time
export const javaConfig: LanguageConfig = {
  id: 'java',
  name: 'Java',
  extensions: ['.java'],
  dockerImage: 'eclipse-temurin:21-jdk-alpine',
  compiler: 'javac',
  exeExtension: '',
  needsCompilation: true
}

// Helper function to ensure that we support only real language configs
export function getLanguage(id: Language): LanguageConfig {
  const configs: Record<Language, LanguageConfig> = {
    cpp: cppConfig,
    python: pythonConfig,
    java: javaConfig
  }
  return configs[id]
}

function getFilename(path: string): string {
  const normalizedPath = path.replaceAll('\\', '/')
  return normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1)
}

export function detectPythonMainFile(files: string[]): string | null {
  if (files.length === 0) {
    return null
  }

  const pythonFiles = files.filter((file) => file.endsWith('.py'))
  if (pythonFiles.length === 0) {
    return null
  }

  const mainFile = pythonFiles.find((file) => getFilename(file) === 'main.py')
  return mainFile ?? pythonFiles[0]
}

export async function detectJavaMainClass(files: string[]): Promise<string | null> {
  if (files.length === 0) {
    return null
  }

  const javaFiles = files.filter((file) => file.endsWith('.java'))
  if (javaFiles.length === 0) {
    return null
  }

  const { readFile } = await import('fs/promises')

  for (const file of javaFiles) {
    try {
      const source = await readFile(file, 'utf8')
      const classMatch = source.match(/\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\b/)
      const hasMainMethod =
        /\bpublic\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]\s+\w+\s*\)/.test(source)

      if (classMatch && hasMainMethod) {
        return classMatch[1]
      }
    } catch {
      // Ignore unreadable files and continue scanning the rest.
    }
  }

  return null
}
