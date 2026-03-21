CREATE TABLE `pce_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`employeeName` varchar(255) NOT NULL,
	`freq` enum('daily','weekly','monthly') NOT NULL DEFAULT 'weekly',
	`hour` int NOT NULL DEFAULT 9,
	`dow` int DEFAULT 0,
	`dom` int DEFAULT 1,
	`message` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pce_reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `petty_cash_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`employeeName` varchar(255) NOT NULL,
	`companyId` int NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`purpose` text,
	`notes` text,
	`status` enum('pending','disbursed','rejected') NOT NULL DEFAULT 'pending',
	`processedBy` varchar(255),
	`processedAt` timestamp,
	`requestDate` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `petty_cash_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `petty_cash_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`employeeName` varchar(255) NOT NULL,
	`companyId` int NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`type` enum('top_up','expense_deduction','adjustment') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`reference` text,
	`createdBy` varchar(255),
	`expenseSheetId` int,
	`txDate` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `petty_cash_transactions_id` PRIMARY KEY(`id`)
);
