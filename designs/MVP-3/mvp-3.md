# MVP-3 Automated Execution & Output Validation

## Description
Executes compiled programs against instructor-defined test cases and compares program output to reference results.

## Diagram
Sequence Diagram: ```/designs/MVP-3/MVP-3-v03-SEQ-ExecutionAndValidationWorkflow```
Class Diagram: ```/designs/MVP-3/MVP-3-v02-CLS-ExecutionAndValidation```

## Diagram Discription
The Automated Test Execution & Output Validation feature is responsible for executing compiled programs against predefined test cases and computing a submission score. The user will provide program(s), input and output file(s). Upon a run request from the user interface (FR-4 – FR-6), the backend uses the provided files. The service first compiles the provided source code. It then executes the students program, collects the actual output of their program and compares it to the expected output of the assignment. The result of compilation, the unit tests and any errors are reported to the user. They will be able to see a simplified score of their work with the number of passing test cases over the total number of unit tests. 