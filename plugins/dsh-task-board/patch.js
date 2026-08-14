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

  // 2. Adjust CSS so taskboard view is bounded to the center conversation area
  content = content.replace(
    '[data-dsh-taskboard-view]{z-index:60;',
    '[data-dsh-taskboard-view]{z-index:10;'
  )

  // 3. Inject CSS to ensure sidebar and right panel remain visible and above taskboard
  const sidebarCss = `
[data-pane="sidebar"], [class*="sidebarCol"], [data-pane="filetree"], [class*="filetree"] {
  z-index: 50 !important;
  position: relative !important;
}
[data-dsh-taskboard-view] {
  position: absolute !important;
  inset: 0 !important;
  z-index: 10 !important;
}
`
  if (!content.includes('data-pane="filetree"')) {
    content = content.replace('tag.textContent = css$1;', `tag.textContent = css$1 + ${JSON.stringify(sidebarCss)};`)
  }

  // 4. Update conversationColumn and mountBoard to strictly attach inside the center pane (next to sidebar)
  const oldConversationBlock = `function conversationColumn() {
			return document.querySelector(CONVERSATION_COLUMN_SELECTOR)
				?? document.querySelector("[data-pane=\\"sidebar\\"]")?.nextElementSibling
				?? document.querySelector("[class*=\\"sidebar\\"]")?.nextElementSibling
				?? document.querySelector("#root > div > div:nth-child(2)");
		}`

  const newConversationBlock = `function conversationColumn() {
			const conv = document.querySelector(CONVERSATION_COLUMN_SELECTOR);
			if (conv) {
				conv.style.position = "relative";
				return conv;
			}
			const sidebar = document.querySelector("[data-pane=\\"sidebar\\"], [class*=\\"sidebarCol\\"]");
			if (sidebar && sidebar.nextElementSibling) {
				const center = sidebar.nextElementSibling;
				center.style.position = "relative";
				return center;
			}
			const rootDiv = document.querySelector("#root > div");
			if (rootDiv && rootDiv.children.length > 1) {
				const center = rootDiv.children[1];
				center.style.position = "relative";
				return center;
			}
			return void 0;
		}`

  if (content.includes(oldConversationBlock)) {
    content = content.replace(oldConversationBlock, newConversationBlock)
  }

  fs.writeFileSync(clientFile, content, 'utf8')
  console.log('[✓] Successfully patched dsh-task-board layout (Sidebar & File Tree preservation)!')
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
