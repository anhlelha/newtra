import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../config';
import logger from '../utils/logger';

class DatabaseService {
  private db: Database.Database | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(config.database.path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Connect to database
      this.db = new Database(config.database.path);

      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('foreign_keys = ON');

      logger.info('Database connected successfully', {
        path: config.database.path,
      });

      // Initialize schema
      this.initSchema();
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      throw error;
    }
  }

  private initSchema() {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');

      // Execute schema
      this.db!.exec(schema);

      logger.info('Database schema initialized successfully');

      // Run migrations after schema initialization
      this.runMigrations();
    } catch (error) {
      logger.error('Failed to initialize database schema', { error });
      throw error;
    }
  }

  private runMigrations() {
    try {
      const migrationsDir = path.join(__dirname, 'migrations');
      if (!fs.existsSync(migrationsDir)) {
        logger.info('No migrations directory found, skipping migrations');
        return;
      }

      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      if (migrationFiles.length === 0) {
        logger.info('No migration files found');
        return;
      }

      logger.info(`Found ${migrationFiles.length} migration file(s)`);

      for (const file of migrationFiles) {
        logger.info(`Running migration: ${file}`);
        const migrationSQL = fs.readFileSync(
          path.join(migrationsDir, file),
          'utf-8'
        );

        try {
          this.db!.exec(migrationSQL);
          logger.info(`Migration ${file} completed successfully`);
        } catch (error: any) {
          // Ignore "duplicate column" errors (column already exists)
          if (
            error.code === 'SQLITE_ERROR' &&
            error.message.includes('duplicate column')
          ) {
            logger.info(`Migration ${file} skipped - column already exists`);
          } else {
            throw error;
          }
        }
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Failed to run migrations', { error });
      throw error;
    }
  }

  getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db;
  }

  close() {
    if (this.db) {
      this.db.close();
      logger.info('Database connection closed');
    }
  }

  // Utility methods
  beginTransaction() {
    return this.db!.prepare('BEGIN').run();
  }

  commit() {
    return this.db!.prepare('COMMIT').run();
  }

  rollback() {
    return this.db!.prepare('ROLLBACK').run();
  }

  // Execute within transaction
  transaction<T>(fn: () => T): T {
    const trx = this.db!.transaction(fn);
    return trx();
  }

  // Health check
  healthCheck(): boolean {
    try {
      this.db!.prepare('SELECT 1').get();
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export default databaseService;
