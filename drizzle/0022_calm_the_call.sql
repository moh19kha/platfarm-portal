CREATE TABLE `leave_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`odooEmployeeId` int NOT NULL,
	`employeeName` varchar(255) NOT NULL,
	`companyId` int,
	`companyName` varchar(255),
	`joiningDate` date NOT NULL,
	`annualLeaveDays` decimal(5,2) NOT NULL DEFAULT '21.00',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leave_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `leave_settings_odooEmployeeId_unique` UNIQUE(`odooEmployeeId`)
);
