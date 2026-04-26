# MVP-6 User Access Interface

## Description
Provides a login interface that distinguishes between student and instructor roles, enforcing role-based access control within the system.


## Diagrams
Sequence Diagram: ```/designs/MVP-6/MVP-6-v02-SEQ-User-Login```
<img src= "MVP-6-v04-WIRE-Home-Login-Pages.png">

## Diagram Discription
MVP-6 focuses on secure and organized user access in BatchGrade. It ensures that users can sign in through a clear login flow and then see the correct interface based on their role. The goal is to make access simple for users while keeping permissions controlled for the system.

Figure 4.6.1 demonstrates a straightforward email/password login with two outcomes: Success and Failure. The user starts by clicking Login, which opens the Login UI and displays the login form. The user enters their login credentials and submitting the form. The Login UI sends the credentials to AuthService via AuthContext, checking UserStore for the user record. If a user record exists, AuthService returns with the user's role & the UI displays the appropriate dashboard page based on role. If a user record does not exist, AuthService returns an error state & the UI displays an error message.
