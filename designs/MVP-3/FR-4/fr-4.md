# FR4 Submission Output Display

## Description
After a successful build from FR3, this display will appear next to FR5 with proper labeling. It shows the executed output of the user's submission. The submission may be from either FR2 or FR11. If the text box option was used in FR10 for FR11, this display will only show a message indicating as such.

## Diagram
Sequence Diagram: ```/designs/MVP-3/FR-4/FR-4-v03-SEQ-SubmissionOutputDisplay```

## Diagram Discription
FR-4 is responsible for retrieving and displaying the actual output produced by the user's program. This feature is executed whenever a user submits their program for judging. After JudgeCppResult() is called, it returns the actual output of the user's program along with any compilation or runtime errors. This information is then rendered on the front end to show the user the direct result of their program's execution. FR-4 is tightly interconnected with FR-5 and FR-6, as all three features draw from the same judging invocation.