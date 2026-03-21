CREATE TABLE `shipment_status_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`odooOrderId` int NOT NULL,
	`orderType` enum('purchase','sales') NOT NULL,
	`orderName` varchar(128) NOT NULL,
	`previousStatus` varchar(128),
	`newStatus` varchar(128) NOT NULL,
	`notified` int NOT NULL DEFAULT 0,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shipment_status_log_id` PRIMARY KEY(`id`)
);
