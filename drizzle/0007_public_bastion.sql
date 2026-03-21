CREATE TABLE `production_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`moId` int NOT NULL,
	`tab` varchar(32) NOT NULL,
	`docType` varchar(128) NOT NULL,
	`fileName` varchar(512) NOT NULL,
	`mimeType` varchar(128),
	`fileSize` int,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(1024) NOT NULL,
	`uploadedBy` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_documents_id` PRIMARY KEY(`id`)
);
