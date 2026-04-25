# FR-7 Submission Database

## Description
The database logs every assignment and submission that has been made in the application. It is not intended to be accessible by users.

## Diagrams
> Schema Diagram: ```/designs/MVP-4/FR-7/FR-7-v01-SCHEMA-SubmissionDatabaseModel.jpg```
> Sequence Diagram: ```/designs/MVP-4/FR-7/FR-7-v01-SEQ-StoreSubmissionAfterGrading.xml```

## Diagram Discription
The database architecture utilizes Three-Schema Isolation strategy and a Supertype/Subtype identity model to structurally enforce security for student PII. Row Level Security (RLS) filters the public schema so users only see authorized records, while identity is managed through a central profiles table branching into specialized roles via 1:1 UUID relationships. Beyond identity, the database serves as a protected Audit Layer by logging every assignment and submission event within an isolated schema hidden from end-users. These logs provide a critical fail-safe for Dispute Resolution, allowing instructors to verify exact submission timestamps or version history in cases of technical discrepancies. 