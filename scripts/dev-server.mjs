import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worktree = path.basename(projectRoot);

function portForWorktree(name) {
  let hash = 0;
  for (const char of name) hash = (Math.imul(hash, 33) + char.charCodeAt(0)) >>> 0;
  return 8100 + (hash % 800);
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickPort(preferred) {
  for (let port = preferred; port < preferred + 30; port++) {
    if (await portFree(port)) return port;
  }
  throw new Error(`No free port found starting at ${preferred}`);
}

const extra = process.argv.slice(2);
const portFlag = extra.findIndex((arg) => arg === '--port' || arg === '-p');
let requested = portForWorktree(worktree);
if (portFlag !== -1) {
  const value = extra[portFlag + 1];
  if (!value || value.startsWith('-')) {
    throw new Error('Missing value for --port');
  }
  requested = Number(value);
  if (!Number.isInteger(requested) || requested <= 0) {
    throw new Error(`Invalid port: ${value}`);
  }
  extra.splice(portFlag, 2);
}

const port = await pickPort(requested);
if (port !== requested) {
  console.log(`Port ${requested} is in use. Starting on http://localhost:${port} instead.`);
} else {
  console.log(`Starting ${worktree} on http://localhost:${port}`);
}

const expo = path.join(projectRoot, 'node_modules', '.bin', 'expo');
const child = spawn(expo, ['start', '--port', String(port), ...extra], {
  stdio: 'inherit',
  env: {
    ...process.env,
    RCT_METRO_PORT: String(port),
    METRO_CACHE_VERSION: worktree,
  },
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
