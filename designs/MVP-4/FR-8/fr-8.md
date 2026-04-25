# FR-8 Assignment-Based Gradebook View

## Description
The gradebook view is intended for instructors to see the highest score each student has accomplished for a particular assignment. It includes a dropdown that allows the instructor to select the assignment to view.

## Diagrams
> Component Diagram: `/designs/MVP-4/FR-8/FR-8-v01-COMP-GradebookViewComponents.xml`
> Sequence Diagram: `/designs/MVP-4/FR-8/FR-8-v01-SEQ-InstructorViewsGradebook.xml`

## Diagram Discription
FR-8 provides the assignment-based gradebook interface for instructors. The architectural decision is to adopt a client-server model where the frontend retrieves data through an API, with aggregation intended to be handled by the database. In this implementation, mock data is used as the system transitions from a local Electron-based architecture to a server-based design, allowing the frontend to be developed independently. Responsibilities are separated such that the frontend manages presentation and user interaction, while the backend and database handle data retrieval and aggregation. This design controls change scope by allowing the mock data to be replaced with real API integration later without significant changes to the UI.
