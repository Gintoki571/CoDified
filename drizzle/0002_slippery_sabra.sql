CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`capabilities` text,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	`last_seen` integer DEFAULT (unixepoch())
);
