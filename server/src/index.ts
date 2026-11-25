import './env.js';
import { createApp } from './app.js';
import { pool } from './db.js';
import { resetCaches, tableCounts } from './lib/records.js';
import { resetOverview } from './lib/stats.js';
import { isSeeded, seed } from './seed/load.js';
import { status } from './status.js';

const PORT = Number(process.env.PORT || 3000);
const app = createApp();
app.listen(PORT, () => console.log(`[api] listening on :${PORT}`));

/** First boot on an empty database: generate the demo catalog in the background. */
async function ensureData() {
  try {
    if (await isSeeded()) {
      status.seeded = true;
      status.styles = (await tableCounts()).Product ?? 0;
      return;
    }
    if (process.env.AUTO_SEED === 'false') { status.message = 'Database is empty. Run npm run seed.'; return; }
    status.seeding = true;
    const styles = Number(process.env.SEED_STYLES || 3000);
    await seed(styles, (m) => { console.log(m); status.message = m; });
    resetCaches(); resetOverview();
    status.seeded = true; status.seeding = false; status.styles = styles; status.message = '';
  } catch (err) {
    status.seeding = false;
    status.message = 'Database not reachable. Check DATABASE_URL.';
    console.error('[api] data setup failed:', err);
    setTimeout(ensureData, 30_000);
  }
}
ensureData();

const stop = () => pool.end().finally(() => process.exit(0));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
