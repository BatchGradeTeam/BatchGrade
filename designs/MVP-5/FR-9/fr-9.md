# FR9: Assignment Creation Button & Display

## Description
This button is intended for instructors only. After clicking the button, the assignment creation template must be filled out. This information includes:

## Diagram
Sequence Diagram: ```/designs/MVP-5/FR-9/FR-9-v01-SEQ-Assignment-Creation```
- Assignment name.
- Due date.
- Solution (via FR10 and FR11).
- Grading criteria.
<img src="FR-9-v01-SEQ-Assignment-Creation.png">

## Diagram Discription
The grading criteria should involve a distribution of total available points based on how much the submission output matches the solution output and/or other factors.
Upon successful assignment creation, assignment information is created/compiled and stored in FR7 and FR13.
This information includes a unique ID for the assignment, the assignment name, the creator ID & name, and some file submission data from FR11.
