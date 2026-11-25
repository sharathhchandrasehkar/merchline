/** Loads server/.env (if present) before anything reads process.env. Real environment variables win. */
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  const before = { ...process.env };
  process.loadEnvFile('.env');
  Object.assign(process.env, before);
}
