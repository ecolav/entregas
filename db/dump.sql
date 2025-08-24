-- ECOLAV dump
-- Database: pedidos_ecolav
-- Generated at: 2025-08-24T16:55:13.533Z

SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for bed
-- ----------------------------
DROP TABLE IF EXISTS `bed`;
CREATE TABLE `bed` (
  `id` varchar(191) NOT NULL,
  `number` varchar(64) NOT NULL,
  `status` enum('free','occupied') NOT NULL DEFAULT 'free',
  `token` varchar(191) NOT NULL,
  `sectorId` varchar(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `sectorId` (`sectorId`),
  CONSTRAINT `fk_bed_sector` FOREIGN KEY (`sectorId`) REFERENCES `sector` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for client
-- ----------------------------
DROP TABLE IF EXISTS `client`;
CREATE TABLE `client` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `document` varchar(191) DEFAULT NULL,
  `contactName` varchar(191) DEFAULT NULL,
  `contactEmail` varchar(191) DEFAULT NULL,
  `contactPhone` varchar(191) DEFAULT NULL,
  `whatsappNumber` varchar(32) DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `document` (`document`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for linenitem
-- ----------------------------
DROP TABLE IF EXISTS `linenitem`;
CREATE TABLE `linenitem` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `sku` varchar(191) NOT NULL,
  `unit` varchar(32) NOT NULL,
  `currentStock` int(11) NOT NULL DEFAULT 0,
  `minimumStock` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `clientId` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `clientId` (`clientId`),
  CONSTRAINT `fk_linenitem_client` FOREIGN KEY (`clientId`) REFERENCES `client` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for order
-- ----------------------------
DROP TABLE IF EXISTS `order`;
CREATE TABLE `order` (
  `id` varchar(191) NOT NULL,
  `bedId` varchar(191) NOT NULL,
  `status` enum('pending','preparing','delivered','cancelled') NOT NULL DEFAULT 'pending',
  `observations` text DEFAULT NULL,
  `scheduledDelivery` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deliveredAt` datetime DEFAULT NULL,
  `deliveredByUserId` varchar(191) DEFAULT NULL,
  `receiverName` varchar(191) DEFAULT NULL,
  `confirmationType` varchar(32) DEFAULT NULL,
  `confirmationUrl` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `bedId` (`bedId`),
  CONSTRAINT `fk_order_bed` FOREIGN KEY (`bedId`) REFERENCES `bed` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for orderitem
-- ----------------------------
DROP TABLE IF EXISTS `orderitem`;
CREATE TABLE `orderitem` (
  `id` varchar(191) NOT NULL,
  `itemId` varchar(191) NOT NULL,
  `quantity` int(11) NOT NULL,
  `orderId` varchar(191) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `orderId` (`orderId`),
  KEY `itemId` (`itemId`),
  CONSTRAINT `fk_orderitem_item` FOREIGN KEY (`itemId`) REFERENCES `linenitem` (`id`),
  CONSTRAINT `fk_orderitem_order` FOREIGN KEY (`orderId`) REFERENCES `order` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for sector
-- ----------------------------
DROP TABLE IF EXISTS `sector`;
CREATE TABLE `sector` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `clientId` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `clientId` (`clientId`),
  CONSTRAINT `fk_sector_client` FOREIGN KEY (`clientId`) REFERENCES `client` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for stockmovement
-- ----------------------------
DROP TABLE IF EXISTS `stockmovement`;
CREATE TABLE `stockmovement` (
  `id` varchar(191) NOT NULL,
  `itemId` varchar(191) NOT NULL,
  `type` enum('in','out') NOT NULL,
  `quantity` int(11) NOT NULL,
  `orderId` varchar(191) DEFAULT NULL,
  `reason` varchar(255) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `itemId` (`itemId`),
  CONSTRAINT `fk_stockmovement_item` FOREIGN KEY (`itemId`) REFERENCES `linenitem` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for systemuser
-- ----------------------------
DROP TABLE IF EXISTS `systemuser`;
CREATE TABLE `systemuser` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `role` enum('admin','manager') NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `clientId` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `clientId` (`clientId`),
  CONSTRAINT `fk_systemuser_client` FOREIGN KEY (`clientId`) REFERENCES `client` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data for systemuser
INSERT INTO `systemuser` (`id`,`name`,`email`,`role`,`passwordHash`,`createdAt`,`clientId`) VALUES ('7de8a41b-80ae-11f0-8399-98838978af5c','Admin','admin@site.com','admin','$2a$10$lAp8xnbLnw8nrhFDKemZaOl/o2dSaELC/EW.vsnRWbiOr/39O.jMy','2025-08-24 02:52:15',NULL);

SET FOREIGN_KEY_CHECKS=1;
