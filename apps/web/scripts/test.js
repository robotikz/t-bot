#!/usr/bin/env node
const { spawnSync } = require('child_process');

// Accept forwarded CLI args and translate the common `--run` used by vitest
// into the Angular CLI equivalent `--watch=false`. Also allow any other
// ng test args to be passed through untouched.
const rawArgs = process.argv.slice(2);
const args = [];
let sawRun = false;
for (const a of rawArgs) {
  // pnpm may insert a bare '--' separator; ignore it.
  if (a === '--') continue;
  if (a === '--run') {
    sawRun = true;
    continue;
  }
  args.push(a);
}

if (sawRun) args.push('--watch=false');

// Resolve the local Angular CLI entrypoint (installed in node_modules).
let ngBin;
try {
  ngBin = require.resolve('@angular/cli/bin/ng', { paths: [process.cwd()] });
} catch (err) {
  // Fallback to global `ng` on PATH if local resolution fails.
  ngBin = null;
}

const spawnArgs = ngBin ? [ngBin, 'test', ...args] : ['ng', 'test', ...args];
const cmd = ngBin ? process.execPath : 'ng';

const res = spawnSync(cmd, spawnArgs, { stdio: 'inherit' });
process.exit(res.status === null ? 1 : res.status);
