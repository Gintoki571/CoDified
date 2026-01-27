CREATE TABLE `edges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`target_id` integer NOT NULL,
	`type` text DEFAULT 'RELATED_TO' NOT NULL,
	`weight` real DEFAULT 1,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_edges_source` ON `edges` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_edges_target` ON `edges` (`target_id`);--> statement-breakpoint
CREATE INDEX `idx_edges_user` ON `edges` (`user_id`);--> statement-breakpoint
CREATE TABLE `embeddings` (
	`id` text PRIMARY KEY NOT NULL,
	`node_id` integer,
	`user_id` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `memory_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`metadata` text,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_created` ON `memory_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'concept',
	`content` text,
	`user_id` text NOT NULL,
	`embedding_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uid_nodes_name_user` ON `nodes` (`name`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_nodes_created` ON `nodes` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_nodes_user` ON `nodes` (`user_id`);