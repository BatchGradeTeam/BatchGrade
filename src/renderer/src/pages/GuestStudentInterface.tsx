/**
 * StudentUploadInterface.tsx
 *
 * Description:
 * This component implements the student upload interface for the BatchGrade application.
 * It provides a simple UI for students to submit their project code files for grading.
 *
 * The interface includes:
 *  - A title indicating the purpose of the page
 *  - A button to trigger the file submission process (currently simulated with an alert)
 *  - A navigation button to return to the home page
 *
 * This component is intended to be expanded in the future to include actual file upload functionality,
 * validation, and integration with the backend grading system.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { CppWorkflowPanel } from '../components/compiler/CppWorkflowPanel'
import { DockerDetectionPanel } from '../components/DockerDetectionPanel'
import { DockerCppGradePanel } from '../components/DockerCppGradePanel'

/**
 * StudentUploadInterface Component
 *
 * Provides the interface for students to upload their project code files
 * for grading within the BatchGrade application.
 *
 * @returns StudentUploadInterface(): React.JSX.Element
 */
export function GuestStudentInterface(): React.JSX.Element {
  const navigate = useNavigate()
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  // const [compileResult, setCompileResult] = useState<CompileCppResult | null>(null)

  // This is just an easy work around, so that way we dont trigger selectFiles, compileResult not used
  console.log(selectedFiles)
  // console.log(compileResult)

  return (
    <>
      <NavBar />
      <div className="dashboard-header">
        <div className="dashboard-header-container interface-icon"></div>
        <div className="dashboard-header-container">
          <h1 className="title">Guest Compiler Interface</h1>
          <p className="subtitle">Compile your code without the extras</p>
        </div>
      </div>
      <div className="dashboard-container">
        <CppWorkflowPanel
          title="Student Compilation Workspace"
          description="Choose the files you want to submit, compile them, optionally run them with input, and review the output before submitting."
          autoCompileOnSelection={true}
          allowExecution={true}
          onSelectionChange={setSelectedFiles}
          // onCompileResultChange={setCompileResult}
        />

        {/* <SubmitPanel
          compileResult={compileResult}
          selectedFiles={selectedFiles}
          userId={user?.uuid}
        /> */}

        <DockerDetectionPanel />
        <DockerCppGradePanel sourceFiles={selectedFiles} />
      </div>

      <div className="button-container">
        <button className="secondary-button" onClick={() => navigate('/studentdashboard')}>
          Go Home
        </button>
      </div>

      <Footer />
    </>
  )
}
