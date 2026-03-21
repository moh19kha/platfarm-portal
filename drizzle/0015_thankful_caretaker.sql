CREATE TABLE `user_company_access` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`odooCompanyId` int NOT NULL,
	`isDefault` int NOT NULL DEFAULT 0,
	`updatedBy` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_company_access_id` PRIMARY KEY(`id`)
);
