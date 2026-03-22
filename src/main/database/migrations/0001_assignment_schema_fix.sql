PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_assignments` (
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
INSERT INTO `__new_assignments` (
	`uuid`,
	`name`,
	`due_date`,
	`grading_criteria`,
	`solution_type`,
	`solution_file_name`,
	`solution_file_path`,
	`expected_output_text`,
	`created_by_user_uuid`,
	`created_at`
)
SELECT
	`uuid`,
	`title`,
	CAST(`due_date` AS text),
	'',
	'text',
	NULL,
	NULL,
	NULL,
	NULL,
	unixepoch()
FROM `assignments`;
--> statement-breakpoint
DROP TABLE `assignments`;
--> statement-breakpoint
ALTER TABLE `__new_assignments` RENAME TO `assignments`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
