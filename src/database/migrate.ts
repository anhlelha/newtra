import databaseService from './index';
import logger from '../utils/logger';

async function migrate() {
  try {
    logger.info('Starting database migration...');

    // Database is already initialized in DatabaseService constructor
    const db = databaseService.getDatabase();

    // Verify tables exist
    const tables = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `
      )
      .all();

    logger.info('Migration completed successfully', {
      tables: tables.map((t: any) => t.name),
    });

    // Insert default config if not exists
    const insertConfig = db.prepare(`
      INSERT OR IGNORE INTO config (key, value, description)
      VALUES (?, ?, ?)
    `);

    insertConfig.run(
      'app.version',
      '1.0.0',
      'Application version'
    );

    insertConfig.run(
      'trading.last_reset',
      new Date().toISOString(),
      'Last daily stats reset timestamp'
    );

    logger.info('Default configuration inserted');

    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error });
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrate();
}

export default migrate;
