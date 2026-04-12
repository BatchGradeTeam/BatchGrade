/*
  Language Definitions
  - Configurations for C++, Python, and Java
  - Each language specifies Docker image, compiler, extensions, and execution strategy
*/

export type Language = 'cpp' | 'python' | 'java'

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

export function getLanguage(id: Language): LanguageConfig {
  const configs: Record<Language, LanguageConfig> = {
    cpp: cppConfig,
    python: pythonConfig,
    java: javaConfig
  }
  return configs[id]
}

