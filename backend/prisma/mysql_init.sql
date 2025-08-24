-- Ecolav 360 - MySQL initialization script
-- Compatível com MySQL 5.7+/8.0+ (XAMPP e servidores gerenciados)

-- Ajuste o nome do banco se desejar
CREATE DATABASE IF NOT EXISTS `ecolav` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `ecolav`;

-- Tabela: Client
CREATE TABLE IF NOT EXISTS `Client` (
  `id`              VARCHAR(191) PRIMARY KEY,
  `name`            VARCHAR(191) NOT NULL,
  `document`        VARCHAR(191) UNIQUE NULL,
  `contactName`     VARCHAR(191) NULL,
  `contactEmail`    VARCHAR(191) NULL,
  `contactPhone`    VARCHAR(191) NULL,
  `whatsappNumber`  VARCHAR(32)  NULL,
  `createdAt`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela: SystemUser
CREATE TABLE IF NOT EXISTS `SystemUser` (
  `id`        VARCHAR(191) PRIMARY KEY,
  `name`      VARCHAR(191) NOT NULL,
  `email`     VARCHAR(191) NOT NULL UNIQUE,
  `role`      ENUM('admin','manager') NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `clientId`  VARCHAR(191) NULL,
  CONSTRAINT `fk_SystemUser_client` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX `idx_SystemUser_clientId` ON `SystemUser`(`clientId`);

-- Tabela: Sector
CREATE TABLE IF NOT EXISTS `Sector` (
  `id`          VARCHAR(191) PRIMARY KEY,
  `name`        VARCHAR(191) NOT NULL,
  `description` VARCHAR(255) NULL,
  `createdAt`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `clientId`    VARCHAR(191) NULL,
  CONSTRAINT `fk_Sector_client` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX `idx_Sector_clientId` ON `Sector`(`clientId`);

-- Tabela: Bed
CREATE TABLE IF NOT EXISTS `Bed` (
  `id`        VARCHAR(191) PRIMARY KEY,
  `number`    VARCHAR(64) NOT NULL,
  `status`    ENUM('free','occupied') NOT NULL DEFAULT 'free',
  `token`     VARCHAR(191) NOT NULL UNIQUE,
  `sectorId`  VARCHAR(191) NOT NULL,
  CONSTRAINT `fk_Bed_sector` FOREIGN KEY (`sectorId`) REFERENCES `Sector`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX `idx_Bed_sectorId` ON `Bed`(`sectorId`);

-- Tabela: LinenItem (itens por cliente; clientId NULL = global)
CREATE TABLE IF NOT EXISTS `LinenItem` (
  `id`            VARCHAR(191) PRIMARY KEY,
  `name`          VARCHAR(191) NOT NULL,
  `sku`           VARCHAR(191) NOT NULL UNIQUE,
  `unit`          VARCHAR(32)  NOT NULL,
  `currentStock`  INT NOT NULL DEFAULT 0,
  `minimumStock`  INT NOT NULL DEFAULT 0,
  `createdAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `clientId`      VARCHAR(191) NULL,
  CONSTRAINT `fk_LinenItem_client` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX `idx_LinenItem_clientId` ON `LinenItem`(`clientId`);

-- Tabela: Order (pedido)
CREATE TABLE IF NOT EXISTS `Order` (
  `id`                 VARCHAR(191) PRIMARY KEY,
  `bedId`              VARCHAR(191) NOT NULL,
  `status`             ENUM('pending','preparing','delivered','cancelled') NOT NULL DEFAULT 'pending',
  `observations`       TEXT NULL,
  `scheduledDelivery`  DATETIME NULL,
  `createdAt`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deliveredAt`        DATETIME NULL,
  `deliveredByUserId`  VARCHAR(191) NULL,
  `receiverName`       VARCHAR(191) NULL,
  `confirmationType`   ENUM('signature','photo') NULL,
  `confirmationUrl`    VARCHAR(512) NULL,
  CONSTRAINT `fk_Order_bed` FOREIGN KEY (`bedId`) REFERENCES `Bed`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX `idx_Order_bedId` ON `Order`(`bedId`);

-- Tabela: OrderItem (itens do pedido)
CREATE TABLE IF NOT EXISTS `OrderItem` (
  `id`       VARCHAR(191) PRIMARY KEY,
  `itemId`   VARCHAR(191) NOT NULL,
  `quantity` INT NOT NULL,
  `orderId`  VARCHAR(191) NOT NULL,
  CONSTRAINT `fk_OrderItem_item` FOREIGN KEY (`itemId`) REFERENCES `LinenItem`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_OrderItem_order` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX `idx_OrderItem_orderId` ON `OrderItem`(`orderId`);
CREATE INDEX `idx_OrderItem_itemId` ON `OrderItem`(`itemId`);

-- Tabela: StockMovement (movimentações de estoque)
CREATE TABLE IF NOT EXISTS `StockMovement` (
  `id`        VARCHAR(191) PRIMARY KEY,
  `itemId`    VARCHAR(191) NOT NULL,
  `type`      ENUM('in','out') NOT NULL,
  `quantity`  INT NOT NULL,
  `orderId`   VARCHAR(191) NULL,
  `reason`    VARCHAR(255) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_StockMovement_item` FOREIGN KEY (`itemId`) REFERENCES `LinenItem`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX `idx_StockMovement_itemId` ON `StockMovement`(`itemId`);

-- Dica: o primeiro admin pode ser criado pela API /auth/bootstrap-admin após subir o backend.
-- Exemplo (opcional):
-- INSERT INTO `Client` (`id`,`name`) VALUES ('c1','Cliente Demo');
-- INSERT INTO `SystemUser` (`id`,`name`,`email`,`role`,`passwordHash`) VALUES ('u1','Admin','admin@site.com','admin','$2a$10$hash_aqui');

-- =========================
-- SEED OPCIONAL (DEMO)
-- =========================
-- Cliente demo
INSERT INTO `Client` (`id`,`name`,`whatsappNumber`) VALUES ('c_demo','Cliente Demo','5511999999999')
  ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `whatsappNumber`=VALUES(`whatsappNumber`);

-- Setor demo vinculado ao cliente
INSERT INTO `Sector` (`id`,`name`,`description`,`clientId`) VALUES ('s_uti','UTI','Unidade de Terapia Intensiva','c_demo')
  ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `description`=VALUES(`description`), `clientId`=VALUES(`clientId`);

-- Leitos demo
INSERT INTO `Bed` (`id`,`number`,`status`,`token`,`sectorId`) VALUES
  ('b_101','101','free','bed-101-token','s_uti'),
  ('b_102','102','occupied','bed-102-token','s_uti')
  ON DUPLICATE KEY UPDATE `number`=VALUES(`number`), `status`=VALUES(`status`), `sectorId`=VALUES(`sectorId`);

-- Itens globais (sem clientId)
INSERT INTO `LinenItem` (`id`,`name`,`sku`,`unit`,`currentStock`,`minimumStock`,`clientId`) VALUES
  ('li_len_global','Lençol','LEN-GLB','unid',100,20,NULL),
  ('li_toa_global','Toalha','TOA-GLB','unid',80,15,NULL)
  ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `unit`=VALUES(`unit`), `currentStock`=VALUES(`currentStock`), `minimumStock`=VALUES(`minimumStock`), `clientId`=VALUES(`clientId`);

-- Itens específicos do cliente demo
INSERT INTO `LinenItem` (`id`,`name`,`sku`,`unit`,`currentStock`,`minimumStock`,`clientId`) VALUES
  ('li_len_demo','Lençol Hospitalar','LEN-CDEM','unid',60,20,'c_demo'),
  ('li_manta_demo','Manta','MAN-CDEM','unid',40,10,'c_demo')
  ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `unit`=VALUES(`unit`), `currentStock`=VALUES(`currentStock`), `minimumStock`=VALUES(`minimumStock`), `clientId`=VALUES(`clientId`);


