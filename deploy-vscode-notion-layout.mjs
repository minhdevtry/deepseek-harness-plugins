import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[+] Starting Unified 3-Column VS Code + TipTap Notion Layout Deployment...');

// Step 1: Build the client bundle
console.log('[+] Building client bundle...');
execSync('node build-unified-vscode-layout.mjs', { cwd: __dirname, stdio: 'inherit' });

// Step 2: Target installation paths
const dshProfilesDir = path.join(os.homedir(), '.dsh/profiles');
const webProfileDir = path.join(dshProfilesDir, 'web');
const webNodeModules = path.join(webProfileDir, 'node_modules/@anoslide');
const globalProfileNodeModules = path.join(dshProfilesDir, 'node_modules/@anoslide');

fs.mkdirSync(webNodeModules, { recursive: true });
fs.mkdirSync(globalProfileNodeModules, { recursive: true });

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy packages to profile directories
console.log('[+] Installing @anoslide packages to profile node_modules...');
const hostSrc = path.join(__dirname, 'plugins/dsh-host-files');
const clientSrc = path.join(__dirname, 'plugins/dsh-client-vscode-layout');

copyDirRecursive(hostSrc, path.join(webNodeModules, 'dsh-host-files'));
copyDirRecursive(clientSrc, path.join(webNodeModules, 'dsh-client-vscode-layout'));

copyDirRecursive(hostSrc, path.join(globalProfileNodeModules, 'dsh-host-files'));
copyDirRecursive(clientSrc, path.join(globalProfileNodeModules, 'dsh-client-vscode-layout'));

// Step 3: Update ~/.dsh/profiles/web/cordis.patch.yml
const patchYamlFile = path.join(webProfileDir, 'cordis.patch.yml');
let patchYaml = fs.existsSync(patchYamlFile) ? fs.readFileSync(patchYamlFile, 'utf8') : '';

// Clean existing layout entries
patchYaml = patchYaml.replace(/- id: ui-layout[\s\S]*?name: '@anoslide\/dsh-host-files'/g, '');
patchYaml = patchYaml.replace(/- id: ui-layout\s+name: '@anoslide\/dsh-client-vscode-layout'/g, '');

const layoutPatch = `
- id: ui-layout
  disabled: true

- insert:
    - id: ui-layout-vscode
      name: '@anoslide/dsh-client-vscode-layout'
    - id: vscode-host-files
      name: '@anoslide/dsh-host-files'
`;

patchYaml = layoutPatch.trim() + '\n\n' + patchYaml.trim() + '\n';
fs.writeFileSync(patchYamlFile, patchYaml, 'utf8');

console.log('[✓] Deployment completed successfully!');
