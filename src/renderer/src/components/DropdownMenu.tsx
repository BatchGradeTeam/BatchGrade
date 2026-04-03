/**
 * DropdownMenu.tsx
 *
 * Description:
 * A reusable dropdown menu component that displays navigation items
 * when the menu is open. Used in the Navbar for collapsible navigation.
 */
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { STUDENT_ROLE, INSTRUCTOR_ROLE } from '../../../main/database/schema'

interface DropdownMenuProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * DropdownMenu Component
 *
 * Renders a dropdown menu with navigation items
 *
 * @param isOpen - Whether the menu should be visible
 * @param onClose - Callback to close the menu
 */
export function DropdownMenu({ isOpen, onClose }: DropdownMenuProps): React.JSX.Element | null {
  const navigate = useNavigate()
  const { user } = useAuth()

  type MenuRole = typeof STUDENT_ROLE | typeof INSTRUCTOR_ROLE
  interface MenuItem {
    label: string
    path: string
    allowedRoles?: MenuRole[]
  }

  const menuItems: MenuItem[] = [
    {
      label: 'Instructor Dashboard',
      path: '/instructordashboard',
      allowedRoles: [INSTRUCTOR_ROLE]
    },
    {
      label: 'Student Dashboard',
      path: '/studentdashboard',
      allowedRoles: [STUDENT_ROLE]
    },
    {
      label: 'Student Upload Interface',
      path: '/studentuploadinterface',
      allowedRoles: [STUDENT_ROLE]
    },
    {
      label: 'Gradebook',
      path: '/gradebook',
      allowedRoles: [INSTRUCTOR_ROLE]
    },
    {
      label: 'Grading',
      path: '/grading',
      allowedRoles: [INSTRUCTOR_ROLE]
    },
    {
      label: 'About',
      path: '/about'
    }
  ]

  const visibleMenuItems = menuItems.filter((item) => {
    if (!item.allowedRoles) {
      return true
    }

    return !!user && item.allowedRoles.includes(user.role as MenuRole)
  })

  const handleNavigation = (path: string): void => {
    navigate(path)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="dropdown-menu">
      {/*-----------------------------------------------------------
            Navigation Buttons
              Provide quick access to major system interfaces
            -----------------------------------------------------------*/}

      {visibleMenuItems.map((item) => (
        <button
          key={item.path}
          className="dropdown-item"
          onClick={() => handleNavigation(item.path)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
