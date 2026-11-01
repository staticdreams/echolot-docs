#!/usr/bin/env node
// run-with-timeout.mjs <seconds> <command> [args…]: runs the command and stops it (and everything it started) when it
// takes longer than <seconds>, exiting 124 like coreutils' timeout. The build uses it so a build that hangs on
// Cloudflare fails within minutes instead of running until Cloudflare stops it.
import { spawn } from 'node:child_process';

const [limit, command, ...args] = process.argv.slice(2);
const seconds = Number(limit);
if (!command || !Number.isFinite(seconds) || seconds <= 0) {
  console.error('usage: run-with-timeout.mjs <seconds> <command> [args…]');
  process.exit(2);
}

// Its own process group, so a timeout stops the preview servers and workers the build started too.
const child = spawn(command, args, { stdio: 'inherit', detached: true });
const stopGroup = (signal) => {
  try {
    process.kill(-child.pid, signal);
  } catch {
    // Already gone.
  }
};

const timer = setTimeout(() => {
  console.error(`\n[run-with-timeout] ${command} ${args.join(' ')} ran longer than ${seconds} s: stopping it.`);
  stopGroup('SIGTERM');
  setTimeout(() => {
    stopGroup('SIGKILL');
    process.exit(124);
  }, 5000).unref();
}, seconds * 1000);

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stopGroup(signal));

child.on('exit', (code, signal) => {
  clearTimeout(timer);
  if (signal === 'SIGTERM' || signal === 'SIGKILL') process.exit(124);
  process.exit(code ?? 1);
});
