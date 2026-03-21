CREATE TABLE `user_module_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleId` varchar(64) NOT NULL,
	`canView` int NOT NULL DEFAULT 0,
	`canCreate` int NOT NULL DEFAULT 0,
	`canEdit` int NOT NULL DEFAULT 0,
	`canDelete` int NOT NULL DEFAULT 0,
	`updatedBy` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_module_permissions_id` PRIMARY KEY(`id`)
);
