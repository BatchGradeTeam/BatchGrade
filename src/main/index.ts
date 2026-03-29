/* eslint-disable prettier/prettier */
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDb } from './database/index'
import type { NewUser, UpdateUser, NewAssignment, UpdateAssignment } from './database/schema'
import { getAllUsers, createUser, updateUser, deleteUser } from './database/queries'
import { createSubmission, getSubmissionById } from './database/queries/submissionServices'
import { dialog } from 'electron'

import { getAllAssignments, createAssignment, updateAssignment } from './database/queries'
import { deleteAssignment } from './database/queries'

/* TEST ONLY DELETE WHEN DONE */
import { selectFile, stringifyFile, selectCppFiles } from './utils/file'
/* TEST ONLY DELETE WHEN DONE */

// @ Issue 9: Implement Automated Build & Compilation
import { detectGccInstallation, validateGccPath } from './compiler/gccDetection'
import type { GccInstallationInfo, SupportedPlatform } from '../shared/compiler'

import { compileCppFiles } from './compiler/compileCppFiles'
import { executeCppFiles } from './compiler/executeCppFiles'
import { judgeCppFiles } from './compiler/judgeCppFiles'
import { submitCppSubmission } from './submissions/submitCppSubmission'

let gccStatusPromise: Promise<GccInstallationInfo> | undefined
let manualGccPath: string | null = null
/*
  Need this helper function in case a user changes compiler settings or a compile step needs to revalidate the path
*/
function refreshGccStatus(): Promise<GccInstallationInfo> {
  gccStatusPromise = detectGccInstallation()
  return gccStatusPromise
}

function getSupportedPlatform(): SupportedPlatform {
  let platform : SupportedPlatform = 'unknown'

  if (process.platform === 'win32') {
    platform = 'win32'
  }                                                                                                       
  if (process.platform === 'darwin') {
    platform = 'darwin'
  }                                                                                                  
  if (process.platform === 'linux') {
    platform = 'linux'
  }

  return platform
}

/*
  @ Issue 9: If compilation fails unexpectedly due to compiler not found, revalidate the location/prompt to install
  Scenario: 
    - GCC may be detected at startup
    - Later on, the user uninstalls it, moves it, or the manual path is wrong
    - Compile is attempted with path the app thought was valid
  Why it's needed:
    - Without revalidation, the app may only show a vague compile failure   
    - User then cannot tell whether their code is bad or the compiler is missing  
  Shouldn't trigger on:
    - syntax errors
    - linker errors
    - missing student headers
    - undefined references
    - bad student code
*/
function isCompilerNotFoundError(stderr: string, message: string): boolean { // TODO: properly cite AI: https://chatgpt.com/share/69bb0b9d-e314-800e-8e15-cacc4b61f4e5
  const text = `${stderr}\n${message}`.toLowerCase()

  return (
    text.includes('no such file or directory') ||
    text.includes('cannot find the file') ||
    text.includes('command not found') ||
    text.includes('not recognized as an internal or external command') ||
    text.includes('spawn') ||
    text.includes('enoent')
  )
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.batchgrade.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize the database
  initDb()

  // Detect GCC during startup
  refreshGccStatus() // For renderers (Front-end developers): Use this to query a ready-made status object.

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Users CRUD
  ipcMain.handle('users:getAll', () => getAllUsers())
  ipcMain.handle('users:create', (_e, data: NewUser) => createUser(data))
  ipcMain.handle('users:update', (_e, data: UpdateUser) => updateUser(data))
  ipcMain.handle('users:delete', (_e, uuid: string) => deleteUser(uuid))

  // openFile operation FR1
  ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    // Only allows c++ files for now
    filters: [{ name: 'Source Files', extensions: ['cpp'] }]
  })
  if (result.canceled) return null
  return result.filePaths[0]
  })

  // Submissions CRUD
  ipcMain.handle('submissions:create', (_e, data: {
    studentId: string
    assignmentId: string
    fileName: string
    filePath: string
  }) => createSubmission(data))

  ipcMain.handle('submissions:getById', (_e, submissionId: string) =>
    getSubmissionById(submissionId)
  )
  // Assignments CRUD
  ipcMain.handle('assignments:getAll', () => getAllAssignments())
  ipcMain.handle('assignments:create', (_event, data: NewAssignment) => createAssignment(data))
  ipcMain.handle('assignments:update', (_event, data: UpdateAssignment) => updateAssignment(data))
  ipcMain.handle('assignments:delete', (_event, uuid: string) => deleteAssignment(uuid))

  // Compiler Status
  ipcMain.handle('compiler:getGccStatus', async () => gccStatusPromise ?? refreshGccStatus())

  // Validate the manual compiler path from the UI and make it the current GCC selection
  ipcMain.handle('compiler:setGccPath', async (_e, filePath: string) => {
    if ( !(await validateGccPath(filePath)) ) {
      return {
        compilerId: 'gcc',
        status: 'missing',
        platform: getSupportedPlatform(),
        message: 'The selected path is invalid. Use a C++ compiler such as g++, c++, or clang++.',
        installInstruction: null, // the user is prompted to install with instructions for their OS if they don't have a compiler installed
        path: null ,
        source: null // User can manually set the path to a GCC installation
      }
    }
    else { 
      manualGccPath = filePath

      const manualRes: GccInstallationInfo = {
        compilerId: 'gcc',
        status: 'ready',
        platform: getSupportedPlatform(),
        message: 'Manual GCC path has been saved successfully.',
        installInstruction: null, 
        path: manualGccPath,
        source: 'manual'
      }

      gccStatusPromise = Promise.resolve(manualRes)

      return manualRes
    }
  }) 

  /* TEST ONLY DELETE WHEN DONE */
  // File selection
  ipcMain.handle('file:select', () => selectFile())
  ipcMain.handle('file:selectCppFiles', () => selectCppFiles())
  ipcMain.handle('file:stringify', (_e, filePath: string) => stringifyFile(filePath))
  /* TEST ONLY DELETE WHEN DONE */

  // Compilation
  ipcMain.handle('compiler:compileCpp', async (_e, request) => {
    const gccStatus = await (gccStatusPromise ?? refreshGccStatus())

    if (gccStatus.status != 'ready' || !gccStatus.path) {
      return {
        compileSuccess: false,
        compilerPath: null,
        executablePath: null,
        sourceFiles: request.sourceFiles,
        stdout: '',
        stderr: '',
        message: 'GCC is not configured yet. Configure GCC before compiling.'
      }
    }

    // Revalidate Compiler
    const compileRes = await compileCppFiles(gccStatus.path, request)
    if (compileRes.compileSuccess) {
      return compileRes
    }
    
    // Only revalidate GCC if the failure looks like the compiler itself is missing or cannot be started
    const isCompilerMissing = isCompilerNotFoundError(
      compileRes.stderr,
      compileRes.message
    )
    if (!isCompilerMissing) {
      return compileRes
    }

    // If GCC is still missing, return an error so the UI can guide the user back to compiler setup or installation
    const refreshedStatus = await refreshGccStatus()
    if (refreshedStatus.status !== 'ready' || !refreshedStatus.path) {
      return {
        ...compileRes,
        compilerPath: null,
        executablePath: null,
        message: 'Compiler path is no longer valid. GCC was rechecked and not found.',
        stderr: `${compileRes.stderr}\n\nBatchGrade revalidated the compiler path and could not find GCC.`
      }
    }
    return compileCppFiles(refreshedStatus.path, request)
  })

  // Execution
  ipcMain.handle('compiler:runCompiledProgram', (_e, request) => {
    return executeCppFiles(request)
  })

  ipcMain.handle('compiler:judgeCpp', (_e, request) => {
    return judgeCppFiles(request)
  })

  ipcMain.handle('submissions:submitCpp', (_e, request) => {
    return submitCppSubmission(request)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
