1. 🎨 Giao diện UI, Chợ Plugin & Input Triggers
Chợ quản lý Plugin (In-app Plugin Inventory): Tích hợp sẵn gói @deepseek-ai/dsh-ui-settings-plugins & ui-settings-plugin-inventory. Bạn có thể quản lý, xem danh sách và bật/tắt các plugin trực tiếp trên Web UI.
Cú pháp @filename trong ô Chat: Đã tích hợp gói @deepseek-ai/dsh-client-ui-input-trigger & attachment-local. Khi gõ @ trong ô chat trên Web UI, hệ thống sẽ tự động hiện danh sách gợi ý tệp (filename), kho hội thoại cũ để bạn đính kèm trực tiếp vào prompt.
Giao diện Kanban / Kế hoạch (UI Widgets): Đã tích hợp gói ui-plan, ui-sidebar, ui-trajectory, ui-jobs để theo dõi các bước thực thi kế hoạch trực quan.
2. 🧠 Quản lý Bộ nhớ & Nén Ngữ cảnh (Memory & Compaction)
Compaction & Pruning: Tích hợp sẵn gói:
@deepseek-ai/dsh-compaction-basic: Tự động nén tóm tắt hội thoại.
@deepseek-ai/dsh-compaction-tool-result-pruner: Tự động cắt tỉa (prune) các đầu ra Tool Call quá dài (vượt ngưỡng token) để tiết kiệm ngữ cảnh.
@deepseek-ai/dsh-command-compact: Cho phép gõ lệnh thu gọn hội thoại chủ động.
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