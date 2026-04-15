CREATE TABLE IF NOT EXISTS `instructor_assignments` (
	`uuid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`due_date` text NOT NULL,
	`grading_criteria` text NOT NULL,
	`solution_type` text NOT NULL,
	`solution_file_name` text,
	`solution_file_path` text,
	`expected_output_text` text,
	`created_by_user_uuid` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`uuid` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assignments` (
	`uuid` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`config` blob,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `compile_logs` (
	`uuid` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`status` text NOT NULL,
	`exit_code` integer,
	`stdout` text,
	`stderr` text,
	`duration` integer,
	FOREIGN KEY (`submission_id`) REFERENCES `assignments`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `grades` (
	`uuid` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`score` integer NOT NULL,
	`feedback` text,
	`graded_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `submissions` (
	`uuid` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`file_name` text DEFAULT 'N/A' NOT NULL,
	`file_content` text NOT NULL,
	`file_size` integer NOT NULL,
	`status` text DEFAULT 'not submitted' NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`uuid`) ON UPDATE no action ON DELETE no action
);
