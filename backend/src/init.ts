import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function ensureDatabase() {
  const url = process.env.DATABASE_URL || '';
  // Expected: mysql://user:pass@host:port/dbname
  const match = url.match(/^mysql:\/\/([^:]+):([^@]*)@([^:\/]+)(?::(\d+))?\/(.+)$/);
  if (!match) return;
  const [, user, password, host, port, database] = match;

  const conn = await mysql.createConnection({ host, port: port ? Number(port) : 3306, user, password, multipleStatements: true });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`);
  await conn.end();

  const db = await mysql.createConnection({ host, port: port ? Number(port) : 3306, user, password, database, multipleStatements: true });
  // Create tables if not exist (minimal schema to start) - executar em sequência
  await db.query(`CREATE TABLE IF NOT EXISTS client (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      document VARCHAR(191) UNIQUE NULL,
      contactName VARCHAR(191) NULL,
      contactEmail VARCHAR(191) NULL,
      contactPhone VARCHAR(191) NULL,
      whatsappNumber VARCHAR(32) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  await db.query(`CREATE TABLE IF NOT EXISTS systemuser (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      role ENUM('admin','manager') NOT NULL,
      passwordHash VARCHAR(255) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      clientId VARCHAR(191) NULL,
      INDEX (clientId),
      CONSTRAINT fk_systemuser_client FOREIGN KEY (clientId) REFERENCES client(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  await db.query(`CREATE TABLE IF NOT EXISTS sector (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      description VARCHAR(255) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      clientId VARCHAR(191) NULL,
      INDEX (clientId),
      CONSTRAINT fk_sector_client FOREIGN KEY (clientId) REFERENCES client(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  await db.query(`CREATE TABLE IF NOT EXISTS bed (
      id VARCHAR(191) PRIMARY KEY,
      number VARCHAR(64) NOT NULL,
      status ENUM('free','occupied') NOT NULL DEFAULT 'free',
      token VARCHAR(191) NOT NULL UNIQUE,
      sectorId VARCHAR(191) NOT NULL,
      INDEX (sectorId),
      CONSTRAINT fk_bed_sector FOREIGN KEY (sectorId) REFERENCES sector(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  await db.query(`CREATE TABLE IF NOT EXISTS linenitem (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      sku VARCHAR(191) NOT NULL UNIQUE,
      unit VARCHAR(32) NOT NULL,
      currentStock INT NOT NULL DEFAULT 0,
      minimumStock INT NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      clientId VARCHAR(191) NULL,
      INDEX (clientId),
      CONSTRAINT fk_linenitem_client FOREIGN KEY (clientId) REFERENCES client(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  await db.query(`CREATE TABLE IF NOT EXISTS \`order\` (
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
      CONSTRAINT fk_order_bed FOREIGN KEY (bedId) REFERENCES bed(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  await db.query(`CREATE TABLE IF NOT EXISTS orderitem (
      id VARCHAR(191) PRIMARY KEY,
      itemId VARCHAR(191) NOT NULL,
      quantity INT NOT NULL,
      orderId VARCHAR(191) NOT NULL,
      INDEX (orderId), INDEX (itemId),
      CONSTRAINT fk_orderitem_item FOREIGN KEY (itemId) REFERENCES linenitem(id) ON DELETE RESTRICT,
      CONSTRAINT fk_orderitem_order FOREIGN KEY (orderId) REFERENCES \`order\`(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  await db.query(`CREATE TABLE IF NOT EXISTS stockmovement (
      id VARCHAR(191) PRIMARY KEY,
      itemId VARCHAR(191) NOT NULL,
      type ENUM('in','out') NOT NULL,
      quantity INT NOT NULL,
      orderId VARCHAR(191) NULL,
      reason VARCHAR(255) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX (itemId),
      CONSTRAINT fk_stockmovement_item FOREIGN KEY (itemId) REFERENCES linenitem(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  // Weighing tables
  await db.query(`CREATE TABLE IF NOT EXISTS cage (
      id VARCHAR(191) PRIMARY KEY,
      barcode VARCHAR(50) NOT NULL UNIQUE,
      tareWeight DECIMAL(10,2) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await db.query(`CREATE TABLE IF NOT EXISTS weighingcontrol (
      id VARCHAR(191) PRIMARY KEY,
      laundryGrossWeight DECIMAL(10,2) NOT NULL,
      clientTotalNetWeight DECIMAL(10,2) NOT NULL DEFAULT 0,
      differenceWeight DECIMAL(10,2) NOT NULL DEFAULT 0,
      differencePercent DECIMAL(5,2) NOT NULL DEFAULT 0,
      kind VARCHAR(16) NOT NULL DEFAULT 'limpa',
      referenceDate DATE NOT NULL DEFAULT (CURRENT_DATE),
      expectedDeliveryDate DATE NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'open',
      closedAt DATETIME NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await db.query(`CREATE TABLE IF NOT EXISTS weighingentry (
      id VARCHAR(191) PRIMARY KEY,
      controlId VARCHAR(191) NOT NULL,
      cageId VARCHAR(191) NULL,
      tareWeight DECIMAL(10,2) NOT NULL,
      totalWeight DECIMAL(10,2) NOT NULL,
      netWeight DECIMAL(10,2) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX (controlId), INDEX (cageId),
      CONSTRAINT fk_weighingentry_control FOREIGN KEY (controlId) REFERENCES weighingcontrol(id) ON DELETE CASCADE,
      CONSTRAINT fk_weighingentry_cage FOREIGN KEY (cageId) REFERENCES cage(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  // Distributed items (enxoval alocado)
  await db.query(`CREATE TABLE IF NOT EXISTS distributeditem (
      id VARCHAR(191) PRIMARY KEY,
      linenItemId VARCHAR(191) NOT NULL,
      bedId VARCHAR(191) NOT NULL,
      allocatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(32) NOT NULL,
      orderId VARCHAR(191) NULL,
      clientId VARCHAR(191) NULL,
      INDEX (linenItemId), INDEX (bedId), INDEX (clientId),
      CONSTRAINT fk_distributeditem_item FOREIGN KEY (linenItemId) REFERENCES linenitem(id) ON DELETE CASCADE,
      CONSTRAINT fk_distributeditem_bed FOREIGN KEY (bedId) REFERENCES bed(id) ON DELETE CASCADE,
      CONSTRAINT fk_distributeditem_client FOREIGN KEY (clientId) REFERENCES client(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  // Ensure missing columns for existing databases
  try {
    await db.query(`SELECT clientId FROM linenitem LIMIT 1;`);
  } catch {
    try { await db.query(`ALTER TABLE linenitem ADD COLUMN clientId VARCHAR(191) NULL;`); } catch {}
    try { await db.query(`CREATE INDEX idx_linenitem_clientId ON linenitem(clientId);`); } catch {}
    try { await db.query(`ALTER TABLE linenitem ADD CONSTRAINT fk_linenitem_client FOREIGN KEY (clientId) REFERENCES client(id) ON DELETE SET NULL;`); } catch {}
  }

  // Normalize confirmationType to VARCHAR for Prisma compatibility
  try {
    // If column is ENUM, convert to VARCHAR(32)
    await db.query(`ALTER TABLE \`order\` MODIFY COLUMN confirmationType VARCHAR(32) NULL`);
  } catch {}

  // Ensure weighingcontrol has kind and referenceDate (backfill defaults)
  try { await db.query(`SELECT kind FROM weighingcontrol LIMIT 1;`); } catch { try { await db.query(`ALTER TABLE weighingcontrol ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'limpa';`); } catch {} }
  try { await db.query(`SELECT referenceDate FROM weighingcontrol LIMIT 1;`); } catch { try { await db.query(`ALTER TABLE weighingcontrol ADD COLUMN referenceDate DATE NOT NULL DEFAULT (CURRENT_DATE);`); } catch {} }
  try { await db.query(`SELECT status FROM weighingcontrol LIMIT 1;`); } catch { try { await db.query(`ALTER TABLE weighingcontrol ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'open';`); } catch {} }
  try { await db.query(`SELECT closedAt FROM weighingcontrol LIMIT 1;`); } catch { try { await db.query(`ALTER TABLE weighingcontrol ADD COLUMN closedAt DATETIME NULL;`); } catch {} }
  try { await db.query(`SELECT expectedDeliveryDate FROM weighingcontrol LIMIT 1;`); } catch { try { await db.query(`ALTER TABLE weighingcontrol ADD COLUMN expectedDeliveryDate DATE NULL;`); } catch {} }
  // Add clientId columns and FKs if missing
  try { await db.query(`SELECT clientId FROM stockmovement LIMIT 1;`); } catch { try { await db.query(`ALTER TABLE stockmovement ADD COLUMN clientId VARCHAR(191) NULL;`); } catch {} }
  try { await db.query(`SELECT clientId FROM weighingcontrol LIMIT 1;`); } catch { try { await db.query(`ALTER TABLE weighingcontrol ADD COLUMN clientId VARCHAR(191) NULL;`); } catch {} }

  // Ensure admin exists (bootstrap pattern similar à rota)
  const [rows] = await db.query<any[]>(`SELECT id FROM SystemUser WHERE role='admin' LIMIT 1;`);
  if (!rows || rows.length === 0) {
    const passwordHash = await bcrypt.hash('123456', 10);
    await db.query(`INSERT INTO SystemUser (id,name,email,role,passwordHash) VALUES (UUID(), 'Admin', 'admin@site.com', 'admin', ?)`, [passwordHash]);
  }

  await db.end();
}

ensureDatabase().catch(() => process.exit(0)).finally(() => process.exit(0));


