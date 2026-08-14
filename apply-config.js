import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

console.log('🚀 Setting up DeepSeek Harness (dsh) plugins and configurations...')

// 1. Install dsh-local-filetree plugin
try {
  console.log('📦 Installing dsh-local-filetree plugin from upstream (Mongfayi/dsh-local-filetree)...')
  execSync('dsh plugin --profile web add github:Mongfayi/dsh-local-filetree', { stdio: 'inherit' })
} catch (err) {
  console.error('⚠️ Could not install dsh-local-filetree via CLI. Please check your network connection.')
}

// 2. Install dsh-at-file plugin
try {
  console.log('📦 Installing dsh-at-file plugin from upstream (omdsh-dev/dsh-at-file)...')
  execSync('dsh plugin --profile web add github:omdsh-dev/dsh-at-file', { stdio: 'inherit' })
} catch (err) {
  console.error('⚠️ Could not install dsh-at-file via CLI. Please check your network connection.')
}

// 3. Apply cordis.patch.yml
const patchSrc = path.join(process.cwd(), 'cordis.patch.yml')
const patchDest = path.join(os.homedir(), '.dsh/profiles/web/cordis.patch.yml')

if (fs.existsSync(patchSrc)) {
  fs.mkdirSync(path.dirname(patchDest), { recursive: true })
  fs.copyFileSync(patchSrc, patchDest)
  console.log(`[✓] Updated profile patch configuration at: ${patchDest}`)
}

// 4. Run English localization patch for dsh-local-filetree
try {
  console.log('🌐 Applying English UI localization patch for dsh-local-filetree...')
  execSync('node plugins/dsh-local-filetree/patch.js', { stdio: 'inherit' })
} catch (err) {
  console.error('⚠️ Error running English localization patch for dsh-local-filetree.')
}

console.log('\n🎉 Setup completed! Run `dsh web` to start the web application.')
