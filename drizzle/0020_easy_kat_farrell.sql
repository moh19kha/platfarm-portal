CREATE TABLE `cron_email_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cronType` varchar(64) NOT NULL,
	`sentDate` varchar(10) NOT NULL,
	`recipientCount` int DEFAULT 0,
	`itemCount` int DEFAULT 0,
	`success` int DEFAULT 1,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cron_email_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `cron_type_date_idx` UNIQUE(`cronType`,`sentDate`)
);
