CREATE TABLE `exchange_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fromCurrency` varchar(8) NOT NULL,
	`toCurrency` varchar(8) NOT NULL DEFAULT 'USD',
	`rate` decimal(10,6) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exchange_rates_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_currency_pair` UNIQUE(`fromCurrency`,`toCurrency`)
);
