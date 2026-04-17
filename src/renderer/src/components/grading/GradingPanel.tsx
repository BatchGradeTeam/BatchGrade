import { useState } from 'react'
import type { CompileCppResult } from '../../../../shared/compiler'
import { CppJudgePanel } from '../CppJudgePanel'
import { CppWorkflowPanel } from '../compiler/CppWorkflowPanel'

interface GradingPanelProps {
  showHomeButton?: boolean
  onGoHome?: () => void
}

export function GradingPanel({ showHomeButton = false, onGoHome }: GradingPanelProps): React.JSX.Element {
  const [compileResult, setCompileResult] = useState<CompileCppResult | null>(null)

  return (
    <div className="panel-shell">
      <h1>Grading Page</h1>
      <p>
        Instructor workflow for compiling and running submissions. Execution remains a separate
        step so it can move behind a sandbox boundary later.
      </p>

      <CppWorkflowPanel
        title="Instructor Compilation Workspace"
        description="Compile selected C++ files and optionally run the compiled program for grading checks."
        allowExecution={true}
        autoCompileOnSelection={true}
        onCompileResultChange={setCompileResult}
      />

      <CppJudgePanel compileResult={compileResult} />

      {showHomeButton && onGoHome && (
        <button
          onClick={onGoHome}
          style={{
            padding: '9px 14px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: '2px solid #93c5fd',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Go to home
        </button>
      )}
    </div>
  )
}
