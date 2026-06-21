CREATE TABLE `purchase_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`watchId` int NOT NULL,
	`customerName` varchar(256) NOT NULL,
	`customerEmail` varchar(320) NOT NULL,
	`customerPhone` varchar(64),
	`cryptoPreference` enum('btc','eth','usdt','none','other') DEFAULT 'none',
	`message` text,
	`status` enum('new','reviewing','confirmed','declined','completed') NOT NULL DEFAULT 'new',
	`adminNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brand` varchar(128) NOT NULL,
	`model` varchar(256) NOT NULL,
	`reference` varchar(128),
	`year` int,
	`condition` enum('unworn','excellent','very_good','good','fair') DEFAULT 'excellent',
	`price` decimal(12,2),
	`currency` varchar(8) DEFAULT 'CHF',
	`status` enum('available','reserved','sold','hidden') NOT NULL DEFAULT 'available',
	`description` text,
	`imageUrl` text,
	`privateSource` text,
	`slug` varchar(256) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `watches_id` PRIMARY KEY(`id`),
	CONSTRAINT `watches_slug_unique` UNIQUE(`slug`)
);
