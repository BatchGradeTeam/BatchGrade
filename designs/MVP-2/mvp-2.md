# MVP-2 Automated Test Execution & Output Validation

## Description
Executes compiled programs against instructor-defined test cases and compares program output to reference results.

## Diagram
Sequence Diagram: ```/designs/MVP-2/MMVP-2-v03-SEQ-CompilationWorkflow```

## Diagram Discription
The main architectural decision was to implement compilation as a local Electron-centered workflow with clearly separated layers: the renderer handles user interaction, the preload/main process manages secure IPC and compiler state, the GCC Detection Service verifies environment readiness, and the Compile Service performs the actual build, while related concerns like execution and submission packaging remain separate. Responsibilities were assigned this way so each part has one focused role: the UI only gathers files and displays results, Electron bridges privileged system access safely, compiler detection handles machine-specific setup problems, and compilation logic stays reusable for later features such as execution and grading. This design controls change scope by isolating MVP-2 to “can the selected code be compiled and can the result be reported?” without pulling in broader grading, analytics, or deployment concerns, which means later changes to FR-3, execution, or persistence can be added around the compile workflow instead of forcing MVP-2 itself to be redesigned.
