-- This merge brought in an outdated migration that tried to reshape the local
-- `assignments` table into the instructor-assignment schema. The current codebase
-- intentionally uses two separate tables:
-- - `assignments` for local submission records
-- - `instructor_assignments` for instructor-authored assignment configs
--
-- Keeping this migration as a no-op preserves the current runtime behavior and
-- prevents clean packaged databases from failing during startup.
DROP TABLE IF EXISTS `__new_assignments`;
--> statement-breakpoint
SELECT 1;
