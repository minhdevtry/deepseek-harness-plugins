1. 🎨 Giao diện UI, Chợ Plugin & Input Triggers
Chợ quản lý Plugin (In-app Plugin Inventory): Tích hợp sẵn gói @deepseek-ai/dsh-ui-settings-plugins & ui-settings-plugin-inventory. Bạn có thể quản lý, xem danh sách và bật/tắt các plugin trực tiếp trên Web UI.


3. 🤖 Subagents & Phân nhánh Luồng (Multi-Agent & Session Forking)
Subagent Forking: Tích hợp sẵn các gói:
@deepseek-ai/dsh-subagent-fork-in-process: Tách nhánh agent con chạy ngầm xử lý tác vụ nhỏ mà không ảnh hưởng log chính.
@deepseek-ai/dsh-subagent-spawn-in-process: Khởi tạo agent con hoàn toàn mới.
@deepseek-ai/dsh-ui-subagent & @deepseek-ai/dsh-ui-jobs: Giao diện theo dõi danh sách các subagent đang chạy.

4. 🔌 LLM Adapters & Giao thức (MCP & LSP)
LLM Adapters: Tích hợp gói @deepseek-ai/dsh-llm-pi-ai & llm-deepseek. Hỗ trợ kết nối với nhiều nhà cung cấp mô hình như:
DeepSeek API
Local LLM via Ollama hoặc vLLM
Anthropic Claude API / OpenAI API / Groq / Mistral / Gemini
Giao thức MCP & LSP:
@deepseek-ai/dsh-mcp-client: Hỗ trợ Model Context Protocol (MCP) kết nối các MCP server.
@deepseek-ai/dsh-tool-lsp: Hỗ trợ Language Server Protocol (LSP) giúp Agent đọc hiểu cú pháp mã nguồn chuẩn xác như trong IDE.
á đù má `thật nè`

✅ tool-bash (Thực thi câu lệnh Bash Terminal)
✅ tool-fs (Đọc/ghi hệ thống tệp)
✅ tool-fs-search (Tìm kiếm tệp nhanh)
✅ agent-instructions (Đọc chỉ dẫn Agent)
✅ tool-skill (Kỹ năng mở rộng)
✅ plan-mode (Lập kế hoạch tác vụ)
✅ command-compact (Thu gọn ngữ cảnh hội thoại)
✅ tool-subagent-list-agents (Liệt kê Subagent)
✅ tool-subagent (Khởi tạo Subagent)
✅ workflow-worker-thread (Đa luồng Workflow)
✅ tool-workflow (Quy trình Workflow)
✅ tool-todo (Danh sách việc cần làm Todo)
✅ tool-str-replace-editor (Chỉnh sửa mã nguồn theo chuỗi)
✅ tool-web (Tìm kiếm Web)


dsh plugin --profile web add include:tool-bash
dsh plugin --profile web add include:tool-fs
dsh plugin --profile web add include:tool-fs-search
dsh plugin --profile web add include:agent-instructions
dsh plugin --profile web add include:tool-skill
dsh plugin --profile web add include:plan-mode
dsh plugin --profile web add include:command-compact
dsh plugin --profile web add include:tool-subagent-list-agents
dsh plugin --profile web add include:tool-subagent
dsh plugin --profile web add include:workflow-worker-thread
dsh plugin --profile web add include:tool-workflow
dsh plugin --profile web add include:tool-todo
dsh plugin --profile web add include:tool-web


---

Thành công:
dsh plugin --profile web add github:Mongfayi/dsh-local-filetree

Nguyên nhân gây ra lỗi:
Lỗi xuất hiện do plugin command-compact yêu cầu dịch vụ nền compaction-basic để hoạt động, nhưng trước đó compaction-basic vẫn ở trạng thái disabled: true.

✅ Cách khắc phục:
Tôi đã cập nhật bổ sung - id: compaction-basic và - id: tool-result-pruner vào file cấu hình patch ~/.dsh/profiles/web/cordis.patch.yml để cung cấp đầy đủ dịch vụ nén bộ nhớ cho hệ thống.

dsh plugin --profile web add github:omdsh-dev/dsh-at-file

dsh plugin --profile web add github:Ericwong5021/dsh-kanban
Nguyên nhân gây ra lỗi:
Repo github:Ericwong5021/dsh-kanban trên GitHub là dạng mã nguồn thô chưa biên dịch (thiếu file build lib/index.js), khiến Node.js báo lỗi ERR_MODULE_NOT_FOUND khi khởi động dsh web.

✅ Đã khắc phục & Thay thế bằng Plugin Kanban chính thức:
Tôi đã gỡ bỏ repo thô đó và thay thế bằng gói Kanban chính thức đã được biên dịch hoàn chỉnh trên NPM: @linxin666/dsh-client-ui-task-board.

bash
# Đã thực hiện lệnh gỡ repo cũ và cài đặt gói chuẩn:
dsh plugin --profile web remove dsh-kanban
dsh plugin --profile web add @linxin666/dsh-client-ui-task-board

Nguyên nhân chính gây ra màn hình trắng:
Trong mã nguồn của plugin dsh-task-board, hàm tìm kiếm khung hiển thị trung tâm (conversationColumn) chỉ tìm thẻ có attribute [data-pane="conversation"].

Khi bạn mới mở Web UI và chưa bấm vào một Session cuộc hội thoại nào, khung chat chưa được React khởi tạo (undefined), dẫn đến việc Bảng Kanban bị hủy render và trả về màn hình trắng tinh.

✅ Đã khắc phục thành công:
Thêm cơ chế tự chọn vùng hiển thị fallback (Self-healing DOM Selector):

Tôi đã bổ sung logic fallback trong file vá plugins/dsh-task-board/patch.js: nếu chưa mở session chat nào, Bảng Kanban sẽ tự động gắn vào ngay bên cạnh cột Sidebar.
Giờ đây dù bạn chưa tạo session hay đã mở session, Bảng Kanban đều sẽ hiển thị khung làm việc (To Do, In Progress, Done, Backlog,...) đầy đủ 100%!
Cập nhật lên Repo GitHub:

Đã cập nhật bản patch này vào plugins/dsh-task-board/patch.js và push lên minhdevtry/deepseek-harness-plugins.