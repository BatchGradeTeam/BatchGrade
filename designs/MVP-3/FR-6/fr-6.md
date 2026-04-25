# FR6 Score Display

## Description
This display will appear alongside FR4 and FR5, only if a submission via FR2 was used. It shows the assignment score as both a percentage and a ratio of earned points over total available points. It can also be expanded to show the breakdown of points from the grading criteria provided in FR9. There is a section in which the highest score earned for the assignment is displayed as well. All score information is stored in FR7.

## Diagram
Sequence Diagram: ```/designs/MVP-3/FR-6/FR-6-v04-SEQ-ScoreDisplay```

## Diagram Discription
FR-6 is responsible for computing and displaying a summary score upon completion of the judging pipeline. This feature is executed whenever a user submits their program for judging. After JudgeCppResult() finishes evaluating all test cases, the results are aggregated into a pass/fail count across the full test suite. The front end then presents this as a simplified ratio of the number of passing test cases over the total number of test cases (e.g., 7/10), giving the student an immediate assessment of their submission's correctness. FR-6 is the last step in the MVP-3 pipeline and is tightly interconnected with FR-4 and FR-5. 