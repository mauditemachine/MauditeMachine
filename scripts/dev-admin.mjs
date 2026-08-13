/**
 * `npm run admin` : lance en meme temps le site (vite) et le serveur local
 * d'ecriture (server.js), puis affiche l'URL du panneau admin.
 *
 * Zero dependance ajoutee : pas de `concurrently`, juste child_process.
 * Le port de vite est lu sur sa sortie plutot que suppose, pour que l'URL
 * affichee reste juste meme si 5173 est deja pris.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const children = [];
let shuttingDown = false;
let adminUrlShown = false;

/** Decoupe un flux en lignes completes avant de les prefixer. */
function pipeLines(stream, onLine) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) onLine(line);
  });
  stream.on('end', () => {
    if (buffer.trim()) onLine(buffer);
  });
}

function start(name, color, command, args, { detectUrl = false } = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);

  const tag = `${color}${name.padEnd(6)}${C.reset}${C.dim}|${C.reset} `;
  const write = (line) => process.stdout.write(`${tag}${line}\n`);

  pipeLines(child.stdout, (line) => {
    write(line);
    // Uniquement sur la sortie de vite : le serveur API annonce son propre
    // port (3001) en premier, et on annoncerait l'admin sur le mauvais port.
    if (detectUrl) detectViteUrl(line);
  });
  pipeLines(child.stderr, (line) => write(line));

  child.on('error', (err) => {
    console.error(`\n${C.red}[${name}] impossible a demarrer :${C.reset} ${err.message}`);
    shutdown(1);
  });

  child.on('exit', (code) => {
    if (shuttingDown) return;
    const why = code === 0 ? 'termine' : `arrete (code ${code})`;
    console.error(`\n${C.red}[${name}] ${why}. On coupe l'autre process.${C.reset}`);
    shutdown(code ?? 1);
  });

  return child;
}

/** Repere la ligne "Local: http://localhost:XXXX/" de vite pour annoncer l'admin. */
function detectViteUrl(line) {
  if (adminUrlShown) return;
  const match = line.match(/https?:\/\/localhost:(\d+)/);
  if (!match) return;
  adminUrlShown = true;
  const base = `http://localhost:${match[1]}`;
  process.stdout.write(
    [
      '',
      `${C.bold}${C.green}  Panneau admin pret${C.reset}`,
      '',
      `  ${C.bold}${C.cyan}${base}/mm-admin${C.reset}   ${C.dim}events, merch, news, releases${C.reset}`,
      `  ${C.cyan}${base}/ms-admin${C.reset}   ${C.dim}messages${C.reset}`,
      '',
      `  ${C.dim}Pas de mot de passe en local. Les modifications ecrivent`,
      `  directement dans public/*.json. Ctrl+C pour tout arreter.${C.reset}`,
      '',
    ].join('\n'),
  );
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  // Laisse aux process le temps de fermer leurs ports avant de rendre la main.
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => {
  process.stdout.write('\n');
  shutdown(0);
});
process.on('SIGTERM', () => shutdown(0));

// Mode iPad / reseau local : `npm run admin -- --lan` (opt-in explicite).
// server.js refusera de demarrer sans ADMIN_PASSWORD dans ce mode.
const LAN = process.argv.includes('--lan');

console.log(`${C.bold}Demarrage du site + du serveur d'ecriture local${LAN ? ' (mode reseau local)' : ''}...${C.reset}\n`);

// Le serveur d'ecriture d'abord : il doit repondre quand l'admin sonde /api/auth.
start('api', C.magenta, process.execPath, [path.join(ROOT, 'server.js'), ...(LAN ? ['--lan'] : [])]);

// vite en direct plutot que `npm run dev`, pour ouvrir sur /mm-admin.
const viteBin = path.join(ROOT, 'node_modules', '.bin', 'vite');
start('vite', C.cyan, viteBin, ['--open', '/mm-admin', ...(LAN ? ['--host'] : [])], { detectUrl: true });
