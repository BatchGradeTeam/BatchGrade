/**
 * AboutPanel
 *
 * Reusable content panel for the About experience.
 */
import '../assets/styles/AboutPanel.css'

export function AboutPanel(): React.JSX.Element {
  return (
    <div className="about-panel panel-shell">
      <div className="about-panel-header">
        <h2 className="about-panel-title">About BatchGrade</h2>
        <p className="about-panel-subtitle">Learn more about BatchGrade and its features below.</p>
      </div>

      <div className="about-panel-card">
        <p className="about-panel-body">
          <span className="about-panel-emphasis">BatchGrade</span> is a locally hosted automated
          grading platform designed to streamline the evaluation of programming assignments in
          academic environments. The system enables instructors to compile, test, and manage
          submissions through an integrated gradebook interface, while students receive consistent
          and structured feedback. Built with a modular web-based architecture and local deployment
          capability, BatchGrade eliminates reliance on costly cloud-based services. By reducing
          grading time and improving assessment reliability, the platform increases instructional
          efficiency and supports scalable computer science education.
        </p>
      </div>
    </div>
  )
}
