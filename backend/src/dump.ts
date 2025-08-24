import 'dotenv/config';
import mysql from 'mysql2/promise';
import mysqlRaw from 'mysql2';
import fs from 'fs';
import path from 'path';

function parseDatabaseUrl(url: string) {
  const match = url.match(/^mysql:\/\/([^:]+):([^@]*)@([^:\/]+)(?::(\d+))?\/(.+)$/);
  if (!match) throw new Error('Invalid DATABASE_URL');
  const [, user, password, host, port, database] = match;
  return { user, password, host, port: port ? Number(port) : 3306, database };
}

function escapeValue(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (val instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = val.getFullYear();
    const mm = pad(val.getMonth() + 1);
    const dd = pad(val.getDate());
    const hh = pad(val.getHours());
    const mi = pad(val.getMinutes());
    const ss = pad(val.getSeconds());
    return `'${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}'`;
  }
  if (typeof val === 'number' || typeof val === 'bigint') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  // Fallback to mysql escape for strings/buffers
  // @ts-ignore
  return mysqlRaw.escape(val);
}

async function main() {
  const url = process.env.DATABASE_URL || '';
  const cfg = parseDatabaseUrl(url);
  const outDir = path.resolve(process.cwd(), '..', 'db');
  const outFile = path.join(outDir, 'dump.sql');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const conn = await mysql.createConnection({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database, multipleStatements: true });

  const header = `-- ECOLAV dump\n-- Database: ${cfg.database}\n-- Generated at: ${new Date().toISOString()}\n\nSET FOREIGN_KEY_CHECKS=0;\n`;
  fs.writeFileSync(outFile, header, 'utf8');

  // Collect tables
  const [tables] = await conn.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
    [cfg.database]
  );

  for (const row of tables as Array<{ TABLE_NAME: string }>) {
    const table = row.TABLE_NAME as string;
    // Drop & create
    const [crtRows] = await conn.query<any[]>(`SHOW CREATE TABLE \`${table}\``);
    const createSql: string = crtRows[0]['Create Table'];
    fs.appendFileSync(outFile, `\n-- ----------------------------\n-- Table structure for ${table}\n-- ----------------------------\nDROP TABLE IF EXISTS \`${table}\`;\n${createSql};\n`);

    // Data
    const [data] = await conn.query<any[]>(`SELECT * FROM \`${table}\``);
    if ((data as any[]).length > 0) {
      fs.appendFileSync(outFile, `\n-- Data for ${table}\n`);
      const columns = Object.keys(data[0]);
      for (const row of data as any[]) {
        const values = columns.map((c) => escapeValue(row[c]));
        fs.appendFileSync(outFile, `INSERT INTO \`${table}\` (\`${columns.join('`,`')}\`) VALUES (${values.join(',')});\n`);
      }
    }
  }

  fs.appendFileSync(outFile, `\nSET FOREIGN_KEY_CHECKS=1;\n`);
  await conn.end();
  // eslint-disable-next-line no-console
  console.log(`Dump saved to ${outFile}`);
}

main().catch((e) => { console.error(e); process.exit(1); });


