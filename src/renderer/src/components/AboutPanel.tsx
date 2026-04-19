/**
 * AboutPanel
 *
 * Reusable content panel for the About experience.
 */
export function AboutPanel(): React.JSX.Element {
  return (
    <div className="panel-shell">
      <p className="about-blot">
        <span className="emphasis hover-underline">Batchgrade</span> is a locally hosted automated
        grading platform designed to streamline the evaluation of programming assignments in
        academic environments. The system enables instructors to compile, test, and manage
        submissions through an integrated gradebook interface, while students receive consistent and
        structured feedback. Built with a modular web-based architecture and local deployment
        capability, BatchGrade eliminates reliance on costly cloud-based services. By reducing
        grading time and improving assessment reliability, the platform increases instructional
        efficiency and supports scalable computer science education.
      </p>
    </div>
  )
}
