import '../env.js';
/** npm run seed -- [styles]   (default: SEED_STYLES or 3000) */
import { pool } from '../db.js';
import { seed } from './load.js';

const styles = Number(process.argv[2] || process.env.SEED_STYLES || 3000);
seed(styles)
  .then(() => pool.end())
  .catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
