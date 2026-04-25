# FR1 File Upload Button & Display

## Description
Upon clicking the button, the user may select a file of any extension type. This button allows for multiple upload attempts until FR2 is used. Information about non-submitted file uploads will not be recorded into any databases.

## Diagram
Sequence Diagram: ```/designs/MVP-1/FR-1/FR-1-v00-SEQ-FileUploadButtonAndDisplay.xml```

## Diagram Discription
File Upload Button and display  is a part of the overall compiler interface, and provides a way to submit your code. The Student or Instructor can press the file upload button and select a file utilizing the file picker interface provided by the users Operating System. Following the selection the file will be seen in the interface, and ultimately when upload is pressed. A send is made to the back end, and the data that is to be compiled, is stored and made ready. Once ready you can Compile and Run utilizing the rest of the compiler interface.
