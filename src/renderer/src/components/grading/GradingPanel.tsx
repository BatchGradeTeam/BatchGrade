import { useState } from 'react'
import type { CompileCppResult } from '../../../../shared/compiler'
import '../../assets/styles/GradingPlusPanel.css'
import { CppJudgePanel } from '../CppJudgePanel'
import { CppWorkflowPanel } from '../compiler/CppWorkflowPanel'

interface GradingPanelProps {
  showHomeButton?: boolean
  onGoHome?: () => void
}

export function GradingPanel({
  showHomeButton = false,
  onGoHome
}: GradingPanelProps): React.JSX.Element {
  const [compileResult, setCompileResult] = useState<CompileCppResult | null>(null)

  return (
    <div className="panel-shell grading-plus-panel">
      <div className="grading-plus-header">
        <h1 className="grading-plus-title">Grading</h1>

        <p className="grading-plus-description">Single-submission interactive grading workspace.</p>

        <p className="grading-plus-note">
          Compile and execute C++ files on demand with immediate feedback and judge output
          validation.
        </p>
      </div>

      <CppWorkflowPanel
        title="Compilation Workspace"
        description="Compile selected C++ files and optionally run the compiled program for grading checks."
        allowExecution={true}
        autoCompileOnSelection={true}
        onCompileResultChange={setCompileResult}
      />

      <CppJudgePanel compileResult={compileResult} />

      {showHomeButton && onGoHome && (
        <button onClick={onGoHome} className="primary-button compact-button">
          Go to home
        </button>
      )}
    </div>
  )
}
