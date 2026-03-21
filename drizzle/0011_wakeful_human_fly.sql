ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('pending','active','inactive') DEFAULT 'active' NOT NULL;