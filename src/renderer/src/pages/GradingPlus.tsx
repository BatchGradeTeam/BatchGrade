import { useNavigate } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { NavBar } from '../components/Navbar'
import { GradingPlusPanel } from '../components/instructor/GradingPlusPanel'

export function GradingPlus(): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <>
      <NavBar />
      <div style={{ padding: '6rem' }}>
        <GradingPlusPanel showHomeButton={true} onGoHome={() => navigate('/instructordashboard')} />
      </div>
      <Footer />
    </>
  )
}
