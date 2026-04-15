import { useEffect, useState } from 'react'
import type { DockerInstallationInfo } from '../../../shared/compiler'

export function DockerDetectionPanel(): React.JSX.Element {
  const [status, setStatus] = useState<DockerInstallationInfo | null>(null)

  useEffect(() => {
    void window.api.compiler
      .getDockerStatus()
      .then(setStatus)
      .catch(() => {
        console.error('Docker detection failed')
      })
  }, [])

  if (!status)
    return (
      <div className="mt-4 border border-gray-500 bg-[#2b2b2b] p-4">
        <h2 className="text-xl font-semibold">Docker Detection</h2>
        <p className="mt-2 text-sm text-gray-300">Checking Docker status...</p>
      </div>
    )

  const statusClass =
    status.status === 'ready'
      ? 'border-green-600 bg-green-950'
      : status.status === 'not-running'
        ? 'border-yellow-600 bg-yellow-950'
        : 'border-red-600 bg-red-950'
  const statusLabel =
    status.status === 'ready'
      ? 'Ready'
      : status.status === 'not-running'
        ? 'Not Running'
        : 'Not Installed'

  return (
    <div className="mt-4 border border-gray-500 bg-[#2b2b2b] p-4">
      <h2 className="text-xl font-semibold">Docker Detection</h2>
      <div className={`mt-4 border ${statusClass} p-4`}>
        <h3 className="text-lg font-medium">{statusLabel}</h3>
        <p className="mt-2 text-sm text-gray-300">{status.message}</p>
        {status.version && <p className="mt-1 text-sm text-gray-400">Version: {status.version}</p>}
      </div>
    </div>
  )
}
