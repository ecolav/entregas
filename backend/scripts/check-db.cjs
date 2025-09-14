const mysql = require('mysql2/promise');

function parseDatabaseUrl(url) {
  const match = url.match(/^mysql:\/\/([^:]+):([^@]*)@([^:\/]+)(?::(\d+))?\/(.+)$/);
  if (!match) throw new Error('Invalid DATABASE_URL');
  const [, user, password, host, port, database] = match;
  return { user, password, host, port: port ? Number(port) : 3306, database };
}

(async () => {
  try {
    const url = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/pedidos_ecolav';
    const cfg = parseDatabaseUrl(url);
    const conn = await mysql.createConnection({ ...cfg, multipleStatements: true });
    const [tables] = await conn.query('SHOW TABLES');
    const tableNames = tables.map((row) => Object.values(row)[0]);
    console.log('DATABASE:', cfg.database);
    console.log('TABLES:', tableNames.join(', '));

    const targets = ['cage', 'weighingcontrol', 'weighingentry'];
    for (const t of targets) {
      if (tableNames.includes(t)) {
        const [desc] = await conn.query(`DESCRIBE \`${t}\``);
        console.log(`\nDESCRIBE ${t}:`);
        for (const row of desc) {
          console.log(`- ${row.Field}: ${row.Type}${row.Null === 'NO' ? ' NOT NULL' : ''}`);
        }
      } else {
        console.log(`\n${t} table: NOT FOUND`);
      }
    }
    await conn.end();
  } catch (err) {
    console.error('DB CHECK ERROR:', err.message);
    process.exit(1);
  }
})();


