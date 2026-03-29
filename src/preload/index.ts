import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AppAPI,
  AssignmentsAPI,
  CompilerAPI,
  FileAPI,
  SubmissionsAPI,
  UsersAPI
} from './types'

const usersApi: UsersAPI = {
  getAll: () => ipcRenderer.invoke('users:getAll'),
  create: (data) => ipcRenderer.invoke('users:create', data),
  update: (data) => ipcRenderer.invoke('users:update', data),
  delete: (uuid) => ipcRenderer.invoke('users:delete', uuid)
}

const compilerApi: CompilerAPI = {
  getGccStatus: () => ipcRenderer.invoke('compiler:getGccStatus'),
  setGccPath: (filePath: string) => ipcRenderer.invoke('compiler:setGccPath', filePath),
  compileCpp: (request) => ipcRenderer.invoke('compiler:compileCpp', request),
  runCompiledProgram: (request) => ipcRenderer.invoke('compiler:runCompiledProgram', request),
  judgeCpp: (request) => ipcRenderer.invoke('compiler:judgeCpp', request)
}

const fileApi: FileAPI = {
  select: () => ipcRenderer.invoke('file:select'),
  selectCppFiles: () => ipcRenderer.invoke('file:selectCppFiles'),
  stringify: (filePath: string) => ipcRenderer.invoke('file:stringify', filePath)
}

const submissionsApi: SubmissionsAPI = {
  submitCpp: (request) => ipcRenderer.invoke('submissions:submitCpp', request)
}

const assignmentsApi: AssignmentsAPI = {
  getAll: () => ipcRenderer.invoke('assignments:getAll'),
  create: (data) => ipcRenderer.invoke('assignments:create', data),
  update: (data) => ipcRenderer.invoke('assignments:update', data),
  delete: (uuid) => ipcRenderer.invoke('assignments:delete', uuid)
}

// Custom APIs for renderer
const api: AppAPI = {
  users: usersApi,
  assignments: assignmentsApi,
  file: fileApi,
  compiler: compilerApi,
  submissions: submissionsApi
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
