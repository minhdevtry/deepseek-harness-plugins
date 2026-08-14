import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

console.log('🚀 Setting up DeepSeek Harness (dsh) plugins and configurations...')

// 1. Install File Tree plugin
try {
  console.log('📦 Installing dsh-local-filetree plugin...')
  execSync('dsh plugin --profile web add github:Mongfayi/dsh-local-filetree', { stdio: 'inherit' })
} catch (err) {
  console.error('⚠️ Could not install dsh-local-filetree via CLI. Please check your network connection.')
}

// 2. Apply cordis.patch.yml
const patchSrc = path.join(process.cwd(), 'cordis.patch.yml')
const patchDest = path.join(os.homedir(), '.dsh/profiles/web/cordis.patch.yml')

if (fs.existsSync(patchSrc)) {
  fs.mkdirSync(path.dirname(patchDest), { recursive: true })
  fs.copyFileSync(patchSrc, patchDest)
  console.log(`[✓] Updated profile patch configuration at: ${patchDest}`)
}

// 3. Run English localization patch
try {
  console.log('🌐 Applying English UI localization...')
  execSync('node patch-en.js', { stdio: 'inherit' })
} catch (err) {
  console.error('⚠️ Error running English localization patch.')
}

console.log('\n🎉 Setup completed! Run `dsh web` to start the web application.')
