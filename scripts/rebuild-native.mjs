import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const electronVersion = require('electron/package.json').version
const betterSqlitePackagePath = require.resolve('better-sqlite3/package.json')
const betterSqliteDir = path.dirname(betterSqlitePackagePath)
// Fetch the prebuilt native addon for the exact Electron runtime we package.
// This avoids shipping the plain Node.js binary, which caused the Windows app
// to stay backgrounded because the main process crashed before opening a window.
const prebuildInstallBin = require.resolve('prebuild-install/bin.js', {
  paths: [betterSqliteDir]
})

const result = spawnSync(
  process.execPath,
  [prebuildInstallBin, '-r', 'electron', '-t', electronVersion],
  {
    cwd: betterSqliteDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_runtime: 'electron',
      npm_config_target: electronVersion
    }
  }
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
