import databaseService from './index';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

async function migrate() {
  try {
    logger.info('Starting database migration...');

    // Database is already initialized in DatabaseService constructor
    const db = databaseService.getDatabase();

    // Run migration files from migrations directory
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        logger.info(`Running migration: ${file}`);
        const migrationSQL = fs.readFileSync(
          path.join(migrationsDir, file),
          'utf-8'
        );

        try {
          db.exec(migrationSQL);
          logger.info(`Migration ${file} completed successfully`);
        } catch (error: any) {
          // Ignore "duplicate column" errors (column already exists)
          if (error.code === 'SQLITE_ERROR' && error.message.includes('duplicate column')) {
            logger.info(`Migration ${file} skipped - column already exists`);
          } else {
            throw error;
          }
        }
      }
    }

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
