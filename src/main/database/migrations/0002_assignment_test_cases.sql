CREATE TABLE IF NOT EXISTS `assignment_test_cases` (
	`uuid` text PRIMARY KEY NOT NULL,
	`assignment_uuid` text NOT NULL,
	`case_order` integer NOT NULL,
	`input_file_name` text,
	`input_file_path` text,
	`input_text` text,
	`expected_output_file_name` text,
	`expected_output_file_path` text,
	`expected_output_text` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`assignment_uuid`) REFERENCES `instructor_assignments`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `assignment_test_cases_assignment_uuid_case_order_unique` ON `assignment_test_cases` (`assignment_uuid`,`case_order`);
