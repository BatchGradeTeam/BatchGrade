/*
  dockerDetection.ts:
  - Detects if docker is available on the system.
*/

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import type { DockerInstallationInfo, SupportedPlatform } from '../../shared/compiler'

const execFileAsync = promisify(execFile)

// Check if Docker CLI is installed and get version
async function checkDockerInstalled(command: string): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(command, ['--version'], {
      windowsHide: true,
      timeout: 8000
    })

    const output = stdout || stderr
    if (!output) return null

    // Extract version like "24.0.0" from "Docker version 24.0.0, build abc123"
    const match = output.match(/(\d+\.\d+\.\d+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// Check if Docker is running
async function isDockerRunning(): Promise<boolean> {
  try {
    await execFileAsync('docker', ['ps'], {
      windowsHide: true,
      timeout: 8000
    })
    return true
  } catch {
    return false
  }
}

// Detect Docker installation and running status
export async function detectDockerInstallation(): Promise<DockerInstallationInfo> {
  let platform: SupportedPlatform
  if (process.platform === 'win32') {
    // On windows
    platform = 'win32'
  } else if (process.platform === 'darwin') {
    // On macOS
    platform = 'darwin'
  } else if (process.platform === 'linux') {
    // On Linux
    platform = 'linux'
  } else {
    // Unknown platform
    platform = 'unknown'
  }

  // Check if Docker is installed and running
  const [version, running] = await Promise.all([checkDockerInstalled('docker'), isDockerRunning()])

  // Docker not installed
  if (version === null) {
    return {
      containerId: 'docker',
      status: 'missing',
      platform,
      path: null,
      message: 'Docker is not installed.',
      installInstruction: null,
      version: null,
      source: null
    }
  }

  // Docker installed but not running
  if (!running) {
    return {
      containerId: 'docker',
      status: 'not-running',
      platform,
      path: 'docker',
      message: 'Docker is not running.',
      installInstruction: null,
      version,
      source: 'auto'
    }
  }

  // Docker ready
  return {
    containerId: 'docker',
    status: 'ready',
    platform,
    path: 'docker',
    message: `Docker ${version} is ready`,
    installInstruction: null,
    version,
    source: 'auto'
  }
}
