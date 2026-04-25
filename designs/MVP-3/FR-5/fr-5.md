# FR5 Expected Output Display

## Description
This display will appear alongside FR4 with proper labeling to indicate that it shows the output of the assignment's solution. If the text box option was used in FR10 for FR11, it will display the stored output directly. If the file upload option was used instead, FR4 will show the executed output of the assignment's solution while this display shows a message indicating that it is storing said output. After that first execution, this display will always show the assignment's stored solution output.

## Diagram
Sequence Diagram: ```/designs/MVP-3/FR-5/FR-5-v03-SEQ-ExpectedOutputDisplay```

## Diagram Discription
FR-5 is responsible for displaying the instructor-provided expected output to the user. This feature is executed as part of the same judging pipeline as FR-4, meaning it is triggered whenever a user submits their program for judging. After JudgeCppResult() is called, the expected output retrieved from the instructor-uploaded output file is passed to the front end and displayed alongside the user's actual output, giving the student a direct basis for comparison. FR-5 is tightly interconnected with FR-4 and FR-6, as all three features draw from the same judging invocation.
