
// Imports
import { useEffect, useState } from 'react'

// This is just a shared type / data shape 
import type {
  CompileCppResult,
  GccInstallationInfo,
  RunCppResult
} from '../../../../shared/compiler'

// These are the wrapper functions from cppWorkflowApis.tx
// These are essentially the wrapper/middle man between this and
// window.api
import {
  compileCppFiles,
  getCompilerStatus,
  runCompiledProgram,
  selectCppFiles,
  setCompilerPath
} from '../../components/compiler/cppWorkflowApi'


// these are optional items denoted by ?, So we don't necessarily need these when
// we make a call, howevver these will return whether or not a change was made in
// in the selection of a file, or a change was made in coompile results
type UseCppWorkflowProps = {
  onSelectionChange?: (files: string[]) => void
  onCompileResultChange?: (result: CompileCppResult | null) => void
}

// This is what the hook gives us back, ie
// gccStatus do we have a gcc version
// result of compile
// output from run
// Error Messages, these can all be outputted to the user
// setManualPath actually changes the value to manual path
// and anything with handle is a promise where a button from a ui item
// can call and do the thing
type UseCppWorkflowReturn = {
  gccStatus: GccInstallationInfo | null
  compileResult: CompileCppResult | null
  runResult: RunCppResult | null
  errorMessage: string | null
  manualPath: string
  selectedFiles: string[]
  stdinText: string
  isCompiling: boolean
  isRunning: boolean
  setManualPath: React.Dispatch<React.SetStateAction<string>>
  setStdinText: React.Dispatch<React.SetStateAction<string>>
  handleSetManualPath: () => Promise<void>
  handleSelectCppFiles: () => Promise<void>
  handleCompileCpp: () => Promise<void>
  handleRunProgram: () => Promise<void>
}


// onselection, oncompile are optional parameters, we can use these but are not required
// just useful. Everything below it is a state variable, ie something that we are actually
// storing from input/output of either the user or api, compilation etc
// Further are just more functions.
export function useCppWorkflow({
  onSelectionChange,
  onCompileResultChange
}: UseCppWorkflowProps): UseCppWorkflowReturn {
  const [gccStatus, setGccStatus] = useState<GccInstallationInfo | null>(null)
  const [compileResult, setCompileResult] = useState<CompileCppResult | null>(null)
  const [runResult, setRunResult] = useState<RunCppResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [manualPath, setManualPath] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [stdinText, setStdinText] = useState('')
  const [isCompiling, setIsCompiling] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

    // Loads the gcc status when we start/open anywhere we use this panel
  useEffect(() => {
    async function loadCompilerStatus(): Promise<void> {
      try {
        const result = await getCompilerStatus()
        setGccStatus(result)
      } catch (error) {
        console.error('Error getting GCC status:', error)
        setErrorMessage('Could not load GCC status.')
      }
    }

    void loadCompilerStatus()
  }, [])
  // Tells us when a file has changed
  useEffect(() => {
    onSelectionChange?.(selectedFiles)
  }, [onSelectionChange, selectedFiles])
  //Tells us when a compile result has changed
  useEffect(() => {
    onCompileResultChange?.(compileResult)
  }, [compileResult, onCompileResultChange])

  async function handleSetManualPath(): Promise<void> {
    try {
      const result = await setCompilerPath(manualPath)
      setGccStatus(result)
      setErrorMessage(null)
    } catch (error) {
      console.error('Error setting GCC path:', error)
      setErrorMessage('Could not save manual GCC path.')
    }
  }

  async function handleSelectCppFiles(): Promise<void> {
    try {
      const files = await selectCppFiles()
      setSelectedFiles(files)
      setCompileResult(null)
      setRunResult(null)
      setErrorMessage(null)
    } catch (error) {
      console.error('Error selecting C++ files:', error)
      setErrorMessage('Could not select C++ files.')
    }
  }

  // This actually handles compilation.
  // First we set isCompiling to true, and the other stuff to false
  // then we run compile on the selected file, and wait to see if we get a result
  // if it does not error we have that value, otherwise we will error, and lastly
  // set the iscompiling to false. 
  // We use the compilecppfiles which is a wrapper in the api's file. That then
  // uses a backend electron ipc to  utilize a locally installed compiler, and we 
  // ultimately capture those results and this will fail/pass based on the compiler
  // output
  async function handleCompileCpp(): Promise<void> {
    setIsCompiling(true)
    setErrorMessage(null)
    setCompileResult(null)
    setRunResult(null)

    try {
      const result = await compileCppFiles(selectedFiles)
      setCompileResult(result)
    } catch (error) {
      console.error('Error compiling C++ files:', error)
      setErrorMessage('Could not compile the selected files.')
    } finally {
      setIsCompiling(false)
    }
  }

  // This works similar to the compiler one above, but actually runs our compiler output
  // assuming that the compiler did not fail on compilation
  async function handleRunProgram(): Promise<void> {
    if (!compileResult?.executablePath) {
      setErrorMessage('Compile the program first.')
      return
    }

    setIsRunning(true)
    setErrorMessage(null)
    setRunResult(null)

    try {
      const result = await runCompiledProgram(
        compileResult.executablePath,
        stdinText,
        5000
      )
      setRunResult(result)
    } catch (error) {
      console.error('Error running compiled program:', error)
      setErrorMessage('Could not run the compiled program.')
    } finally {
      setIsRunning(false)
    }
  }

  // Our return essentially just returns a giant struct of state items which were set by this amalgomation
  // of beautifully constructed, and well thought out code.
  return {
    gccStatus,
    compileResult,
    runResult,
    errorMessage,
    manualPath,
    selectedFiles,
    stdinText,
    isCompiling,
    isRunning,
    setManualPath,
    setStdinText,
    handleSetManualPath,
    handleSelectCppFiles,
    handleCompileCpp,
    handleRunProgram
  }
}