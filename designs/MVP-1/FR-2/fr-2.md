# FR2 File Submission Button & Display

## Description 
This button cannot be functionally used until a file is uploaded using FR1. An error message will appear if the user tries to submit without first uploading a file. Upon proper use, submission information (unique submission ID, user information, and file data) will be created/compiled and stored in FR7 and FR13. This information includes a unique ID for the submission, the submitter's ID and name, and the file name.

## Diagram
Sequence Diagram: ```/designs/MVP-1/FR-2/FR-2-v01-SEQ-FileSubmissionButtonAndDisplay.xml```

## Diagram Discription
Following completion of uploading the uploaded file can be submitted assuming that uploading to the back end database has been successful. The file is then associated with the appropriate upload metadata i.e. time, date, student id. If the upload of the file during submission is successful, then the system should show success of the submission with a return submission record.  

