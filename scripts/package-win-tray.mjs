import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const electronBuilderCache = join(root, '.cache', 'electron-builder');
mkdirSync(electronBuilderCache, { recursive: true });

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const electronBuilderCommand = isWindows
  ? join(root, 'node_modules', '.bin', 'electron-builder.cmd')
  : join(root, 'node_modules', '.bin', 'electron-builder');

const env = Object.fromEntries(
  Object.entries({
    ...process.env,
    ELECTRON_BUILDER_CACHE: electronBuilderCache
  }).filter((entry) => typeof entry[1] === 'string')
);

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: 'inherit',
      shell: isWindows,
      windowsHide: true
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'null'}`));
    });
  });

await run(npmCommand, ['run', 'build']);
await run(npmCommand, ['run', 'build:windows-helper']);
await run(electronBuilderCommand, ['--win', 'portable', '--config', 'electron-builder.yml']);
