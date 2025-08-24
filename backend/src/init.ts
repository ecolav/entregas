import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function ensureDatabase() {
  const url = process.env.DATABASE_URL || '';
  // Expected: mysql://user:pass@host:port/dbname
  const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?\/(.+)$/);
  if (!match) return;
  const [, user, password, host, port, database] = match;

  const conn = await mysql.createConnection({ host, port: port ? Number(port) : 3306, user, password, multipleStatements: true });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`);
  await conn.end();

  const db = await mysql.createConnection({ host, port: port ? Number(port) : 3306, user, password, database });
  // Create tables if not exist (minimal schema to start)
  await db.query(`
    CREATE TABLE IF NOT EXISTS Client (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      document VARCHAR(191) UNIQUE NULL,
      contactName VARCHAR(191) NULL,
      contactEmail VARCHAR(191) NULL,
      contactPhone VARCHAR(191) NULL,
      whatsappNumber VARCHAR(32) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    CREATE TABLE IF NOT EXISTS SystemUser (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      role ENUM('admin','manager') NOT NULL,
      passwordHash VARCHAR(255) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      clientId VARCHAR(191) NULL,
      INDEX (clientId),
      CONSTRAINT fk_SystemUser_client FOREIGN KEY (clientId) REFERENCES Client(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    CREATE TABLE IF NOT EXISTS Sector (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      description VARCHAR(255) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      clientId VARCHAR(191) NULL,
      INDEX (clientId),
      CONSTRAINT fk_Sector_client FOREIGN KEY (clientId) REFERENCES Client(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    CREATE TABLE IF NOT EXISTS Bed (
      id VARCHAR(191) PRIMARY KEY,
      number VARCHAR(64) NOT NULL,
      status ENUM('free','occupied') NOT NULL DEFAULT 'free',
      token VARCHAR(191) NOT NULL UNIQUE,
      sectorId VARCHAR(191) NOT NULL,
      INDEX (sectorId),
      CONSTRAINT fk_Bed_sector FOREIGN KEY (sectorId) REFERENCES Sector(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    CREATE TABLE IF NOT EXISTS LinenItem (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      sku VARCHAR(191) NOT NULL UNIQUE,
      unit VARCHAR(32) NOT NULL,
      currentStock INT NOT NULL DEFAULT 0,
      minimumStock INT NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      clientId VARCHAR(191) NULL,
      INDEX (clientId),
      CONSTRAINT fk_LinenItem_client FOREIGN KEY (clientId) REFERENCES Client(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    CREATE TABLE IF NOT EXISTS \`Order\` (
      id VARCHAR(191) PRIMARY KEY,
      bedId VARCHAR(191) NOT NULL,
      status ENUM('pending','preparing','delivered','cancelled') NOT NULL DEFAULT 'pending',
      observations TEXT NULL,
      scheduledDelivery DATETIME NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deliveredAt DATETIME NULL,
      deliveredByUserId VARCHAR(191) NULL,
      receiverName VARCHAR(191) NULL,
      confirmationType ENUM('signature','photo') NULL,
      confirmationUrl VARCHAR(512) NULL,
      INDEX (bedId),
      CONSTRAINT fk_Order_bed FOREIGN KEY (bedId) REFERENCES Bed(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    CREATE TABLE IF NOT EXISTS OrderItem (
      id VARCHAR(191) PRIMARY KEY,
      itemId VARCHAR(191) NOT NULL,
      quantity INT NOT NULL,
      orderId VARCHAR(191) NOT NULL,
      INDEX (orderId), INDEX (itemId),
      CONSTRAINT fk_OrderItem_item FOREIGN KEY (itemId) REFERENCES LinenItem(id) ON DELETE RESTRICT,
      CONSTRAINT fk_OrderItem_order FOREIGN KEY (orderId) REFERENCES \`Order\`(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    CREATE TABLE IF NOT EXISTS StockMovement (
      id VARCHAR(191) PRIMARY KEY,
      itemId VARCHAR(191) NOT NULL,
      type ENUM('in','out') NOT NULL,
      quantity INT NOT NULL,
      orderId VARCHAR(191) NULL,
      reason VARCHAR(255) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX (itemId),
      CONSTRAINT fk_StockMovement_item FOREIGN KEY (itemId) REFERENCES LinenItem(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Ensure admin exists (bootstrap pattern similar à rota)
  const [rows] = await db.query<any[]>(`SELECT id FROM SystemUser WHERE role='admin' LIMIT 1;`);
  if (!rows || rows.length === 0) {
    const passwordHash = await bcrypt.hash('123456', 10);
    await db.query(`INSERT INTO SystemUser (id,name,email,role,passwordHash) VALUES (UUID(), 'Admin', 'admin@site.com', 'admin', ?)`, [passwordHash]);
  }

  await db.end();
}

ensureDatabase().catch(() => process.exit(0)).finally(() => process.exit(0));


