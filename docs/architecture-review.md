# Architecture Review — tại sao code hiện tại "chắp vá", và chuẩn upstream là gì

Reference đã clone: `.ref/deepseek-harness` @ `47f943859b` (chính là bản `dsh` đang chạy trên máy —
`dsh` → `/home/minhdn3/deepseek-harness/apps/cli/lib/bin.js`).

---

## 1. Chẩn đoán: ta đang code sai *tầng*

Bằng chứng cụ thể:

| File | Kích thước | Bản chất |
|---|---|---|
| `plugins/dsh-client-vscode-layout/lib/client.base.js` | 87 KB | **Bản build đã compile** của upstream `ui-layout`, bị sửa tay |
| `build-unified-vscode-layout.mjs` | 208 KB | 40 lệnh `.replace()` vá regex + ~200 KB code React/CSS nhét trong template literal |
| `plugins/dsh-client-vscode-layout/lib/client.js` | 2.9 MB | Artifact sinh ra, **commit vào git** |

`client.base.js` mở đầu bằng `window.__ModuleLoader__.load({ id, factory: (require) => ... })`.
Đối chiếu `.ref/deepseek-harness/packages/client/ui-layout/lib/client.js` — **y hệt cấu trúc**.
Đó là *output* của bundler `tsdown`, không phải thứ để viết tay. Ta đang lấy file compiled làm source.

Hệ quả dây chuyền:

- **200 KB code sống trong backtick** → không syntax highlight, không lint, không typecheck, không format.
  Lỗi cú pháp chỉ lộ ra lúc chạy trong browser.
- **Escaping hell**: `\\n`, backtick lồng, `${}` phải né thủ công.
- **40 regex anchor giòn**: upstream đổi một dấu cách trong `client.base.js` là patch im lặng không khớp,
  build vẫn "thành công", tính năng biến mất.
- **Dịch UI bằng 20+ lệnh replace chuỗi literal** (`'label: () => "全局人设"'` → `"Global Persona"`)
  thay vì dùng hệ i18n có sẵn.
- **Artifact 2.9 MB trong git** → mọi lần build là một diff khổng lồ, review vô nghĩa, merge conflict chắc chắn.

Đây không phải "code xấu" — đây là **sai tầng kiến trúc**. Sửa bằng cách dọn dẹp từng chỗ sẽ không hết.

---

## 2. Chuẩn upstream: một plugin UI trông như thế nào

Mẫu tham chiếu: `.ref/deepseek-harness/packages/client/ui-workspace/`

```
ui-workspace/
├── package.json              # dsh.client: { inject: [...], platform: 'web' }
│                             # exports: { "./client": "./lib/client.js" }
├── tsdown.config.ts          # clientBundle(...) → sinh ra lib/client.js
├── tsconfig.json
├── src/
│   ├── index.ts              # nửa Node (host). Plugin thuần UI → apply() rỗng
│   ├── css-modules.d.ts
│   └── client/               # nửa browser
│       ├── index.ts          # apply(ctx) — chỉ chứa các lời gọi ctx.slots.register
│       ├── contract/slots.ts # khai báo slot + kiểu props (declaration merging)
│       ├── stores.ts         # defineStore — state chia sẻ
│       ├── tree.ts           # logic thuần, test được, không React
│       ├── locales.ts        # i18n: { en, zh }
│       ├── WorkspaceBrowser.tsx
│       ├── WorkspaceBrowser.module.css   # CSS Modules, KHÔNG phải chuỗi
│       └── rows/Rows.tsx + Rows.module.css
└── tests/*.client.spec.tsx
```

Điểm mấu chốt: **không ai patch ai cả**. Plugin đăng ký vào "lỗ" (slot) mà plugin khác công bố.

```ts
// ui-workspace/src/client/index.ts — toàn bộ phần đăng ký
export const inject = ['slots', 'sessions', 'workspaces', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces',
      children: { 'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' } },
      store: createWorkspaceViewStore(),
      inject: browserInjected,
      locale: NS,
    },
    WorkspaceBrowser,
  ))
}
```

### Luật bắt buộc (trích `.ref/deepseek-harness/packages/client/AGENTS.md`)

1. **Một API duy nhất**: UI chỉ được ghép qua `ctx.slots.register({ name, children?, store?, inject? }, Component)`.
2. **`children` = khai báo + quyền render**: component chỉ được render đúng những slot mình khai báo.
   Render slot không khai báo → *fail lúc load*, không phải lúc chạy.
3. **Props = giao của 4 "share"**, tất cả đều suy ra tự động:
   `PropsRuntime<K>` & `PropsRenderSlots<S>` & `PropsStore<H>` & inject face.
   Không bao giờ tự tay viết lại một member mà share đã suy ra.
4. **Component không bao giờ thấy `ctx`**. `ctx` chỉ sống trong `apply` và các inject factory.
5. **Data sống có đúng 3 kênh**: owner props → local state → store. Không có kênh thứ tư.
6. **Styling**: CSS Modules + token `--dsw-*` từ `ui-theme`. Cấm màu literal, cấm Tailwind, cấm CSS-in-string.
7. **Export discipline**: `/client` chỉ export `apply` / `inject` / store factory / shared types. Hết.

---

## 3. Bản đồ slot: ta nên cắm vào đâu

Upstream công bố sẵn các lỗ này (trích từ toàn bộ `SlotMap` trong `packages/client`):

| Slot | kind | Ý nghĩa |
|---|---|---|
| `root` | single | Cả khung app — **ui-layout đã chiếm** (AppFrame 3 cột + drag handle) |
| `sidebar` | single | Toàn bộ cột trái |
| `conversation` | single | Toàn bộ cột giữa |
| `details` | single | Cột phải |
| `shell.overlay` | **list** | Lớp nổi toàn khung, click-through — **cộng thêm, không thay thế** |
| `settings.section` | list | Mục trong panel Settings |
| `sidebar.footer.action` | list | Nút ở chân sidebar |
| `conversation.input.left/right/dock/overlay` | list | Quanh ô nhập chat |
| `conversation.session.header.actions` | list | Nút trên header phiên |
| `conversation.chat.node` | keyed | Node nghiệp vụ trong luồng chat |
| `tool.call.toolview` | keyed | Card hiển thị một tool call |

**Phát hiện quan trọng nhất**: `ui-layout` của upstream *đã* làm layout 3 cột có drag handle,
với bộ giải "concession chain" (`.ref/.../ui-layout/src/client/columns.ts`) và các hằng số công khai:

```ts
export const CENTER_MIN = 640
export const SIDEBAR_MIN = 264, SIDEBAR_MAX = 420, SIDEBAR_DEFAULT = 280
export const SIDEBAR_COLLAPSED = 56, SIDEBAR_AUTO_COLLAPSE = 1024
export const DETAILS_MIN = 300, DETAILS_MAX = 520, DETAILS_DEFAULT = 360
```

Ta đang fork nguyên `ui-layout` (và `deploy` set `- id: ui-layout / disabled: true`)
**chỉ để đổi mấy con số này** trong `computeColumns`. Đó là patch #3 trong build script.

---

## 4. Việc chiếm `root` là ĐÚNG — đừng bỏ

Đọc kỹ patch AppFrame (`build-unified-vscode-layout.mjs`, mục 10) mới thấy fork hiện tại
**không vứt plugin gốc, mà bố trí lại chúng**:

```js
sessionSlot: renderSlot("sidebar", { collapsed, width })  // sidebar gốc → 1 tab trong LeftPanel
conversation: renderSlot("conversation", {})              // chat gốc → cột PHẢI
details: detailsSlot                                      // trajectory → tab cột phải
```

Upstream mặc định là trái=sidebar / giữa=chat / phải=details.
Ta muốn trái=explorer / giữa=editor / phải=chat. Việc **đổi chỗ** ấy chỉ occupant của `root`
mới làm được, vì `children` = khai báo = quyền render (luật 2). Nên:

- Chiếm `root` là **hợp lệ và cần thiết**, không phải sai lầm.
- `deploy` chỉ tắt `ui-layout` và giữ `ui-sidebar` / `ui-conversation` — **cũng đã đúng**.
- Cái sai duy nhất: viết nó ở **tầng build artifact** thay vì **tầng source**.

### Ánh xạ tính năng → cấu trúc source

| Tính năng | Hiện tại | Nên là |
|---|---|---|
| Bộ giải cột 3 | vá `computeColumns` bằng regex | `src/client/columns.ts` — hàm thuần, unit test được |
| Khung 3 cột + drag | vá `AppFrame` bằng regex | `src/client/AppFrame.tsx` + `.module.css`, `register('root')` |
| Explorer / Search / Quests | vá `LeftPanel` | `src/client/explorer/` — render `sidebar` slot làm 1 tab |
| Editor đa tab + TipTap | vá `EditorArea` | `src/client/workbench/`, `src/client/tiptap/` |
| Chat + trajectory cột phải | vá `RightPanel` | `src/client/RightPanel.tsx` render `conversation` + `details` |
| Toast, Command Palette, Quick Open, modal | nhét thẳng vào AppFrame | `src/client/overlays/` + khai báo `shell.overlay` (list) |
| Global Persona | đã dùng `settings.section` ✓ | giữ nguyên, chuyển sang `.tsx` |
| Dịch UI sang tiếng Anh | 20+ `.replace()` chuỗi | `src/client/locales.ts` + `ctx.locale.register` |
| CSS | chuỗi template 200 KB | `*.module.css` + token `--dsw-*` |

Id plugin gốc tra ở `.ref/deepseek-harness/packages/bundle/web-app/cordis.patch.yml`
(`ui-layout` :180, `ui-sidebar` :183, `ui-conversation` :198, `ui-workspace` :219).

---

## 5. Kết quả kỳ vọng sau khi chuyển

| | Trước | Sau |
|---|---|---|
| Build script | 208 KB thủ công, 40 regex | `tsdown.config.ts` ~3 dòng |
| `client.base.js` fork | 87 KB | **xoá** |
| Artifact trong git | 2.9 MB | gitignore, sinh khi build |
| Code trong template literal | ~200 KB | 0 |
| Typecheck / lint / format | không có | có toàn bộ |
| Khi upstream nâng cấp | patch im lặng hỏng | slot contract báo lỗi lúc load |
| Test | chỉ Playwright e2e | unit test được từng module thuần |

---

## 6. Tiến độ chuyển đổi

### Đã xong — bộ khung chạy được

| Thành phần | File |
|---|---|
| Preset bundler (khuôn `__ModuleLoader__`, CSS Modules, purity gate) | `build/tsdown.client.ts` |
| Cấu hình TS strict (khớp độ chặt của upstream) | `tsconfig.base.json` |
| Bộ giải cột thuần, có test | `src/client/columns.ts` |
| Khai báo slot + owner props | `src/client/contract/slots.ts` |
| Layout store (`defineStore`) | `src/client/stores.ts` |
| `ctx.layout` service | `src/client/service.ts` |
| Theme presenter | `src/client/theme-presenter.ts` |
| Khung 3 cột + drag handle | `src/client/AppFrame.tsx`, `DragHandle.tsx` |
| Cột phải 2 tab (chat / trajectory) | `src/client/RightColumn.tsx` |
| Đăng ký plugin | `src/client/index.ts` |

Kiểm chứng: `npm run typecheck` sạch, `npm run build:layout` ra `lib/client.js` 23.6 kB
đúng khuôn `window.__ModuleLoader__.load(...)` và chỉ `require` platform module
(`react`, `react/jsx-runtime`, `@deepseek-ai/dsh-client-runtime/client`).
`npm run test:unit` — 10/10 pass.

> ⚠️ **Chưa deploy được.** Bộ khung mới chưa có explorer / editor / TipTap / overlay,
> nên `npm run deploy` lúc này sẽ là một bước lùi so với bản đang chạy.
> Bản cũ vẫn build được bằng `npm run build:legacy`.

### Đã xong — mảng Explorer

| Thành phần | File |
|---|---|
| Client HTTP có kiểu cho `/vscode-files/*` | `src/client/explorer/api.ts` |
| Model cây thuần (thứ tự, thụt lề, git badge rollup) | `src/client/explorer/tree.ts` |
| Sprite 97 icon + tra cứu thuần | `src/client/explorer/icons/` |
| Cây file: lazy load, rename/tạo inline, F2, badge | `src/client/explorer/FileTree.tsx` |
| Context menu (fixed, tự lật trong viewport) | `src/client/explorer/ContextMenu.tsx` |
| Hộp thoại xác nhận Trash | `src/client/explorer/ConfirmDialog.tsx` |
| Tìm nội dung: debounce, abort, Aa / `.*` | `src/client/explorer/SearchPanel.tsx` |
| Cột trái 3 tab + toolbar + footer | `src/client/explorer/ExplorerPanel.tsx` |

Kiểm chứng: typecheck sạch, `test:unit` 27/27 pass, bundle 155.97 kB
(72 kB trong đó là dữ liệu sprite icon), 7 stylesheet, externals vẫn chỉ 3 platform module.

#### Lỗi tìm được khi rà lại (đã sửa)

| # | Lỗi | Hậu quả |
|---|---|---|
| 1 | Escape khi rename/tạo vẫn commit — Escape unmount input, browser bắn `blur` trên đường ra, chạy đúng handler của lần render cuối | Nhấn Escape mà file vẫn bị tạo / đổi tên |
| 2 | Latch chống commit đúp làm commit thất bại không thử lại được | Trùng tên → sửa xong Enter không ăn |
| 3 | `flatten` đệ quy bằng path thô, `listings` lại key theo path đã `normalize()` | Windows: mọi cây con không mở được. Linux không lộ |
| 4 | Thông báo footer lặp lại không gia hạn (React bail out khi set cùng chuỗi) | Thông báo thứ hai biến mất sớm |
| 5 | Comment nói search "abortable" nhưng chỉ có generation guard | Host tiếp tục grep toàn cây cho truy vấn đã bỏ |
| 6 | `loadDir` gọi bên trong `setExpanded` updater | StrictMode gọi updater 2 lần → fetch đúp ở dev |
| 7 | Commit bằng blur mà thất bại thì input mất focus | Phải bấm lại mới gõ sửa được |
| 8 | `ExplorerPanel` `return null` khi thu gọn | Unmount subtree của plugin khác → mất state, fetch lại mỗi lần collapse |

(1)(2) sửa bằng một latch có khả năng tự nạp lại: mỗi lần lỗi là một object riêng
(`{ message, attempt }`), nên lặp lại cùng thông báo vẫn nạp lại được latch.
(3) sửa bằng cách chuẩn hoá tại mọi biên trong `flatten`, kèm test hồi quy path Windows.
(5) sửa thật: `searchContent` nhận `AbortSignal`, panel huỷ lượt cũ trước khi chạy lượt mới
và huỷ khi unmount.

Vài quyết định đáng ghi:

- **`ctx.sessions` không có `.current`.** Ảnh chụp hiện tại nằm ở
  `ctx.sessions.list.getSnapshot().current`. Đọc snapshot trong event handler là hợp lệ;
  chỉ *render* mới bắt buộc đi qua framework hook.
- **"Ask AI" đi qua kênh thật**: `inject` dựng callback từ `ctx`, gọi
  `ISession.prompt([...], 'queue')`. Component không bao giờ thấy `ctx`.
- **Seam trái ⟷ giữa**: `activePath` / `activeLine` nằm trong store của frame, vì cả hai cột
  cùng đọc. Mảng editor sẽ mở rộng thành danh sách tab.
- **Cột trái thu gọn thì *ẩn*, không unmount** — tab Sessions chứa subtree của plugin khác,
  unmount là mất state và fetch lại mỗi lần thu gọn.

### Đã xong — mảng Workbench

#### Nghiên cứu trước khi viết

Editor cũ (`build-unified-vscode-layout.mjs` mục 7) hoá ra là `<textarea>` thuần:
**không** highlight khi gõ, undo/redo tự cuộn tay (`historyStateRef.current[path] = {past, future}`),
và state hiện tại được **đọc ngược ra từ DOM** bằng
`document.querySelector('.ProseMirror, .vk_tiptap_container')?.innerText` ở 3 chỗ.

Endpoint Shiki `/vscode-files/highlight` chỉ highlight **file trên đĩa**, nên về nguyên tắc
không dùng được cho buffer đang sửa — README ghi "syntax highlighting" là nói về chế độ *xem*.

Upstream không dùng CodeMirror hay Monaco ở đâu cả, nên không có tiền lệ để theo.
Web app nói chung dùng **CodeMirror 6**. Đo thật bằng esbuild:

| | gzip |
|---|---|
| Core (state, view, commands, search, language) | 98 KB |
| \+ merge + 6 ngôn ngữ (js/ts, md, py, html, css, json) | **209 KB** |

Chấp nhận được: bản cũ là 2.9 MB.

#### Quyết định kiến trúc

**CodeMirror giữ document, React chỉ giữ metadata.** `BufferRegistry` là class thuần
(không React, không DOM) giữ một `EditorState` cho mỗi tab. Hệ quả: đổi tab giữ nguyên
**cả lịch sử undo lẫn vị trí con trỏ** của từng tab — bản cũ không làm được — và triệt tiêu
hẳn kiểu đọc state qua `querySelector`.

Dirty so sánh bằng `doc.eq()` trên rope của CodeMirror chứ không phải `toString()`:
rope short-circuit trên cấu trúc dùng chung nên rẻ ở mọi phím gõ.

#### Đã xong

| Thành phần | File |
|---|---|
| Lớp UI dùng chung (ContextMenu + Dialog N nút) | `src/client/ui/` |
| API file dùng chung (thêm `read` / `write`) | `src/client/api/files.ts` |
| Model tab thuần | `src/client/workbench/model/tabs.ts` |
| Path → grammar + tên ngôn ngữ | `src/client/workbench/language.ts` |
| Registry buffer | `src/client/workbench/buffers.ts` |

Test: 66/66 pass (columns 10, tree 18, tabs 20, buffers 18).

#### Kích thước thật, và vì sao không trim grammar

Ước lượng ban đầu 209 KB gzip là **sai** — nó đo từng gói standalone, nên mỗi gói tự gánh
phần lõi dùng chung và cộng lại thì thừa rất nhiều. Bundle thật: **366 KB gzip** (1.33 MB raw),
trong đó ~47 KB là code của mình + sprite icon.

Đo thử trim trên bundle thật:

| Bundle | gzip |
|---|---|
| Cả 6 grammar | 366 KB |
| Bỏ HTML + CSS | 365 KB |
| Bỏ thêm Python | 345 KB |
| Chỉ Markdown + JSON | 345 KB |

Bỏ HTML + CSS tiết kiệm đúng 1 KB, vì:

```
@codemirror/lang-markdown → @codemirror/lang-html → lang-javascript, lang-css
```

Markdown cho nhúng HTML và code fence nên grammar của nó kéo theo cả ba. Chúng đã nằm trong
bundle bất kể ta khai báo hay không. Markdown thì không bỏ được — nó là định dạng trung tâm
của sản phẩm. **Kết luận: giữ cả 6.**

#### Đã xong

| Thành phần | File |
|---|---|
| Theme + màu cú pháp (toàn `var(--…)`) | `src/client/workbench/theme.ts` |
| Host CodeMirror | `src/client/workbench/CodeEditor.tsx` |
| Tab strip: kéo thả, dirty dot, context menu | `src/client/workbench/TabStrip.tsx` |
| Breadcrumb điều hướng được | `src/client/workbench/Breadcrumb.tsx` |
| Status bar: branch, Ln/Col, đếm, ngôn ngữ, auto-save, diff | `src/client/workbench/StatusBar.tsx` |
| Diff hợp nhất so với đĩa | `src/client/workbench/DiffView.tsx` |
| Điều phối + hộp thoại Unsaved 3 nút | `src/client/workbench/Workbench.tsx` |

Host cũng được sửa: `git status` thêm `--branch` để status bar có branch thật
(xử lý cả detached HEAD) — trước đó chỗ này là stub luôn trả `undefined`.

#### Lỗi tìm được khi rà lại (đã sửa)

| # | Lỗi | Hậu quả |
|---|---|---|
| 1 | Đua `load`/`forget`/`reload` qua map `#loading` | Đóng tab lúc đang đọc rồi mở lại → **tab trống vĩnh viễn** |
| 2 | `discard` tìm view bằng `document.querySelector` + `findFromDOM` | Đúng kiểu chắp vá vừa loại bỏ; đổi sang ref |
| 3 | `currentBranch` là stub trả `undefined` | Status bar hứa branch nhưng không bao giờ có |
| 4 | Dùng `dispatch` (API cũ) thay vì `dispatchTransactions` | Buộc transaction chạy từng cái, vỡ extension gom nhóm |

**Ngoài phạm vi mảng này** (để đúng vai): TipTap WYSIWYG, Command Palette / Quick Open /
toast, và thẻ AI `Ctrl+K` — cả ba thuộc hai mốc sau.

### Còn lại — port theo từng mảng

| Mảng | Nguồn trong `build-unified-vscode-layout.mjs` | Đích |
|---|---|---|
| TipTap Notion suite | mục 4 (`tiptapBundle` + toolbar) | `src/client/tiptap/` |
| Command Palette, Quick Open, modal, toast | mục 10 (`newAppFrameReturn`) | `src/client/overlays/` → `shell.overlay` |
| Chuỗi tiếng Anh | mục 6, 11 (20+ `.replace`) | `src/client/locales.ts` |
| Global Persona | mục 11 (`PersonaSection`) | `src/client/settings/` |

`build-unified-vscode-layout.mjs` và `lib/client.base.js` giữ nguyên cho tới khi đủ parity —
`npm run build:legacy` vẫn phải dựng được bản đang chạy. Xoá cả hai trong một lần, khi
bản mới deploy được.
