import fs from 'fs'
import path from 'path'
import os from 'os'

const pluginPath = path.join(os.homedir(), '.dsh/profiles/web/node_modules/dsh-local-filetree/lib/client.js')

if (!fs.existsSync(pluginPath)) {
  console.error(`[X] Plugin file not found at: ${pluginPath}`)
  process.exit(1)
}

let content = fs.readFileSync(pluginPath, 'utf8')

const replacements = [
  ['"aria-label": "文件树"', '"aria-label": "File Tree"'],
  ['title: "文件树"', 'title: "File Tree"'],
  ['"文件树"', '"File Tree"'],
  ['"等待加载…"', '"Waiting for load..."'],
  ['"加载中…"', '"Loading..."'],
  ['"折叠"', '"Collapse"'],
  ['"展开"', '"Expand"'],
  ['"（无会话工作区）"', '"(No session workspace)"'],
  ['"隐藏隐藏文件"', '"Hide hidden files"'],
  ['"显示隐藏文件"', '"Show hidden files"'],
  ['"刷新"', '"Refresh"'],
  ['"恢复工具详情"', '"Restore tool details"'],
  ['"打开一个会话后显示其工作区文件树"', '"Open a session to display its workspace file tree"']
]

let count = 0
for (const [from, to] of replacements) {
  if (content.includes(from)) {
    content = content.replaceAll(from, to)
    count++
  }
}

fs.writeFileSync(pluginPath, content, 'utf8')
console.log(`[✓] Successfully localized ${count} UI strings to English in dsh-local-filetree!`)
