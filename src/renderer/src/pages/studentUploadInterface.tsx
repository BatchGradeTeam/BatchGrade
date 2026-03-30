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
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/Navbar'
import Footer from '../components/Footer'
import { CppWorkflowPanel } from '../components/compiler/CppWorkflowPanel'

/**
 * StudentUploadInterface Component
 *
 * Provides the interface for students to upload their project code files
 * for grading within the BatchGrade application.
 *
 * @returns StudentUploadInterface(): React.JSX.Element
 */
export function StudentUploadInterface(): React.JSX.Element {
  const navigate = useNavigate()



  return (
    <>
      <NavBar />

<div className="cpp-page">
  <div className="cpp-content">
    <CppWorkflowPanel
      title="Project Code Submission"
      description="Upload and compile your C++ project files for grading."
      allowExecution={true}
    />

    <button className="secondary-button" onClick={() => navigate('/')}>
      Go to Home
    </button>
  </div>
</div>

<Footer />
    </>
  )
}

export default StudentUploadInterface
