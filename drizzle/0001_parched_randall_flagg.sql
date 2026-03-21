CREATE TABLE `shipment_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wizardType` enum('purchase','sales','multi_linked') NOT NULL,
	`currentStep` int NOT NULL DEFAULT 1,
	`label` varchar(255),
	`formData` json NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipment_drafts_id` PRIMARY KEY(`id`)
);
