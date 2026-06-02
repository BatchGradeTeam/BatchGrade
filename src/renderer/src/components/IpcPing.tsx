import { useState } from 'react'

type PingState = 'idle' | 'waiting' | 'ok'

export function IpcPing(): React.JSX.Element {
  const [ping, setPing] = useState<PingState>('idle')

  function handlePing(): void {
    setPing('waiting')
    window.electron.ipcRenderer.send('ping')
    setTimeout(() => setPing('ok'), 300)
    setTimeout(() => setPing('idle'), 2500)
  }

  const label = ping === 'idle' ? 'Send IPC' : ping === 'waiting' ? 'Sending…' : 'Pong ✓'

  return (
    <a
      onClick={handlePing}
      rel="noreferrer"
      className={`cursor-pointer transition-colors duration-200 ${ping === 'waiting' ? 'opacity-60' : ''} ${ping === 'ok' ? 'text-green-400' : ''}`}
    >
      {label}
    </a>
  )
}

export default IpcPing
