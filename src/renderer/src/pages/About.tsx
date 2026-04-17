/**
 * About.tsx
 *
 * Description:
 * This component serves as the "About" page for the BatchGrade application.
 * It provides users with information about the application, including its
 * purpose, features, and contact information for support. The page is designed
 * to be informative and visually appealing, using Tailwind CSS for styling.
 *
 * Features:
 * - Overview of the BatchGrade application and its goals
 * - List of key features and functionalities
 * - Contact information for support and feedback
 * - Responsive design for various screen sizes
 */
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { AboutPanel } from '../components/AboutPanel'

/**
 * About Component
 *
 * Renders the "About" page with information about the BatchGrade application.
 * This page includes an overview of the application, its features, and contact
 * information for users who need support or want to provide feedback.
 *
 * @returns About(): React.JSX.Element
 */
export function About(): React.JSX.Element {
  return (
    <>
      <NavBar />

      <div className="dashboard-header">
        <h1 className="title about">About BatchGrade</h1>
      </div>
      <div className="dashboard-container">
        <AboutPanel />
      </div>

      <div className="button-container">
        <button className="secondary-button" onClick={() => window.history.back()}>
          Back to Dashboard
        </button>
      </div>

      {/*-----------------------------------------------------------
        Page Footer
        -----------------------------------------------------------*/}
      <Footer />
    </>
  )
}
