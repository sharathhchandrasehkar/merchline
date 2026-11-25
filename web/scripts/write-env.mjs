// Writes public/env.js so the static build knows where the API lives.
//   API_URL=https://merchline-api.onrender.com node scripts/write-env.mjs
//   API_HOST=merchline-api.onrender.com node scripts/write-env.mjs   (Render blueprints pass a bare host)
import { writeFileSync } from 'node:fs';
const raw = process.env.API_URL || (process.env.API_HOST ? `https://${process.env.API_HOST}` : '');
const url = raw.trim().replace(/\/+$/, '');
if (url && !/^https?:\/\/[^\s'"<>]+$/.test(url)) { console.error(`API URL is not a valid http(s) URL: ${url}`); process.exit(1); }
writeFileSync(new URL('../public/env.js', import.meta.url), `window.__MERCHLINE_API__ = ${JSON.stringify(url)};\n`);
console.log(`env.js -> ${url || '(same origin)'}`);
