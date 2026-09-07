# OpenKnowledge Architecture & UI/UX Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển giao và tích hợp toàn bộ các giải pháp kiến trúc lõi (Core AST Pipeline, Dual-mode position & undo resolver, 5-branch clipboard, managed rename rewrite) và tinh hoa hiển thị UI/UX (3-column Named CSS Grid, Gutter Notion controls, 15 Callouts gập/mở, Table drag reorder, Codeblock sandbox preview, Image zoom, Wiki-links & 2D Knowledge Graph, Excalidraw, Rendered Diff) từ `ref/open-knowledge` sang `deepseek-harness-plugins` với chất lượng chuẩn công nghiệp.

**Architecture:** Áp dụng mô hình Clean Architecture & Modularity để bóc tách các giải pháp xuất sắc từ `ref/open-knowledge`, chuẩn hóa theo hệ thống TipTap 3.30 + CodeMirror 6 + React 18 + CSS Modules của DeepSeek Harness. Đảm bảo zero regression trên toàn bộ 241 unit tests hiện tại, đóng gói tự động qua `tsdown` bundle, và mỗi giai đoạn đều có test kiểm chứng độc lập.

**Tech Stack:** TypeScript 5.9, React 18, TipTap 3.30, ProseMirror, CodeMirror 6, @floating-ui/dom, KaTeX, Mermaid 11.16, react-medium-image-zoom, react-force-graph-2d, @excalidraw/excalidraw, tsdown (Rolldown), Node.js / pnpm.

## Global Constraints

- Không được làm gãy hoặc vô hiệu hóa bất kỳ test nào trong số 241 unit tests hiện có (`npm run test:unit`).
- Bundle đầu ra của `@anoslide/dsh-client-vscode-layout` (`lib/client.js`) phải build sạch sẽ qua `npm run build` không lỗi TypeScript.
- Không copy-paste bừa bãi mã GPL; phải đọc hiểu thuật toán của `ref/open-knowledge`, thiết kế lại phù hợp với context của `deepseek-harness-plugins`, và đặt tên/cấu trúc file nhất quán.
- Giữ vững tính năng `Fixed-point Normalization` và tương thích ngược với format Markdown chuẩn của DeepSeek Harness.

---

### Task 1: Thay thế Bộ Serializer Markdown Bằng Pipeline AST Thuần (Core Engine)

**Files:**
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/markdown/pipeline.ts`
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/markdown/promoters.ts`
- Modify: `plugins/dsh-client-vscode-layout/src/client/tiptap/markdown.ts`
- Test: `plugins/dsh-client-vscode-layout/tests/markdown-ast-pipeline.test.ts`

**Tham khảo mã nguồn gốc:**
- `ref/open-knowledge/packages/core/src/markdown/pipeline.ts`
- `ref/open-knowledge/packages/core/src/markdown/void-br-promoter.ts`
- `ref/open-knowledge/packages/core/src/markdown/callout-transformer.ts`
- `ref/open-knowledge/packages/core/src/markdown/single-dollar-math-promoter.ts`
- `ref/open-knowledge/packages/core/src/markdown/details-accordion-promoter.ts`

**Đọc lại mã nguồn hiện tại:**
- `plugins/dsh-client-vscode-layout/src/client/tiptap/markdown.ts:70-98` (Hàm `stabilize` lặp 8 lần trên headless editor).

**Hướng thay đổi:**
- Loại bỏ vòng lặp 8-pass headless editor trong `stabilize()`.
- Xây dựng `pipeline.ts` và các promoters xử lý AST trực tiếp trong RAM:
  1. `voidBrPromoter`: biến các thẻ `<br />` thành ngắt dòng markdown hợp lệ.
  2. `calloutTransformer`: chuẩn hoá GitHub Alert tags.
  3. `singleDollarMathPromoter`: bảo toàn `$math$` và `$$block$$`.
  4. `detailsAccordionPromoter`: bảo toàn `<details><summary>` toggle list.
- Giảm thời gian serialize từ ~80ms xuống <5ms, triệt tiêu hoàn toàn cảnh báo `[vscode-layout] markdown did not reach a stable form`.

- [ ] **Step 1: Viết test case kiểm chứng AST pipeline không sinh diff rác**
  Tạo `tests/markdown-ast-pipeline.test.ts` với các trường hợp phức tạp: nested list chứa code block, công thức toán LaTeX, callout gập, bảng rỗng, và kiểm tra round-trip 1 pass duy nhất.
- [ ] **Step 2: Chạy test để xác nhận test fail**
  Chạy `npx tsx --test plugins/dsh-client-vscode-layout/tests/markdown-ast-pipeline.test.ts`
- [ ] **Step 3: Triển khai `promoters.ts` và `pipeline.ts`**
  Port các heuristics xử lý thẻ ngắt dòng, toán học, callout và khoảng trắng từ `ref/open-knowledge` sang TypeScript module sạch.
- [ ] **Step 4: Cập nhật `markdown.ts` để sử dụng AST pipeline**
  Thay thế logic trong `serializeStable()` và `cleanMarkdown()`.
- [ ] **Step 5: Chạy test và xác nhận 100% test pass**
  Chạy `npm run test:unit` và xác nhận toàn bộ 241 test cũ + test mới đều PASS.
- [ ] **Step 6: Commit**
  `git commit -m "feat(markdown): replace 8-pass headless stabilizer with pure AST normalizer pipeline"`

---

### Task 2: Layout Lưới 3 Cột (Named CSS Grid) & Gutter Controls Chuẩn Notion

**Files:**
- Modify: `plugins/dsh-client-vscode-layout/src/client/tiptap/TipTapEditor.module.css`
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/dragHandle/GutterControls.tsx`
- Modify: `plugins/dsh-client-vscode-layout/src/client/tiptap/TipTapEditor.tsx`
- Test: `plugins/dsh-client-vscode-layout/tests/gutter-controls.test.ts`

**Tham khảo mã nguồn gốc:**
- `ref/open-knowledge/packages/app/src/globals.css:1014-1065` (CSS Grid 3 cột & `--ask-composer-height` scroller inset)
- `ref/open-knowledge/packages/app/src/editor/extensions/drag-handle.ts` (Nút `+` và nút `⋮⋮`)

**Đọc lại mã nguồn hiện tại:**
- `plugins/dsh-client-vscode-layout/src/client/tiptap/TipTapEditor.module.css` (Container flex/block đơn giản).
- `plugins/dsh-client-vscode-layout/src/client/tiptap/dragHandle/` (Drag handle thô sơ).

**Hướng thay đổi:**
- Áp dụng cấu trúc 3-Column Named CSS Grid:
  - Cột `content` max 1024px cho văn bản thường.
  - Cột `full` cho bảng lớn, sơ đồ Mermaid, codeblock bung tràn lề (breakout).
  - Tự động cộng `--ask-composer-height` vào `padding-bottom` của scroller để chống che chữ.
- Thêm cụm điều khiển Gutter Controls:
  - Nút `+`: Hover lề trái hiện nút `+`. Click vào tạo đoạn văn mới và gõ ngay `/` mở Slash Menu.
  - Nút `⋮⋮`: Kéo thả chuột di chuyển nguyên block kèm vạch dẫn hướng phát sáng.

- [ ] **Step 1: Viết test cho Gutter Controls và CSS Grid tokens**
- [ ] **Step 2: Cập nhật `TipTapEditor.module.css` với Named CSS Grid và dynamic bottom padding**
- [ ] **Step 3: Triển khai `GutterControls.tsx` kết hợp nút `+` và `DragHandle`**
- [ ] **Step 4: Tích hợp vào `TipTapEditor.tsx`**
- [ ] **Step 5: Kiểm tra build và chạy unit test**
- [ ] **Step 6: Commit**
  `git commit -m "feat(ui): implement 3-column named CSS grid and Notion-style gutter controls"`

---

### Task 3: Nâng Cấp Hệ Thống Callout 15 Loại (Collapsible & Custom Icons)

**Files:**
- Modify: `plugins/dsh-client-vscode-layout/src/client/tiptap/Callout.ts`
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/callouts/CalloutComponent.tsx`
- Modify: `plugins/dsh-client-vscode-layout/src/client/tiptap/callouts/Callout.module.css`
- Test: `plugins/dsh-client-vscode-layout/tests/callout-extended.test.ts`

**Tham khảo mã nguồn gốc:**
- `ref/open-knowledge/packages/app/src/editor/components/Callout.tsx`
- `ref/open-knowledge/packages/core/src/markdown/callout-transformer.ts`

**Đọc lại mã nguồn hiện tại:**
- `plugins/dsh-client-vscode-layout/src/client/tiptap/Callout.ts` (Mới có 5 alert GitHub cứng).

**Hướng thay đổi:**
- Mở rộng enum `type` hỗ trợ 15 loại callout (Note, Tip, Important, Warning, Caution, Abstract, Info, Todo, Success, Question, Failure, Danger, Bug, Example, Quote).
- Hỗ trợ thuộc tính `collapsible`: click tiêu đề để gập/mở bằng thẻ HTML5 `<details><summary>`.
- Hỗ trợ màu tùy biến (`color`) và icon tùy biến (`icon`).

- [ ] **Step 1: Viết test kiểm tra 15 loại callout và khả năng parse/render `<details>`**
- [ ] **Step 2: Cập nhật schema `Callout.ts` hỗ trợ 15 loại, `collapsible`, `color`, `icon`**
- [ ] **Step 3: Tạo `CalloutComponent.tsx` với giao diện bo góc, vệt sáng bên trái và icon Lucide**
- [ ] **Step 4: Cập nhật CSS module cho Callout**
- [ ] **Step 5: Chạy unit tests và kiểm tra build**
- [ ] **Step 6: Commit**
  `git commit -m "feat(callout): expand to 15 Obsidian/GFM callout types with collapsible support"`

---

### Task 4: Bộ Điều Hướng Clipboard 5 Nhánh & Lone-URL Linkify

**Files:**
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/clipboard/handlePaste.ts`
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/clipboard/loneUrl.ts`
- Modify: `plugins/dsh-client-vscode-layout/src/client/tiptap/TipTapEditor.tsx`
- Test: `plugins/dsh-client-vscode-layout/tests/clipboard-paste.test.ts`

**Tham khảo mã nguồn gốc:**
- `ref/open-knowledge/packages/app/src/editor/clipboard/handle-paste.ts`
- `ref/open-knowledge/packages/app/src/editor/clipboard/lone-url.ts`

**Đọc lại mã nguồn hiện tại:**
- `plugins/dsh-client-vscode-layout/src/client/tiptap/TipTapEditor.tsx` (Paste mặc định của TipTap).

**Hướng thay đổi:**
- Triển khai bộ phân nhánh 5 hướng:
  - Branch A: `vscode-editor-data` -> parse thành codeblock có ngôn ngữ.
  - Branch B: `text/x-gfm` -> parse markdown sạch.
  - Branch C: `data-pm-slice` -> paste giữa các editor ProseMirror.
  - Branch D: generic HTML -> parse qua AST làm sạch style rác.
  - Lone-URL policy: bôi đen chữ và bấm Ctrl+V link -> tự động linkify `[selected](url)`.
  - List-aware splicing: dán vào `<li>` không làm vỡ thụt đầu dòng.

- [ ] **Step 1: Viết test cho Lone-URL linkify và list splicing**
- [ ] **Step 2: Triển khai `loneUrl.ts` và `handlePaste.ts`**
- [ ] **Step 3: Gắn plugin clipboard vào TipTapEditor**
- [ ] **Step 4: Chạy test và verify**
- [ ] **Step 5: Commit**
  `git commit -m "feat(clipboard): implement 5-branch paste router and lone-URL selection linkify"`

---

### Task 5: Bộ Điều Hướng Chuyển Đổi Dual-Mode (Position Resolver & Undo Sync)

**Files:**
- Create: `plugins/dsh-client-vscode-layout/src/client/workbench/modeSwitchPositionResolver.ts`
- Create: `plugins/dsh-client-vscode-layout/src/client/workbench/sourceUndoModeFlip.ts`
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/bubble/ViewInSourceBubbleButton.tsx`
- Modify: `plugins/dsh-client-vscode-layout/src/client/workbench/Workbench.tsx`
- Test: `plugins/dsh-client-vscode-layout/tests/mode-switch-resolver.test.ts`

**Tham khảo mã nguồn gốc:**
- `ref/open-knowledge/packages/app/src/editor/mode-switch-position-resolver.ts`
- `ref/open-knowledge/packages/app/src/editor/source-undo-mode-flip.ts`
- `ref/open-knowledge/packages/app/src/editor/bubble-menu/ViewInSourceBubbleButton.tsx`

**Đọc lại mã nguồn hiện tại:**
- `plugins/dsh-client-vscode-layout/src/client/workbench/Workbench.tsx:400-500` (Logic chuyển đổi giữa CodeEditor và TipTap).

**Hướng thay đổi:**
- Tạo `BlockAnchor`: bắt vị trí dòng/khối hiện tại khi người dùng đang ở WYSIWYG hoặc Code Mode.
- Khi lật tab, ánh xạ chính xác vị trí con trỏ chuột sang tab đối ứng (`exact` -> `ordinal` -> `clamped`).
- Giữ vững Undo stack của Yjs/CodeMirror để phím `Ctrl+Z` không hoàn tác sai.
- Thêm nút "View in Source" trên thanh Floating Bubble Menu để nhảy tức thì sang dòng markdown thô.

- [ ] **Step 1: Viết test cho BlockAnchor và thuật toán 4 cấp độ tin cậy**
- [ ] **Step 2: Triển khai `modeSwitchPositionResolver.ts`**
- [ ] **Step 3: Triển khai `sourceUndoModeFlip.ts`**
- [ ] **Step 4: Tạo `ViewInSourceBubbleButton.tsx` và gắn vào BubbleMenu**
- [ ] **Step 5: Tích hợp vào `Workbench.tsx`**
- [ ] **Step 6: Chạy test và commit**
  `git commit -m "feat(dual-mode): add cursor position resolver, undo sync, and view-in-source button"`

---

### Task 6: Tương Tác Bảng Kéo Thả & Frozen Header

**Files:**
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/table/TableCellHandles.tsx`
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/table/useTableDragReorder.ts`
- Modify: `plugins/dsh-client-vscode-layout/src/client/tiptap/table/TableControls.tsx`
- Modify: `plugins/dsh-client-vscode-layout/src/client/tiptap/TipTapEditor.module.css`
- Test: `plugins/dsh-client-vscode-layout/tests/table-controls.test.ts`

**Tham khảo mã nguồn gốc:**
- `ref/open-knowledge/packages/app/src/editor/table-controls/TableCellHandles.tsx`
- `ref/open-knowledge/packages/app/src/editor/table-controls/useTableDragReorder.ts`
- `ref/open-knowledge/packages/app/src/editor/extensions/frozen-table-headers.ts`

**Đọc lại mã nguồn hiện tại:**
- `plugins/dsh-client-vscode-layout/src/client/tiptap/TableControls.tsx`

**Hướng thay đổi:**
- Tích hợp nút handle `...` nổi ở đầu cột và đầu hàng bằng `@floating-ui/dom`.
- Hỗ trợ kéo thả chuột (drag & drop) để đổi thứ tự cột và hàng trực tiếp.
- Ghim dính hàng tiêu đề bảng (`frozen-header`) khi cuộn tài liệu dài.

- [ ] **Step 1: Viết test cho logic reorder cột/hàng trong ProseMirror table**
- [ ] **Step 2: Triển khai `useTableDragReorder.ts`**
- [ ] **Step 3: Triển khai `TableCellHandles.tsx`**
- [ ] **Step 4: Cập nhật CSS sticky cho `th` trong `TipTapEditor.module.css`**
- [ ] **Step 5: Chạy test và verify**
- [ ] **Step 6: Commit**
  `git commit -m "feat(table): add floating cell handles, drag reorder, and frozen headers"`

---

### Task 7: Phóng To Ảnh Lightbox Kiểu Medium & Code Block Live Preview

**Files:**
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/image/ImageInlineZoomView.tsx`
- Modify: `plugins/dsh-client-vscode-layout/src/client/tiptap/codeblock/CodeBlockView.tsx`
- Test: `plugins/dsh-client-vscode-layout/tests/media-views.test.ts`

**Tham khảo mã nguồn gốc:**
- `ref/open-knowledge/packages/app/src/editor/extensions/ImageInlineZoomView.tsx`
- `ref/open-knowledge/packages/app/src/editor/extensions/CodeBlockView.tsx`
- `ref/open-knowledge/packages/app/src/editor/extensions/preview-iframe-header.ts`

**Hướng thay đổi:**
- Tích hợp `react-medium-image-zoom` vào NodeView của ảnh để click phóng to full màn hình với nền mờ backdrop.
- CodeBlock: Ẩn thanh header cố định, chuyển sang thanh toolbar nổi khi di chuột (Zero-chrome).
- Thêm nút xem trước (Live Preview) trong iframe sandbox an toàn cho code HTML/SVG/React.

- [ ] **Step 1: Viết test cho NodeView ảnh và codeblock preview**
- [ ] **Step 2: Triển khai `ImageInlineZoomView.tsx`**
- [ ] **Step 3: Nâng cấp `CodeBlockView.tsx` với floating toolbar và Live Preview sandbox**
- [ ] **Step 4: Chạy test và verify**
- [ ] **Step 5: Commit**
  `git commit -m "feat(media): add medium-style image zoom and live code preview sandbox"`

---

### Task 8: Managed Rename Rewrite Engine (Tự Động Sửa Toàn Bộ Link Khi Đổi Tên)

**Files:**
- Create: `plugins/dsh-host-files/src/managedRenameRewrite.ts`
- Modify: `plugins/dsh-host-files/src/index.ts`
- Test: `plugins/dsh-host-files/tests/managed-rename.test.ts`

**Tham khảo mã nguồn gốc:**
- `ref/open-knowledge/packages/server/src/managed-rename-rewrite.ts`

**Đọc lại mã nguồn hiện tại:**
- `plugins/dsh-host-files/` (Service xử lý file trong host).

**Hướng thay đổi:**
- Khi user hoặc AI rename file/folder, hook vào hàm rename để duyệt qua tất cả file `.md` trong workspace.
- Bỏ qua code blocks (`fenceState`), tìm các link `[text](old-path.md)` hoặc `[[old-path]]` và tự động cập nhật sang `new-path.md`.
- Tránh vĩnh viễn tình trạng gãy liên kết (broken links).

- [ ] **Step 1: Viết test cho `managedRenameRewrite` với các cấu trúc link, wiki-link và code fence**
- [ ] **Step 2: Triển khai thuật toán quét và thay thế link an toàn trong `managedRenameRewrite.ts`**
- [ ] **Step 3: Tích hợp vào rename handler của `dsh-host-files`**
- [ ] **Step 4: Chạy test và verify**
- [ ] **Step 5: Commit**
  `git commit -m "feat(files): add managed rename rewrite engine to auto-update links"`

---

### Task 9: Wiki-Links (`[[tài-liệu]]`) & Mạng Lưới Tri Thức 2D Knowledge Graph

**Files:**
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/wikiLink/wikiLink.ts`
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/wikiLink/WikiLinkSuggestion.tsx`
- Create: `plugins/dsh-client-vscode-layout/src/client/workbench/KnowledgeGraphView.tsx`
- Modify: `plugins/dsh-client-vscode-layout/src/client/workbench/Workbench.tsx`
- Test: `plugins/dsh-client-vscode-layout/tests/wiki-link-graph.test.ts`

**Tham khảo mã nguồn gốc:**
- `ref/open-knowledge/packages/core/src/markdown/wiki-link-micromark.ts`
- `ref/open-knowledge/packages/app/src/components/GraphPanel.tsx`
- `ref/open-knowledge/packages/app/src/components/GraphView.tsx`

**Hướng thay đổi:**
- Thêm node extension `wikiLink` cho TipTap, hỗ trợ gõ `[[` hiện danh sách gợi ý file trong workspace.
- Thêm tab xem đồ thị tri thức 2D (Knowledge Graph View) sử dụng `react-force-graph-2d` với 3 chế độ: Khám phá (`Explore`), Trang mồ côi (`Orphans`), Trang trung tâm (`Hubs`).

- [ ] **Step 1: Viết test cho tokenizer `[[wiki-link]]` và đồ thị liên kết**
- [ ] **Step 2: Triển khai TipTap extension `wikiLink.ts` và popup gợi ý `WikiLinkSuggestion.tsx`**
- [ ] **Step 3: Triển khai component `KnowledgeGraphView.tsx`**
- [ ] **Step 4: Thêm nút mở Graph View trên thanh toolbar/sidebar**
- [ ] **Step 5: Chạy test và verify**
- [ ] **Step 6: Commit**
  `git commit -m "feat(pkm): add wiki-links autocomplete and 2D knowledge graph view"`

---

### Task 10: Whiteboard Vẽ Tay Excalidraw & Rendered Visual Diff

**Files:**
- Create: `plugins/dsh-client-vscode-layout/src/client/workbench/previews/ExcalidrawPreview.tsx`
- Create: `plugins/dsh-client-vscode-layout/src/client/tiptap/excalidraw/ExcalidrawEmbed.tsx`
- Create: `plugins/dsh-client-vscode-layout/src/client/workbench/RenderedDiffView.tsx`
- Modify: `plugins/dsh-client-vscode-layout/src/client/workbench/DiffView.tsx`
- Test: `plugins/dsh-client-vscode-layout/tests/excalidraw-rendered-diff.test.ts`

**Tham khảo mã nguồn gốc:**
- `ref/open-knowledge/packages/app/src/components/ExcalidrawDocEditor.tsx`
- `ref/open-knowledge/packages/app/src/editor/components/ExcalidrawEmbed.tsx`
- `ref/open-knowledge/packages/app/src/components/TimelineDiffPane.tsx`
- `ref/open-knowledge/packages/app/src/components/RenderedDiffView.tsx`

**Hướng thay đổi:**
- Hỗ trợ mở file `.excalidraw` trong tab editor với full công cụ vẽ vô cực.
- Cho phép nhúng diagram Excalidraw trực tiếp vào Markdown.
- Rendered Visual Diff: cho phép xem diff trực tiếp trên giao diện văn bản rich format (highlight xanh cho chữ thêm, gạch đỏ cho chữ xóa) bên cạnh diff code thô.

- [ ] **Step 1: Viết test cho Excalidraw document loader và Rendered Diff AST comparator**
- [ ] **Step 2: Triển khai `ExcalidrawPreview.tsx` và `ExcalidrawEmbed.tsx`**
- [ ] **Step 3: Triển khai `RenderedDiffView.tsx` và gắn nút chuyển chế độ Rendered/Source vào DiffView**
- [ ] **Step 4: Chạy test và verify**
- [ ] **Step 5: Commit**
  `git commit -m "feat(visual): add Excalidraw canvas and rendered visual diff view"`

---

### Task 11: Toàn Diện Hóa Kiểm Thử & Tối Ưu Hóa Đóng Gói (Final Verification & Polish)

**Files:**
- Test: Toàn bộ test suite trong `plugins/dsh-client-vscode-layout/tests/`
- Build: `npm run build` và `npm run deploy`

- [ ] **Step 1: Chạy toàn bộ test suite unit test**
  Chạy `npm run test:unit` -> Đảm bảo toàn bộ 241 test cũ và tất cả test mới đều PASS 100%.
- [ ] **Step 2: Chạy kiểm tra đóng gói bundle**
  Chạy `npm run build` -> Đảm bảo TypeScript compilation không lỗi, `tsdown` hoàn thành không warning.
- [ ] **Step 3: Chạy script deploy**
  Chạy `npm run deploy` để cài đặt plugin hoàn chỉnh vào DeepSeek Harness runtime.
- [ ] **Step 4: Commit tổng kết**
  `git commit -m "chore(release): complete full open-knowledge integration suite"`
