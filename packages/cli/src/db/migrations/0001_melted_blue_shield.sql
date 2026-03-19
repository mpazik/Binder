DELETE FROM `cli_snapshot_metadata`;--> statement-breakpoint
ALTER TABLE `cli_snapshot_metadata` ADD `entity_uid` text;--> statement-breakpoint
CREATE INDEX `cli_snapshot_entity_uid_idx` ON `cli_snapshot_metadata` (`entity_uid`);