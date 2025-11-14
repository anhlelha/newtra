const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
  console.log('Dropping pending_signals_new table if it exists...');
  db.exec('DROP TABLE IF EXISTS pending_signals_new;');
  console.log('✓ Successfully dropped pending_signals_new table');
} catch (error) {
  console.error('✗ Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
