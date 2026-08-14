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
dsh plugin --profile web add include:tool-str-replace-editor
dsh plugin --profile web add include:tool-web



Thành công:
dsh plugin --profile web add github:Mongfayi/dsh-local-filetree

Nguyên nhân gây ra lỗi:
Lỗi xuất hiện do plugin command-compact yêu cầu dịch vụ nền compaction-basic để hoạt động, nhưng trước đó compaction-basic vẫn ở trạng thái disabled: true.

✅ Cách khắc phục:
Tôi đã cập nhật bổ sung - id: compaction-basic và - id: tool-result-pruner vào file cấu hình patch ~/.dsh/profiles/web/cordis.patch.yml để cung cấp đầy đủ dịch vụ nén bộ nhớ cho hệ thống.