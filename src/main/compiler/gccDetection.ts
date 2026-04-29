/* eslint-disable prettier/prettier */
// Compiler Detection Service

import { execFile } from 'node:child_process'
import { basename } from 'node:path'
import { promisify } from 'node:util'

import type { GccInstallationInfo, SupportedPlatform } from '../../shared/compiler'

const execFileAsync = promisify(execFile)

async function gccCommand(command: string): Promise<string | null> {
  try {
    // Need error handling -> If command fails, it returns null safely
    const res = await execFileAsync(command, ['--version'], {
      windowsHide: true,
      timeout: 8000 // 8000 ms or 8 sec
    })

    if (res.stdout || res.stderr) {
      return command
    } else {
      return null
    }
  } catch {
    return null
  }
}

function isCppCompilerCommand(command: string): boolean {
  const name = basename(command).toLowerCase()

  return (
    name === 'g++' ||
    name === 'g++.exe' ||
    name === 'c++' ||
    name === 'c++.exe' ||
    name === 'clang++' ||
    name === 'clang++.exe' ||
    /^g\+\+-[\d.]+$/.test(name) ||
    /^clang\+\+-[\d.]+$/.test(name)
  )
}

function getInstallInstruction(platform: SupportedPlatform): string {
  switch (platform) {
    case 'win32':
      return 'Install GCC using MinGW (e.g., via MSYS2 or mingw-w64), then restart BatchGrade.'
    case 'darwin':
      return 'Install Xcode Command Line Tools by running `xcode-select --install`, then restart BatchGrade.'
    case 'linux':
      return 'Install GCC using your package manager (e.g., `sudo apt install build-essential` or `sudo yum install gcc`), then restart BatchGrade.'
    default:
      return 'Install GCC for your operating system, then restart BatchGrade.'
  }
}

// We need this helper function to check if the path that the user manually inputs is valid
async function validateGccPath(filePath: string): Promise<boolean> {
  if (!isCppCompilerCommand(filePath)) {
    return false
  }

  try {
    const res = await execFileAsync(filePath, ['--version'], {
      // We have to confirm that it works
      windowsHide: true,
      timeout: 8000
    })

    if (res.stdout || res.stderr) {
      return true
    } else {
      return false
    }
  } catch {
    return false
  }
}

async function detectGccInstallation(): Promise<GccInstallationInfo> {
  let platform: SupportedPlatform = 'unknown'
  if (process.platform === 'win32') {
    platform = 'win32'
  }
  if (process.platform === 'darwin') {
    platform = 'darwin'
  }
  if (process.platform === 'linux') {
    platform = 'linux'
  }

  let detectCompilerCommand: string | null = null
  if (platform === 'win32') {
    detectCompilerCommand = await gccCommand('g++.exe')
  } else {
    detectCompilerCommand =
      (await gccCommand('g++')) ?? (await gccCommand('c++')) ?? (await gccCommand('clang++'))
  }

  if (detectCompilerCommand) {
    return {
      compilerId: 'gcc',
      status: 'ready',
      platform,
      path: detectCompilerCommand,
      message: 'C++ compiler found.',
      installInstruction: null,
      source: 'auto'
    }
  } else {
    return {
      compilerId: 'gcc',
      status: 'missing',
      platform,
      path: detectCompilerCommand,
      message: 'No C++ compiler found.',
      installInstruction: getInstallInstruction(platform), // TODO: NEEDS CHECKING FIRST
      source: null
    }
  }
}

export { detectGccInstallation, validateGccPath }
