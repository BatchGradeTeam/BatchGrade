/**
 * Footer.tsx
 *
 * Description:
 * This component implements the application footer used
 * across all pages within the BatchGrade platform
 *
 * The footer currently displays:
 *  - The development build version
 *  - System version information provided by the Versions component
 *
 * This component ensures consistent footer content throughout
 * the application interface
 */
import Versions from './Versions'

/**
 * Footer Component
 *
 * Displays application build information and version details.
 *
 * @returns Footer(): React.JSX.Element
 */
export function Footer(): React.JSX.Element {
  return (
    <div className="app-footer">
      {/* Application Build Information */}
      <p>BatchGrade Development Build v02</p>

      {/* System version information */}
      <Versions />
    </div>
  )
}