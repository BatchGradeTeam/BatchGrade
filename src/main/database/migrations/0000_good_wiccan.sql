CREATE TABLE `courses` (
	`uuid` text PRIMARY KEY NOT NULL,
	`course_code` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`credits` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_course_code_unique` ON `courses` (`course_code`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`uuid` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`section_id` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `instructors` (
	`uuid` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	FOREIGN KEY (`uuid`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sections` (
	`uuid` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`semester` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `students` (
	`uuid` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	FOREIGN KEY (`uuid`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `teaching_assistants` (
	`uuid` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	FOREIGN KEY (`uuid`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`uuid` text PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`title` text NOT NULL,
	`due_date` integer NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `grades` (
	`uuid` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`score` integer NOT NULL,
	`feedback` text,
	`graded_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`uuid` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`student_id` text NOT NULL,
	`file_content` text,
	`file_name` text DEFAULT 'N/A' NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'not submitted' NOT NULL,
	`submitted_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`uuid` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `compile_logs` (
	`uuid` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`status` text NOT NULL,
	`exit_code` integer,
	`stdout` text,
	`stderr` text,
	`duration` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`student_id`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submission_id`) REFERENCES `assignments`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `action_logs` (
	`uuid` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text,
	`details` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE no action
);
