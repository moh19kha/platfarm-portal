CREATE TABLE `salary_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`odooEmployeeId` int NOT NULL,
	`employeeName` varchar(255) NOT NULL,
	`odooContractId` int NOT NULL,
	`previousWage` decimal(12,2) NOT NULL DEFAULT '0.00',
	`newWage` decimal(12,2) NOT NULL,
	`previousHousing` decimal(12,2) NOT NULL DEFAULT '0.00',
	`newHousing` decimal(12,2) NOT NULL DEFAULT '0.00',
	`previousTransport` decimal(12,2) NOT NULL DEFAULT '0.00',
	`newTransport` decimal(12,2) NOT NULL DEFAULT '0.00',
	`previousOther` decimal(12,2) NOT NULL DEFAULT '0.00',
	`newOther` decimal(12,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(8) NOT NULL DEFAULT 'EGP',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `salary_history_id` PRIMARY KEY(`id`)
);
