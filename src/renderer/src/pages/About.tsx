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
import React from 'react'
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'

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

      {/*-----------------------------------------------------------
        About Section
          Overview of the BatchGrade platform
        -----------------------------------------------------------*/}
      <div className="about-container">
        <h1 className="title about">About</h1>
        <p className="about-blot">
          <span className="emphasis hover-underline">Batchgrade</span> is a locally hosted automated
          grading platform designed to streamline the evaluation of programming assignments in
          academic environments. The system enables instructors to compile, test, and manage
          submissions through an integrated gradebook interface, while students receive consistent
          and structured feedback. Built with a modular web-based architechture and local deployment
          capability, BatchGrade eliminates reliance on costly cloud-based services. By reducing
          grading time and improving assessment reliability, the platform increases instructional
          efficiency and supports scalable computer science education.
        </p>
      </div>

      {/*-----------------------------------------------------------
        Page Footer
        -----------------------------------------------------------*/}
      <Footer />
    </>
  )
}
