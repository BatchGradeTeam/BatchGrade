import { Footer } from '../components/Footer'
import { NavBar } from '../components/Navbar'
import { GradebookPanel } from '../components/grading/GradebookPanel'

export function Gradebook(): React.JSX.Element {
  return (
    <>
      <NavBar />
      <div style={{ paddingTop: '100px' }}>
        <GradebookPanel />
      </div>
      <Footer />
    </>
  )
}
