CREATE TABLE `document_alert_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertDate` varchar(10) NOT NULL,
	`shipmentNames` json NOT NULL,
	`shipmentCount` int NOT NULL,
	`notified` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_alert_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_hard_copy` (
	`id` int AUTO_INCREMENT NOT NULL,
	`odooOrderId` int NOT NULL,
	`orderType` enum('purchase','sales') NOT NULL,
	`documentField` varchar(128) NOT NULL,
	`received` int NOT NULL DEFAULT 0,
	`receivedBy` varchar(128),
	`receivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_hard_copy_id` PRIMARY KEY(`id`)
);
