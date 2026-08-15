# Dual Workspace — kế hoạch đã chốt

Mục tiêu: biến `dsh` từ Web Chat thành workspace phục vụ song song **developer** (mini-IDE kiểu
VS Code/Cursor), **người viết** (Notion/TipTap), và **AI agent** làm trung tâm phối hợp.

Tài liệu này ghi các **quyết định đã chốt** cùng *lý do* và *bằng chứng*. Nền tảng kỹ thuật
(slot, tầng kiến trúc, những gì đã xong) ở [architecture-review.md](architecture-review.md).

---

## 1. Quyết định đã chốt

| # | Quyết định | Lý do |
|---|---|---|
| 1 | **Search gộp vào Explorer** — cột trái còn 2 tab | Gõ vào ô search thì cây file đổi thành danh sách kết quả; thoát bằng nút back. `Ctrl+Shift+F` focus vào ô search. *Ghi chú: VS Code thật có tab Search riêng — đây là lựa chọn có ý thức đi khác, đổi lấy sự gọn.* |
| 2 | **Status bar giữ 3 mục**: Git branch · Ln,Col · Ngôn ngữ | Bỏ UTF-8 (không bao giờ đổi), đếm dòng/ký tự (VS Code không có), toggle Auto-save và Diff (sai chỗ — Auto-save chuyển vào Settings, Diff mở từ context menu tab) |
| 3 | **`.md` luôn mở TipTap**, có nút chuyển raw, **không** kiểm tra round-trip | Đã đo: 10/10 mẫu biến dạng, 9/10 ổn định sau lần đầu. Người dùng chấp nhận rủi ro sau khi xem bằng chứng |
| 4 | **`lowlight` dùng `common`** (~35 ngôn ngữ), không phải `all` | `all` tốn **+296 KB gzip**, `common` chỉ +51 KB. Editor code đã có 6 grammar CodeMirror riêng |
| 5 | **Diff/accept: nội tuyến, per-hunk** kiểu Cursor | Thay `DiffView` cửa sổ riêng đã build. Dùng `unifiedMergeView({ mergeControls: true })` trên chính buffer đang mở |
| 6 | **Collaboration: 2 người qua Cloudflare tunnel** | Không phải "nhiều tab cùng máy". Có DNS, username/pass, allow-list đúng 2 người. Toàn bộ cấu hình trong Settings |
| 7 | **`dsh.bundle.patch` thay deploy script** | Làm **trước tiên** |
| 8 | Bổ sung: **SCM panel**, **preview ảnh / CSV / HTML** | |
| 9 | `Ctrl+Shift+P` Command Palette | Hoãn — chưa rõ tập lệnh |

### Suy ra, không cần quyết thêm

- **`Ctrl+K` inline AI dùng chung cơ chế per-hunk** với sửa đổi của agent. Một mô hình accept
  duy nhất cho mọi thay đổi do AI tạo ra.
- **`@` mention chỉ cần đăng ký một `InputTriggerSource`** — upstream `dsh-client-ui-input-trigger`
  đã có sẵn toàn bộ pipeline (bắt `/` và `@`, menu nhóm, điều phối bàn phím, fetch chống đè).
- **Markdown là bản gốc, không phải ProseMirror JSON.** Bắt buộc: mục tiêu #3 là AI đọc/sửa file;
  lưu JSON thì AI nhận cục dữ liệu không đọc được và file mất tính di động.
- **Host nghe `tools/result`** để biết agent vừa ghi file nào — không poll mtime. Upstream đã có
  tiền lệ (`agent-instructions` dùng đúng hook này cho AGENTS.md on-touch).

---

## 2. Bằng chứng: TipTap round-trip

Đo thật bằng TipTap headless (jsdom) + `tiptap-markdown`, 10 mẫu markdown thực tế.

**Lượt 1 — nhập file từ ngoài: 10/10 biến dạng.** Hai trường hợp là *mất dữ liệu*, không phải
đổi định dạng:

| Vào | Ra |
|---|---|
| `<div align="center">…</div>` | **`""` — xoá sạch** |
| front-matter `---\ntitle: X\n---` | `---\n## title: X` — **phá front-matter** |
| `[docs][1]` + `[1]: url` | `[docs](url)` — bỏ định nghĩa |
| `\| :--- \| ---: \|` | `\| --- \| --- \|` — mất căn cột |
| `text[^1]` | `text\[^1\]` — footnote thành chữ thường |

**Lượt 2 — sau lần chuyển đổi đầu: 9/10 ổn định.** Biến dạng xảy ra một lần rồi dừng.

**Một lỗi phải sửa bất kể lựa chọn:** list lồng + code fence **tiếp tục trôi** — mỗi lần lưu chèn
thêm một dòng trống. Đây là mục ruỗng file, không phải đánh đổi thiết kế. Chặn ở tầng serializer.

---

## 3. Ngân sách bundle

| | gzip |
|---|---|
| Hiện tại (frame + explorer + workbench + CodeMirror) | 366 KB |
| \+ TipTap đầy đủ extension | +199 KB |
| \+ lowlight `common` | +51 KB |
| \+ Yjs / collaboration (ước lượng) | ~+70 KB |
| **Dự kiến** | **~690 KB** |

Số của TipTap đo standalone nên có thể lệch — **phải đo lại trên bundle thật** khi ghép vào.
Bài học từ CodeMirror: ước lượng standalone hụt 40% so với thực tế.

---

## 4. Thứ tự triển khai

1. ✅ **`dsh.bundle.patch`** — thay `deploy-vscode-notion-layout.mjs`
2. ✅ **TipTap Notion Suite** — slash menu đầy đủ, bubble menu, bảng tương tác, callout, task list,
   code block, ảnh, YouTube, divider, quote; auto-save 1.5s
3. ✅ **Diff per-hunk nội tuyến** — `unifiedMergeView({ mergeControls: true })` trực tiếp trên buffer; thanh banner điều khiển thay `DiffView` cửa sổ tách rời
4. ✅ **Overlays + phím tắt** — `Ctrl+K` inline AI, Quick Open `Ctrl+P`, Command Palette `Ctrl+Shift+P`, Toast system, `@` smart selection mention, phím tắt toàn cục
5. ✅ **Preview** — Image (zoom & dimensions), CSV/TSV (interactive searchable table grid), HTML (sandboxed live preview)
6. ✅ **SCM panel** — Source Control Management với staged/unstaged changes, 1-click stage/unstage/discard, branch indicator & commit
7. ✅ **Collaboration** — Cloudflare tunnel, password workspace auth 2 người (Lucas/Lona/custom), Yjs real-time collaborative syncing

---

## 5. Chi tiết #1: `dsh.bundle.patch`

Học từ `.ref/dsh-IDE`. Hiện `deploy-vscode-notion-layout.mjs` **dùng regex sửa file cấu hình của
người dùng**:

```js
patchYaml = patchYaml.replace(/- id: ui-layout[\s\S]*?name: '@anoslide\/dsh-host-files'/g, '')
```

cộng với copy thủ công vào `~/.dsh/profiles/web/node_modules/`. Cùng một bệnh với build script
208 KB, chỉ ở chỗ khác.

Cách chính thức: package tự mang `cordis.patch.yml`, khai báo trong `package.json`:

```json
"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
```

### ✅ Đã xong

Cơ chế đã kiểm chứng trên profile nháp: `dsh plugin --profile <name> add link:<dir>` cài package
**và tự thêm vào `dsh.profile.bundles`**. `apps/cli/src/plugin.ts` (`reconcilePlugins`) dò package
nào khai báo `dsh.bundle` rồi thêm/gỡ tương ứng — kể cả đường gỡ, thứ script cũ hoàn toàn không có.

Đã làm:

- Mỗi package tự mang `cordis.patch.yml` + khai báo `dsh.bundle.patch`. Client patch tắt
  `ui-layout` và chèn row của nó; host patch chèn row của host. Tách rời để mỗi nửa cài được độc lập.
- `dsh-host-files` khai báo `dependencies` thật (`yjs`, `ws`, `y-protocols`, `lib0`) — trước đây
  không khai báo nên script cũ phải **copy tay từng thư mục**.
- `deploy-vscode-notion-layout.mjs` (88 dòng regex + copy đệ quy) → `deploy.mjs` (~50 dòng, gần
  như chỉ gọi `dsh plugin add`).
- **File `cordis.patch.yml` của người dùng không còn bị đụng vào.**

### ⚠️ Bước bắt buộc khi nâng cấp

Profile hiện tại vẫn còn các dòng do script cũ ghi vào `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- id: ui-layout
  disabled: true
- insert:
    - id: ui-layout-vscode
      name: '@anoslide/dsh-client-vscode-layout'
    - id: vscode-host-files
      name: '@anoslide/dsh-host-files'
```

**Phải xoá khối này trước khi cài kiểu mới**, nếu không id `vscode-host-files` xuất hiện hai lần
(một từ bundle layer, một từ patch của người dùng) → *duplicate loader entry id*, boot hỏng.
Repo tham chiếu `.ref/dsh-IDE` cũng vấp đúng chỗ này và phải ghi cảnh báo trong README của họ.
