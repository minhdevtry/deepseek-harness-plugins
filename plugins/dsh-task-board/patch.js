import fs from 'fs'
import path from 'path'
import os from 'os'

const baseDir = path.join(os.homedir(), '.dsh/profiles/web/node_modules/@linxin666/dsh-client-ui-task-board/lib')
const clientFile = path.join(baseDir, 'client.js')
const indexFile = path.join(baseDir, 'index.js')

if (fs.existsSync(clientFile)) {
  let content = fs.readFileSync(clientFile, 'utf8')

  // 1. Force English dictionary
  if (!content.includes('function dictionary() { return en;')) {
    content = content.replace('function dictionary() {', 'function dictionary() { return en; ')
  }

  // 2. Tweak conversationColumn so Task Board mounts cleanly beside the sidebar without hiding left/right panels
  const oldColumnFn = 'function conversationColumn() {\n\t\t\treturn document.querySelector(CONVERSATION_COLUMN_SELECTOR) ?? void 0;\n\t\t}'
  const newColumnFn = `function conversationColumn() {
			return document.querySelector(CONVERSATION_COLUMN_SELECTOR)
				?? document.querySelector("[data-pane=\\"sidebar\\"]")?.nextElementSibling
				?? document.querySelector("[class*=\\"sidebar\\"]")?.nextElementSibling
				?? document.querySelector("#root > div > div:nth-child(2)");
		}`

  if (content.includes(oldColumnFn)) {
    content = content.replace(oldColumnFn, newColumnFn)
  }

  fs.writeFileSync(clientFile, content, 'utf8')
  console.log('[✓] Successfully patched dsh-task-board layout (English dictionary + sidebar preservation)!')
}

if (fs.existsSync(indexFile)) {
  let content = fs.readFileSync(indexFile, 'utf8')
  content = content.replace(
    /const TASK_BOARD_GUIDANCE = "[^"]*";/,
    'const TASK_BOARD_GUIDANCE = "Local dsh-task-board plugin installed (Task Board for DSH Web GUI): sidebar Task Board entry; multi-column kanban task management; task execution via agent sessions; 5-part cron scheduled execution.";'
  )
  fs.writeFileSync(indexFile, content, 'utf8')
  console.log('[✓] Successfully updated task board guidance to English in index.js!')
}
