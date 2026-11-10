// Prints one version's section of CHANGELOG.md (without its heading), for the release page.
// Usage: node scripts/release-notes.mjs 1.0.0-beta.1
import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) { console.error('usage: release-notes.mjs <version>'); process.exit(1); }
const text = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const lines = text.split('\n');
const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
if (start < 0) { console.error(`no section for ${version} in CHANGELOG.md`); process.exit(1); }
// the section ends at the next version, or at the link definitions at the foot of the file
const end = lines.findIndex((l, i) => i > start && (l.startsWith('## [') || /^\[[^\]]+\]: /.test(l)));
console.log(lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim());
