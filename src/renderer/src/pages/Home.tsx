import Footer from '../components/Footer'
import { IpcPing } from '../components/IpcPing'
import NavBar from '../components/Navbar'
import { UserPanel } from '../components/UserPanel'

function Home(): React.JSX.Element {
  return (
    <>
      <NavBar />

      <div className="hero-container">
        <div className="hero-item">
          <header className="header">
            <h1 className="title">
              <span className="react">BatchGrade</span>
            </h1>
            <p className="creator">Automated Grading System</p>
          </header>
        </div>

        <div className="hero-item">
          <header className="header">
            <h1 className="title signup">Sign Up</h1>
            <p>Register & Connect with BatchGrade.</p>
          </header>

          <div className="actions">
            <div className="action">
              <IpcPing />
            </div>
          </div>

          <div className="p-6">
            <p
              style={{
                color: '#fca5a5',
                textAlign: 'center',
                marginBottom: '1rem',
                fontWeight: 600
              }}
            >
              This portion is used for development. Use the top right buttons to sign up and login.
            </p>
            <UserPanel />
          </div>
        </div>
      </div>

      <div className="about-container">
        <h1 className="title about">About</h1>
        <p className="about-blot">
          <span className="emphasis">Batchgrade</span> is a locally hosted automated grading
          platform designed to streamline the evaluation of programming assignments in academic
          environments. The system enables instructors to compile, test, and manage submissions
          through an integrated gradebook interface, while students receive consistent and
          structured feedback. Built with a modular web-based architechture and local deployment
          capability, BatchGrade eliminates reliance on costly cloud-based services. By reducing
          grading time and improving assessment reliability, the platform increases instructional
          efficiency and supports scalable computer science education.
        </p>
      </div>

      <Footer />
    </>
  )
}

export default Home
