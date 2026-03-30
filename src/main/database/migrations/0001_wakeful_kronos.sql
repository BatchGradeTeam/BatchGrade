CREATE TABLE `instructor_assignments` (
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
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_action_logs` (
	`uuid` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text,
	`details` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_action_logs`("uuid", "user_id", "action", "entity_id", "details", "created_at") SELECT "uuid", "user_id", "action", "entity_id", "details", "created_at" FROM `action_logs`;--> statement-breakpoint
DROP TABLE `action_logs`;--> statement-breakpoint
ALTER TABLE `__new_action_logs` RENAME TO `action_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;