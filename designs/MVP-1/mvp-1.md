# MVP-1 Student Assignment Upload Interface

## Description
Provides a localized interface for students to submit source code files.

## Diagram
Sequence Diagram: ```/designs/MVP-1/MVP-1-v01-SEQ-StudentSubmissionWorkflow.xml```

## Diagram Discription
The Student Assignment Upload Interface enables students to select and submit source code files through the React-based user interface. Upon file selection (FR-1), the file is temporarily managed on the client side until the student initiates submission (FR-2). When submitted, the React frontend sends a request to the Main IPC, which coordinates the creation of submission metadata. The Submission Service is responsible for generating a unique submission record and delegating persistence operations to Drizzle ORM, which stores the submission data in the SQLite database. After successful persistence, the API triggers the Compilation Service to begin the automated build process.
