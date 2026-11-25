// One-time local setup: installs both apps and creates server/.env from the example. Works on Windows, macOS and Linux.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) { console.error(`Merchline needs Node.js 22 or newer (you have ${process.version}). Get it from https://nodejs.org`); process.exit(1); }
for (const dir of ['.', 'server', 'web']) {
  console.log(`\n> Installing ${dir === '.' ? 'root tools' : dir}…`);
  execSync('npm install', { cwd: dir, stdio: 'inherit', shell: true });
}
if (!existsSync('server/.env')) { copyFileSync('server/.env.example', 'server/.env'); console.log('\n> Created server/.env'); }
console.log('\nDone. In VS Code press Ctrl+Shift+B (or run "npm run dev") to start the database, API and web app.');
