# Markdown / TipTap Editor — Bug Audit & Fix Plan

> Tài liệu bàn giao cho agent thực thi. Mỗi ticket có: **triệu chứng → nguyên nhân gốc (file:line) → cách sửa cụ thể → cách kiểm chứng**.
> Làm theo đúng thứ tự P0 → P1 → P2 → P3. Mỗi ticket là 1 commit riêng.
>
> Phạm vi: `plugins/dsh-client-vscode-layout/src/client/` (viết tắt `~/` bên dưới).
>
> **Đã kiểm chứng bằng test thật** (jsdom + `roundTrip()` + `DocumentRegistry`), không phải suy đoán. Snippet test nằm ở cuối tài liệu (mục "Harness kiểm chứng").

---

## Tóm tắt điều hành

Có **3 nhóm lỗi độc lập** gây ra đúng 2 triệu chứng người dùng báo ("sửa xong không lưu được" + "bị miss hiển thị"):

| Nhóm | Bản chất | Ticket |
|---|---|---|
| **A. Round-trip Markdown làm mất dữ liệu** | Serializer không hiểu frontmatter / footnote / reference-link / HTML có text. Bình thường `reconcile.ts` che được, nhưng có **4 nhánh fallback** làm nó lộ ra và phá file. | P0-1 … P0-4 |
| **B. React không subscribe vào editor** | Toolbar, TableControls, word-count, undo/redo đọc `editor.*` lúc render nhưng **không re-render** khi editor đổi. UI đứng hình → cảm giác "không lưu được / mất hiển thị". | P0-5, P1-1 |
| **C. Heading Fold** | Widget bị dựng lại mỗi transaction (mất caret), nội dung bị `display:none` mà ProseMirror vẫn cho caret chui vào (gõ không thấy chữ), range fold tính sai với heading lồng nhau. | P1-2 … P1-6 |

---

# P0 — Mất dữ liệu / không lưu được

## P0-1 · Frontmatter YAML bị phá hủy khi serialize

**Triệu chứng**
- File có `---\ntitle: ...\n---` ở đầu: sau khi lưu, khối YAML biến thành `---`, `## title: ...`, danh sách bullet… hoặc mất luôn dấu `---`.
- Card "🏷️ Frontmatter Metadata" **biến mất** ở lần mở sau (đây chính là "bị miss hiển thị"), vì `parseFrontmatter` dùng regex `^---\r?\n([\s\S]*?)\r?\n---` không còn khớp.
- Đồng thời YAML hiện ra như nội dung body (heading/bullet) → **hiển thị trùng lặp**.

**Nguyên nhân gốc**
`~/tiptap/markdown.ts:111` `roundTrip()` đưa nguyên văn markdown vào TipTap. `documentExtensions()` (`~/tiptap/extensions.ts:103`) **không có extension nào xử lý frontmatter**. CommonMark parse `---\ntitle: X\n---` thành *thematic break* + *setext heading*.

Bằng chứng (đã chạy thật):
```
IN : "---\ntitle: Hello\n---\n\n# H\n"
OUT: "---\n\n## title: Hello\n\n# H"          ← YAML đã chết
IN : "---\ntitle: Hello\ntags:\n  - a\n  - b\n---\n\n# Heading\n\nBody.\n"
OUT: "---\n\ntitle: Hello\ntags:\n\n- a\n- b\n\n---\n\n# Heading\n\nBody."
```

Hiện tại `reconcile.ts` *tình cờ* che được lỗi này ở đường đi "happy path" (vì `baseCanonical` cũng hỏng y hệt nên diff không chạm vùng đó). Nhưng nó lộ ra ngay khi reconcile fallback (xem P0-2).

**Cách sửa** — tách frontmatter ra khỏi tree, giữ nguyên bytes, ghép lại khi serialize.

1. Tạo file mới `~/tiptap/frontmatter/splitFrontmatter.ts`:
```ts
/** Frontmatter is a file-level header, not document content: it must never
 *  reach the ProseMirror parser (CommonMark turns `---` into a thematic break
 *  plus a setext heading and the YAML is destroyed). */
export interface SplitMarkdown {
  /** The frontmatter block INCLUDING both `---` fences and the trailing newline, or ''. */
  frontmatter: string
  /** Everything after it. */
  body: string
}

const FRONTMATTER_RE = /^﻿?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/

export function splitFrontmatter(source: string): SplitMarkdown {
  const match = FRONTMATTER_RE.exec(source)
  if (match === null) return { frontmatter: '', body: source }
  return { frontmatter: match[0], body: source.slice(match[0].length) }
}

/** Re-attach a frontmatter block to serialized body markdown. */
export function joinFrontmatter(frontmatter: string, body: string): string {
  if (frontmatter === '') return body
  // Exactly one blank line between the closing fence and the first block.
  return frontmatter.replace(/\r?\n*$/, '\n') + '\n' + body.replace(/^\r?\n+/, '')
}
```

2. `~/tiptap/markdown.ts` — bọc `roundTrip()` (line 111) để nó **không bao giờ** parse frontmatter:
```ts
import { splitFrontmatter, joinFrontmatter } from './frontmatter/splitFrontmatter.ts'

export function roundTrip(text: string): string {
  const { frontmatter, body } = splitFrontmatter(text)
  const editor = new Editor({
    element: typeof document !== 'undefined' ? document.createElement('div') : null,
    extensions: documentExtensions(),
    content: encodeRawHtmlLines(body),      // ← body, không phải text
    contentType: 'markdown',
  })
  try {
    return joinFrontmatter(frontmatter, markdownOf(editor))
  } finally {
    editor.destroy()
  }
}
```
> ⚠️ `cleanMarkdown()` (line 51) có `.replace(/\n{3,}/g, '\n\n')` — an toàn với frontmatter. Không đổi.

3. `~/tiptap/documents.ts`:
   - Thêm field vào `interface OpenDocument` (sau `source`, line 57):
     ```ts
     /** The file's frontmatter block, kept verbatim and never parsed. */
     frontmatter: string
     ```
   - Trong `open()` (line 163-208), thay:
     ```ts
     const { frontmatter, body } = splitFrontmatter(markdown)
     const editor = new Editor({ ..., content: encodeRawHtmlLines(body), ... })
     ...
     this.#docs.set(path, { editor, diskDoc: ..., source: markdown, frontmatter, baseCanonical: stabilizedRoundTrip(markdown), ... })
     ```
   - Trong `markdown()` (line 312), sau `const edited = serializeStable(doc.editor)`:
     ```ts
     const edited = joinFrontmatter(doc.frontmatter, serializeStable(doc.editor))
     ```
   - Trong `preview()` (line 351):
     ```ts
     return doc === undefined ? undefined : joinFrontmatter(doc.frontmatter, serializeOnce(doc.editor))
     ```
   - Trong `markSaved()` (line 374), cập nhật lại `doc.frontmatter = splitFrontmatter(written).frontmatter`.

**Kiểm chứng**
- Mở file có frontmatter → khối YAML **không** xuất hiện trong canvas nữa, chỉ còn card.
- Sửa 1 chữ, Ctrl+S, mở lại bằng `</> Raw` → frontmatter còn nguyên byte-for-byte.
- Chạy lại harness ở cuối tài liệu: mẫu `frontmatter` phải in `OK`.

---

## P0-2 · Reconcile bỏ cuộc ở file > 50 KB → ghi đè canonical toàn file

**Triệu chứng**
- Với file markdown lớn (rất phổ biến: tài liệu > 50 KB), **mỗi lần lưu là rewrite toàn bộ file**: frontmatter chết, footnote bị escape, HTML bị viết lại, `*` bị thêm `\`. Git diff nổ tung.

**Nguyên nhân gốc**
`~/tiptap/reconcile.ts:36` `RECONCILE_SIZE_CAP_CODE_UNITS = 50_000`. Branch 3 (line 94-104) trả thẳng `restoreEol(editedLf, eol)` = canonical.

Bằng chứng (đã chạy thật, file 106 KB, sửa 1 chữ):
```
[vscode-layout] markdown reconcile: source over 50000 code units, falling back to a full canonical rewrite
frontmatter preserved: false
```

**Cách sửa** (làm cả 3, theo thứ tự)
1. **Nâng trần** — chi phí thật là 1 lần diff + 1 lần re-parse, không phải per-keystroke:
   ```ts
   const RECONCILE_SIZE_CAP_CODE_UNITS = 500_000
   ```
2. **Làm fallback an toàn**: P0-1 đã khiến `edited` luôn mang frontmatter thật → nhánh canonical không còn giết YAML nữa.
3. **Cho người dùng biết** thay vì im lặng. `reconcileSerializedMarkdown` thêm optional callback:
   ```ts
   /** Called when the source-preserving path was abandoned; the save still
    *  happens, but the whole file gets re-canonicalized. */
   onFallback?: (reason: string) => void
   ```
   gọi ở cả 4 nhánh (3, 4, 5, 6) với lý do tương ứng. `documents.markdown()` truyền vào một callback, `Workbench.performSave` hiển thị qua `onNotify(...)`.

**Kiểm chứng**
- Tạo file .md ~150 KB có frontmatter, sửa 1 chữ, lưu → `git diff` chỉ có 1 dòng thay đổi.

---

## P0-3 · Footnote, reference-link, autolink, HTML-có-text bị viết lại

**Triệu chứng** — chỉ lộ ra khi reconcile fallback (P0-2) hoặc khi sửa ngay cạnh vùng đó:

| Input | Output thực tế | Hậu quả |
|---|---|---|
| `Some text[^1]` + `[^1]: note` | `Some text\[^1\]` + `\[^1\]: note` | Footnote chết, escape rác |
| `[label][ref]` + `[ref]: https://x.com` | `[label](https://x.com)` | **Mất hẳn dòng định nghĩa** |
| `<https://example.com>` | `[https://example.com](https://example.com)` | Autolink bị nở |
| `<div>\n  <b>hi</b>\n</div>` | `<div>\n\n  **hi**\n\n</div>` | HTML bị đổi ngữ nghĩa |
| `a * b _ c` | `a \* b \_ c` | Rác escape trên mọi file |

**Nguyên nhân gốc**
`~/tiptap/html/rawHtmlLine.ts:39` `isLineOnlyHtml()` chỉ giữ dòng **thuần tag** (regex `^(?:<\/?[A-Za-z]...>)+$`). `<b>hi</b>` có text ở giữa → không khớp → rơi vào parser HTML mặc định.
Footnote / reference definition thì không có extension nào nhận cả.

**Cách sửa** — mở rộng đúng cơ chế passthrough đã có (`rawHtmlLine.ts`), đừng viết cơ chế mới:

1. Trong `~/tiptap/html/rawHtmlLine.ts`, đổi tên khái niệm thành "opaque line" và thêm 2 pattern vào `encodeRawHtmlLines()` (line 55-90), ngay cạnh `isLineOnlyHtml`:
```ts
/** `[^id]: text` — a footnote definition. CommonMark has no footnotes, so the
 *  parser escapes the brackets and the reference is destroyed. */
const FOOTNOTE_DEF = /^\[\^[^\]]+\]:/
/** `[id]: url "title"` — a link reference definition. The parser inlines the
 *  target into every use and then drops this line entirely. */
const LINK_REF_DEF = /^\[[^\]^]+\]:\s*\S/

function isOpaqueLine(trimmed: string): boolean {
  return isLineOnlyHtml(trimmed) || FOOTNOTE_DEF.test(trimmed) || LINK_REF_DEF.test(trimmed)
}
```
   rồi thay `!isLineOnlyHtml(trimmed)` (line 81) bằng `!isOpaqueLine(trimmed)`.

> ⚠️ **Chỉ như vậy chưa đủ cho `[^1]` inline** (chỗ *dùng* footnote trong câu). Việc đó cần một inline mark riêng — ghi thành ticket riêng, ĐỪNG cố nhét vào đây. Trước mắt hãy chấp nhận `\[^1\]` cho inline và ghi vào `docs/`.

2. `<b>hi</b>` có text: **không sửa** trong ticket này (rủi ro cao, phải mở rộng regex thành matched-pair scanner). Thay vào đó ghi rõ giới hạn vào docstring đầu file `rawHtmlLine.ts` để lần sau không ai tưởng nó đã hỗ trợ.

3. Escape `*` `_`: đây là hành vi mặc định của serializer, **không phải bug**, nhưng nó tạo diff rác ở lần lưu đầu. Sau khi P0-2 xong, reconcile sẽ giữ nguyên các vùng không sửa → không còn vấn đề. Không cần code thêm.

**Kiểm chứng** — harness cuối tài liệu: `footnote` và `reflink` phải `OK`.

---

## P0-4 · File > 2 MB mở được trong WYSIWYG nhưng **lưu luôn thất bại**

**Triệu chứng** — đúng nguyên văn "sửa xong không lưu được": gõ được, nút vẫn hiện "Save", bấm Save thì báo lỗi (hoặc im lặng), nội dung hiển thị bị cụt.

**Nguyên nhân gốc**
- Host cắt file ở 2 MB và trả `kind: 'too-large'` (`plugins/dsh-host-files/lib/index.js:868`).
- `BufferRegistry.#buffer` (`~/workbench/buffers.ts:264`) đặt `truncated: true`.
- **Nhưng** `Workbench.tsx:484` chỉ kiểm tra `status?.kind === 'text'`, **không** kiểm tra `status.truncated` → vẫn render `TipTapEditor` cho phép sửa.
- `BufferRegistry.save` (`~/workbench/buffers.ts:208`) trả `{ ok:false, error:'file is too large to edit safely' }` → **mọi lần lưu đều fail**.
- Tệ hơn: `documents.open()` chỉ parse phần đã bị cắt → phần đuôi file **không hiển thị** ("miss hiển thị").

**Cách sửa** — `~/workbench/Workbench.tsx`:
1. Thêm cạnh `isRaw` (khoảng line 385):
   ```ts
   const isTruncated = status?.kind === 'text' && status.truncated
   ```
2. Ở điều kiện render WYSIWYG (line 484), đổi
   `isMd && !isRaw && !diffOpen` → `isMd && !isRaw && !diffOpen && !isTruncated`
   (file bị cắt sẽ rơi xuống nhánh `CodeEditor` read-only sẵn có).
3. Thêm banner ngay trên `CodeEditor` khi `isTruncated`:
   ```tsx
   {isTruncated && (
     <div className={css.notice} data-error>
       File quá lớn ({status.size.toLocaleString()} bytes) — chỉ hiển thị phần đầu, chế độ chỉ đọc.
     </div>
   )}
   ```
4. Ở `~/workbench/Workbench.tsx:197` (effect `documents.open`), thêm guard để không parse file bị cắt:
   ```ts
   const buffer = registry.status(activePath)
   if (buffer?.kind !== 'text' || buffer.truncated) return
   ```

**Kiểm chứng** — tạo file .md > 2 MB, mở → phải ra CodeEditor read-only + banner, không ra WYSIWYG.

---

## P0-5 · "Discard changes" phá editor mà React vẫn đang giữ → UI chết / crash

**Triệu chứng** — sau khi bấm Discard (hoặc Revert trong DiffView) trên tab markdown: bubble menu, TOC, drag-handle, undo/redo ngừng hoạt động; đôi khi React crash trắng màn hình `Rendered fewer hooks than expected`.

**Nguyên nhân gốc** — chuỗi 3 bước:
1. `Workbench.discard()` (`~/workbench/Workbench.tsx:343`) gọi `documents.reopen(path, disk)`.
2. `DocumentRegistry.reopen` (`~/tiptap/documents.ts:223`) gọi `forget()` → `editor.destroy()` → rồi `open()` tạo `Editor` **mới**.
3. `TipTapEditor` giữ instance cũ trong `useState` (`~/tiptap/TipTapEditor.tsx:68, 266`). Effect attach có deps `[documents, path]` (line 314) — **không đổi** → không chạy lại → `setEditor` không bao giờ được gọi. Toàn bộ cây con (`BubbleMenu`, `TableOfContents`, `DragHandleMenu`, `FindBar`, `LinkBubble`) tiếp tục cầm một `Editor` đã `destroy()`.

**Cách sửa** — cho registry công bố "thế hệ" của document, và dùng nó làm React key.

1. `~/tiptap/documents.ts` — thêm counter:
   ```ts
   // trong class, cạnh #docs
   readonly #epochs = new Map<string, number>()

   /** How many times this path's document has been (re)parsed. Changes on
    *  reopen, so a view keyed on it remounts against the new editor instead of
    *  holding a destroyed one. */
   epoch(path: string): number {
     return this.#epochs.get(path) ?? 0
   }
   ```
   Trong `open()`, ngay trước `this.#docs.set(...)`:
   ```ts
   this.#epochs.set(path, (this.#epochs.get(path) ?? 0) + 1)
   ```
   Trong `forget()`, **không** xoá `#epochs` (giữ để số luôn tăng).

2. `~/workbench/Workbench.tsx:486` — đổi key:
   ```tsx
   key={`${activePath}#${documents.epoch(activePath)}`}
   ```
   (`docs.version` đã bump ở `forget`/`open` nên Workbench chắc chắn re-render.)

3. **Đồng thời sửa vi phạm Rules of Hooks** ở `~/tiptap/dragHandle/DragHandleMenu.tsx:28`:
   ```tsx
   export function DragHandleMenu({ editor }: DragHandleMenuProps) {
     if (!isEditorMounted(editor)) return null      // ← DÒNG NÀY ĐỨNG TRƯỚC useState
     const [currentNode, setCurrentNode] = useState(...)
   ```
   Chuyển câu `if` **xuống dưới toàn bộ hook** (ngay trước `return (`, sau `turnIntoOptions`):
   ```tsx
   export function DragHandleMenu({ editor }: DragHandleMenuProps) {
     const [currentNode, setCurrentNode] = useState<ProseMirrorNode | null>(null)
     ... tất cả hook khác ...
     const turnIntoOptions: BlockOption[] = [ ... ]

     if (!isEditorMounted(editor)) return null      // ← ĐẶT Ở ĐÂY
     return ( ... )
   ```
   > Lưu ý: `useEffect` bên trong (line 38) đã có guard `if (!menuOpen) return`, an toàn.

**Kiểm chứng** — mở file .md, sửa, bấm Discard → editor hiện lại nội dung trên đĩa, bubble menu và TOC vẫn hoạt động, console không có lỗi hooks.

---

# P1 — Hiển thị sai / Fold

## P1-1 · UI của editor không re-render theo editor (word-count, TableControls, undo/redo đứng hình)

**Triệu chứng**
- Thanh trạng thái đứng số từ / số ký tự khi đang gõ.
- Thanh công cụ Table **không hiện** khi đặt caret vào bảng (hoặc hiện rồi không mất).
- Nút Undo/Redo mãi mờ (disabled) dù đã có lịch sử.
- Nút Bold/Italic trên BubbleMenu không sáng lên khi bật/tắt mark.

**Nguyên nhân gốc** — hệ thống, một nguyên nhân duy nhất:
`DocumentRegistry.#bump(false)` (`~/tiptap/documents.ts:396-409`) **thoát sớm** khi tập dirty không đổi:
```ts
if (!structural && sameSet(dirty, this.#snapshot.dirty)) return
```
Nghĩa là: gõ phím thứ 2 trở đi trong một document đã dirty → **không có notify** → `Workbench` không re-render → `TipTapEditor` không re-render. Trong khi đó:
- `~/workbench/Workbench.tsx:259-267` `markdownStats` phụ thuộc `docs.version`.
- `~/tiptap/TipTapEditor.tsx:414, 426` `editor?.can().undo()` đọc lúc render.
- `~/tiptap/TableControls.tsx:16` `editor.isActive('table')` đọc lúc render, **không có `editor.on(...)` nào cả**.
- `~/tiptap/BubbleMenu.tsx:87` chỉ nghe `selectionUpdate`, không nghe `update` → active-state của mark bị cũ.

> Đây **không phải** lỗi của `#bump`. `#bump` đúng: nó cố tình không bơm re-render mỗi phím. Lỗi là các component đọc trạng thái editor mà không tự subscribe.

**Cách sửa** — thêm một hook dùng chung, rồi áp cho từng chỗ.

1. Tạo `~/tiptap/useEditorSnapshot.ts`:
```ts
/**
 * Re-render whenever the editor's state changes.
 *
 * Anything that reads `editor.can()`, `editor.isActive()` or
 * `editor.storage.*` during render needs this: the DocumentRegistry only
 * republishes when the *dirty set* changes (see documents.ts #bump), which is
 * once per document, not once per keystroke.
 */
import { useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'

export function useEditorSnapshot(editor: Editor | null | undefined): number {
  return useSyncExternalStore(
    (listener) => {
      if (!editor || editor.isDestroyed) return () => {}
      editor.on('transaction', listener)
      return () => { editor.off('transaction', listener) }
    },
    () => (editor && !editor.isDestroyed ? editor.state.doc.nodeSize + editor.state.selection.from : 0),
  )
}
```
> `transaction` bắt cả doc-change lẫn selection-change. Getter phải trả primitive ổn định — biểu thức trên đủ dùng; nếu muốn chắc chắn hơn, dùng một counter tăng dần trong `useRef` được cập nhật trong callback.
>
> **Thay thế tốt hơn nếu bản `@tiptap/react` đang dùng có sẵn `useEditorState`**: hãy dùng `useEditorState` thay vì viết tay. Kiểm tra `node_modules/@tiptap/react` trước.

2. Áp dụng:
   - `~/tiptap/TableControls.tsx` — thêm `useEditorSnapshot(editor)` ở đầu component (**trước** dòng `if (!editor.isActive('table')) return null`).
   - `~/tiptap/TipTapEditor.tsx` — thêm `useEditorSnapshot(editor)` cạnh `const isDirty = ...` (line 83).
   - `~/tiptap/BubbleMenu.tsx:87` — thêm `editor.on('update', updatePosition)` và `editor.off('update', updatePosition)` trong cleanup.
   - `~/workbench/Workbench.tsx:259` — `markdownStats` không thể dùng hook trong `useMemo`; thay vào đó cho `StatusBar` nhận số liệu qua một component con nhỏ `<MarkdownStats editor={...} />` tự subscribe, HOẶC đơn giản nhất: nghe `update` với debounce 250 ms:
     ```ts
     const [statsTick, setStatsTick] = useState(0)
     useEffect(() => {
       if (activePath === undefined || !isMarkdown(activePath)) return
       const ed = documents.editor(activePath)
       if (ed === undefined) return
       let timer: ReturnType<typeof setTimeout> | undefined
       const onUpdate = () => {
         clearTimeout(timer)
         timer = setTimeout(() => { setStatsTick(t => t + 1) }, 250)
       }
       ed.on('update', onUpdate)
       return () => { clearTimeout(timer); ed.off('update', onUpdate) }
     }, [activePath, documents, docs.version])
     ```
     rồi thêm `statsTick` vào deps của `markdownStats` (line 267).

**Kiểm chứng** — gõ liên tục: word count chạy; đặt caret vào bảng: toolbar hiện ngay; sau 1 lần gõ: nút Undo sáng lên.

---

## P1-2 · Fold widget bị dựng lại mỗi transaction → mất caret, nhấp nháy

**Triệu chứng** — gõ trong heading bị "nhảy" caret, chữ vào sai chỗ, chevron nhấp nháy; document lớn thì gõ giật.

**Nguyên nhân gốc**
`~/tiptap/headingFold/HeadingFoldPlugin.ts:97-105` tạo **`document.createElement` mới mỗi lần** `decorations(state)` chạy (tức mỗi transaction), và spec chứa `stopEvent: () => true` — một closure mới mỗi lần.
ProseMirror so sánh widget bằng `WidgetType.eq`: `spec.key` **hoặc** `toDOM` giống hệt **và** `compareObjs(spec)`. Cả hai đều không thoả → widget bị destroy + recreate liên tục. Widget nằm ở `h.pos + 1` (ngay đầu heading, `side: -1`), nên DOM churn ngay cạnh caret.

**Cách sửa** — dùng `toDOM` dạng **function** (lazy) + `key` ổn định + spec hằng số:
```ts
// đặt ở module scope, ngoài addProseMirrorPlugins
const STOP_EVENT = () => true

// trong headings.forEach:
const foldKey = `fold:${h.pos}:${isCollapsed ? 'c' : 'e'}`
decos.push(
  Decoration.widget(
    h.pos + 1,
    () => {
      const btn = document.createElement('span')
      btn.className = `tiptap-fold-btn ${isCollapsed ? 'is-collapsed' : ''}`
      btn.setAttribute('data-heading-fold-btn', 'true')
      btn.setAttribute('data-pos', String(h.pos))
      btn.setAttribute('title', isCollapsed ? 'Expand section' : 'Collapse section')
      btn.contentEditable = 'false'
      btn.innerHTML = isCollapsed ? CHEVRON_RIGHT : CHEVRON_DOWN
      return btn
    },
    { side: -1, stopEvent: STOP_EVENT, ignoreSelection: true, key: foldKey },
  ),
)
```
Làm y hệt cho `indicator` (line 121-127) với `key: \`foldmark:${h.pos}\``.

**Kiểm chứng** — mở DevTools → Elements, gõ trong heading: node `span.tiptap-fold-btn` **không** bị highlight-thay-mới mỗi phím. Caret không nhảy.

---

## P1-3 · Caret chui được vào vùng đã fold (`display:none`) → "gõ mà không thấy chữ"

**Triệu chứng** — đây là "bị miss hiển thị" thứ hai: bấm vào vùng trống dưới document, gõ, không thấy gì; lưu ra file thì chữ **có** ở đó.

**Nguyên nhân gốc**
- `~/tiptap/TipTapEditor.module.css:659` `.tiptap-folded-node { display: none !important; }` — chỉ ẩn bằng CSS, ProseMirror vẫn coi node đó là vị trí hợp lệ.
- `~/tiptap/TipTapEditor.tsx:536` `if (e.clientY > containerRect.bottom) editor.commands.focus('end')` — khi heading cuối đang fold, `foldEnd` mặc định là `doc.content.size` (`HeadingFoldPlugin.ts:109`) nên **cả đuôi document bị ẩn**, `focus('end')` đẩy caret vào đúng chỗ vô hình.

**Cách sửa** — 2 phần, làm cả 2:

**(a) Tự bung fold khi selection rơi vào vùng ẩn.** Trong `HeadingFoldPlugin.ts`, thêm vào plugin một `appendTransaction` hoặc xử lý trong `apply`. Cách đơn giản & an toàn — thêm `props.handleDOMEvents` là không đủ; dùng `appendTransaction`:
```ts
appendTransaction(transactions, _oldState, newState) {
  const value = headingFoldPluginKey.getState(newState)
  if (!value || value.collapsed.size === 0) return null
  if (!transactions.some(tr => tr.selectionSet || tr.docChanged)) return null

  const { from } = newState.selection
  for (const headingPos of value.collapsed) {
    const node = newState.doc.nodeAt(headingPos)
    if (!node || node.type.name !== 'heading') continue
    const range = foldRangeFor(newState.doc, headingPos)   // tách hàm dùng chung, xem (b)
    if (range && from > range.start && from < range.end) {
      // The caret landed inside content this fold is hiding. Unfold rather
      // than leave the operator typing into an invisible node.
      return newState.tr.setMeta(headingFoldPluginKey, { toggled: headingPos })
    }
  }
  return null
}
```

**(b) Đừng bao giờ ẩn block cuối cùng của document.** Tách logic tính range ra hàm dùng chung và kẹp `foldEnd`:
```ts
/** Where a heading's folded section ends: the next heading at the same or a
 *  shallower level, or the end of the document — but never past the last
 *  block, so there is always somewhere to click and keep writing. */
function foldRangeFor(doc: ProseMirrorNode, headingPos: number): { start: number; end: number } | null { ... }
```
Trong đó, sau khi tính `foldEnd`, thêm:
```ts
const lastChild = doc.lastChild
const lastStart = lastChild ? doc.content.size - lastChild.nodeSize : doc.content.size
if (foldEnd >= doc.content.size && lastChild?.type.name === 'paragraph') {
  foldEnd = lastStart
}
```

**(c) Sửa click-handler canvas** (`TipTapEditor.tsx:536`) để không nhảy vào node ẩn:
```ts
if (e.clientY > containerRect.bottom) {
  const { doc } = editor.state
  const lastChild = doc.lastChild
  const lastStart = lastChild ? doc.content.size - lastChild.nodeSize : 0
  const dom = editor.view.nodeDOM(lastStart) as HTMLElement | null
  // A folded (display:none) tail has no box; focusing it would put the caret
  // somewhere the operator cannot see.
  if (dom instanceof HTMLElement && dom.offsetParent === null) return
  editor.commands.focus('end')
  return
}
```

**Kiểm chứng** — fold heading cuối, click vùng trống dưới → caret **không** biến mất; dùng phím mũi tên đi xuống qua heading đã fold → section tự bung.

---

## P1-4 · Vị trí fold không bị loại khi heading bị xoá / đổi loại

**Nguyên nhân gốc**
`~/tiptap/headingFold/HeadingFoldPlugin.ts:48`:
```ts
collapsed = new Set([...collapsed].map((pos) => tr.mapping.map(pos)))
```
`map()` không cho biết vị trí đã bị xoá hay chưa. Vị trí "mồ côi" tích tụ trong Set, và có thể **trùng vào một heading khác** sau vài lần sửa → một section tự nhiên bị fold.

**Cách sửa**
```ts
if (tr.docChanged) {
  const mapped = new Set<number>()
  for (const pos of collapsed) {
    const result = tr.mapping.mapResult(pos)
    // A fold whose heading was deleted has nothing left to collapse; keeping
    // the position would eventually collide with an unrelated heading.
    if (result.deleted) continue
    const node = tr.doc.nodeAt(result.pos)
    if (node?.type.name !== 'heading') continue
    mapped.add(result.pos)
  }
  collapsed = mapped
}
```
> ⚠️ Nhớ giữ nguyên tối ưu `return collapsed === value.collapsed ? value : { collapsed }`. Với code trên, `collapsed` luôn là Set mới khi `tr.docChanged` — thay bằng so sánh kích thước + nội dung, hoặc chỉ tạo Set mới khi thật sự khác:
> ```ts
> const changed = mapped.size !== collapsed.size || [...mapped].some(p => !collapsed.has(p))
> collapsed = changed ? mapped : collapsed
> ```

**Kiểm chứng** — fold một heading, xoá heading đó, thêm/xoá text ở trên → không heading nào tự fold.

---

## P1-5 · Heading lồng trong blockquote / list / details tính sai vùng fold

**Nguyên nhân gốc**
`~/tiptap/headingFold/HeadingFoldPlugin.ts:83` dùng `doc.descendants()` → gom **mọi** heading ở mọi độ sâu, rồi `HeadingFoldPlugin.ts:118` tính `foldStart = h.pos + h.nodeSize` và `foldEnd` theo heading tiếp theo **ở mọi độ sâu**. Với heading trong blockquote, range này tràn ra ngoài node cha → `Decoration.node` bị sai depth, ẩn nhầm khối.

**Cách sửa** — chỉ fold heading ở **cấp cao nhất**:
```ts
// Only top-level headings own a foldable section. A heading nested inside a
// blockquote/list/details belongs to that container, and a range computed
// against the document would spill outside its parent.
doc.forEach((node, offset) => {
  if (node.type.name === 'heading') {
    headings.push({ pos: offset, level: (node.attrs.level as number) || 1, nodeSize: node.nodeSize })
  }
})
```
(`doc.forEach` callback là `(node, offset, index)` với `offset` tính từ 0; vì đây là children trực tiếp của doc nên `offset` chính là `pos`.)

**Kiểm chứng** — tạo `> ## Heading trong quote`, kiểm tra không có chevron ở đó và fold heading ngoài vẫn đúng phạm vi.

---

## P1-6 · Fold không phản ánh vào Print/PDF và Copy MD

**Triệu chứng** — bấm "📄 Print / Export PDF" khi đang fold → PDF mất section; hoặc ngược lại, in ra cả app chứ không riêng document.

**Nguyên nhân gốc** — `~/tiptap/TipTapEditor.tsx:500` gọi thẳng `window.print()`, không có `@media print` stylesheet nào ép `.tiptap-folded-node { display: revert }` hay ẩn sidebar/toolbar.

**Cách sửa** — thêm vào cuối `~/tiptap/TipTapEditor.module.css`:
```css
@media print {
  /* Folding is a reading aid, not part of the document. */
  .container :global(.tiptap-folded-node) { display: revert !important; }
  .container :global(.tiptap-fold-btn),
  .container :global(.tiptap-folded-indicator) { display: none !important; }
  .topBar { display: none !important; }
}
```
(Nếu layout ngoài cùng cũng in ra, thêm rule tương tự ở `~/styles/` cho sidebar/tab-strip — kiểm tra `AppFrame.module.css`.)

---

# P2 — Lỗi vừa

## P2-1 · `DocumentRegistry.detach()` là hàm rỗng

`~/tiptap/documents.ts:277-281` — thân hàm chỉ có comment, `doc.host` vẫn trỏ vào element **đã bị React gỡ khỏi DOM**.
Hệ quả: (a) giữ tham chiếu tới DOM chết → rò rỉ bộ nhớ theo số lần chuyển tab; (b) `reopen()` (line 224) mount document mới vào element chết nếu tab đang không hiển thị.

**Sửa** — giữ view sống nhưng chuyển vào một "kho" ngoài màn hình:
```ts
// module scope
/** Off-screen parking lot for detached editor views: keeping the EditorView
 *  alive is the whole point of this registry, but parking it in a node React
 *  has already unmounted retains dead DOM and gives `reopen` a mount target
 *  that will never be shown. */
function limbo(): HTMLElement {
  let el = document.getElementById('dsh-editor-limbo')
  if (el === null) {
    el = document.createElement('div')
    el.id = 'dsh-editor-limbo'
    el.style.display = 'none'
    document.body.appendChild(el)
  }
  return el
}

detach(path: string): void {
  const doc = this.#docs.get(path)
  if (doc === undefined || doc.host === null) return
  const park = limbo()
  try { park.appendChild(doc.editor.view.dom) } catch { /* already gone */ }
  doc.host = park
}
```
`attach()` đã xử lý đúng trường hợp `doc.host !== el` (line 248-256) nên không cần đổi.

## P2-2 · `attach()` âm thầm rebase `diskDoc` mỗi lần chuyển tab

`~/tiptap/documents.ts:264-266`:
```ts
if (wasClean) { doc.diskDoc = doc.editor.state.doc }
```
`isDocDirty` (line 419) **đã** bỏ qua đúng trường hợp "thêm/thiếu 1 paragraph rỗng cuối". Đoạn rebase này vì thế thừa, mà lại nguy hiểm: nếu ProseMirror chuẩn hoá DOM theo cách khác (bảng, code block, node view), một khác biệt thật giữa tree và đĩa sẽ bị nhận làm baseline → **tab hiện "Saved ✓" trong khi nội dung đã khác đĩa**.
**Sửa** — xoá đoạn `if (wasClean)` và biến `wasClean`/`isFirstMount` không dùng nữa.

## P2-3 · FindBar: highlight rác toàn cục + không tự cập nhật

`~/tiptap/findBar/FindBar.tsx:28-48`
- Không có cleanup lúc unmount → `CSS.highlights` giữ `Range` trỏ vào DOM đã chết (đóng tab / đổi file → highlight lạ trên document khác).
- Không nghe `editor.on('update')` → sau khi gõ, số match và vị trí highlight sai.
- Range nằm trong vùng fold (`display:none`) có rect = 0 → nhảy tới match thất bại.

**Sửa**
```ts
// thêm effect riêng, chạy 1 lần
useEffect(() => () => { clearHighlights() }, [])

// và cho tìm lại khi document đổi
useEffect(() => {
  if (!isOpen) return
  const rerun = () => { performSearch(query, matchCase, currentIndex) }
  editor.on('update', rerun)
  return () => { editor.off('update', rerun) }
}, [editor, isOpen, query, matchCase, currentIndex])
```
Và trong `performSearch`, bỏ qua text node vô hình:
```ts
const parent = node.parentElement
if (parent === null || parent.offsetParent === null) { node = treeWalker.nextNode(); continue }
```

## P2-4 · Phím tắt của editor bắt cả khi focus ở nơi khác

`~/tiptap/TipTapEditor.tsx:334-356` gắn `keydown` lên `window` và chỉ kiểm tra `e.defaultPrevented`. Gõ **Ctrl+F** trong ô tìm kiếm của Explorer hay khung chat sẽ mở FindBar của document; **Ctrl+K** mở popover AI.

**Sửa** — thêm guard focus (giữ nguyên Ctrl+S vì đó là hành vi mong muốn toàn app):
```ts
const insideThisEditor = (): boolean => {
  const el = containerRef.current
  const active = document.activeElement
  return el !== null && active instanceof globalThis.Node && el.contains(active)
}
...
} else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
  if (!insideThisEditor()) return
  e.preventDefault()
  setFindBarOpen((prev) => !prev)
} else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
  if (!insideThisEditor()) return
  ...
}
```

## P2-5 · `aiState.range` không được map qua các thay đổi document

`~/tiptap/TipTapEditor.tsx:94-101` chụp `{from, to}` lúc mở popover; `~/tiptap/ai/InlineAIPopover.tsx:111, 128` dùng lại nguyên vẹn khi Accept. Nếu document đổi trong lúc popover mở (autosave projection, undo, người dùng gõ chỗ khác), range trỏ sai → **xoá nhầm đoạn văn**.

**Sửa** — kẹp và kiểm tra trước khi dùng, trong `handleAccept`/`handleInsertBelow`:
```ts
const size = editor.state.doc.content.size
const from = Math.min(aiState.range.from, size)
const to = Math.min(aiState.range.to, size)
if (from > to) return onClose()
```
(Chuẩn hơn: lưu `StepMap` và map qua `editor.state.tr.mapping`, nhưng bản kẹp trên đã chặn được ca xoá nhầm.)

## P2-6 · `aiEngine` không phải AI

`~/tiptap/ai/aiEngine.ts:40-60` — `executeAITransform` gọi `synthesizeTransform`, một hàm biến đổi chuỗi thuần local (regex/heuristic), rồi giả lập streaming bằng `setTimeout(15ms)`.
**Không phải bug**, nhưng UI đang hứa "Ask AI". Cần một trong hai:
- Nối vào backend thật (dùng đúng model IDs hiện hành), hoặc
- Đổi nhãn thành "Text tools" / thêm badge "offline" để không đánh lừa người dùng.

## P2-7 · TOC ScrollSpy gây thrash layout trên document lớn

`~/tiptap/toc/TableOfContents.tsx:155-210` — effect có `activePos` trong deps nên **gỡ và gắn lại listener scroll mỗi lần heading active đổi**; bên trong mỗi frame lại gọi `findHeadingElement()` + `getBoundingClientRect()` cho **mọi** heading.

**Sửa** — dùng `IntersectionObserver` với `rootMargin: '0px 0px -80% 0px'` trên các phần tử heading, hoặc tối thiểu: bỏ `activePos` khỏi deps (dùng ref) và cache map `pos → element`, invalidate khi `headings` đổi.

## P2-8 · Escape trong TOC bỏ ghim vĩnh viễn

`~/tiptap/toc/TableOfContents.tsx:277-280` — `handleKeyDown` gọi `setIsPinned(false)` rồi `onClose()`, và **không** ghi lại `dsh_toc_pinned`. Kết quả: state React và localStorage lệch nhau; lần mở sau panel lại "pinned" dù người dùng vừa bỏ ghim.
**Sửa** — Escape chỉ nên `onClose()`, bỏ `setIsPinned(false)`. (Effect này vốn chỉ chạy khi `!isPinned` nên dòng đó là no-op logic nhưng vẫn gây lệch.)

## P2-9 · "Copy MD" và "Save" cho ra markdown khác nhau

`~/tiptap/TipTapEditor.tsx:481` dùng `documents.preview()` (1 pass, `serializeOnce`), còn save dùng `serializeStable` + reconcile. Người dùng copy ra rồi paste vào file khác sẽ thấy khác nội dung đã lưu.
**Sửa** — cho nút Copy dùng `documents.markdown(path)`. Đây là thao tác do người dùng chủ động bấm nên chi phí chấp nhận được.
> ⚠️ Cẩn thận: `markdown()` đặt `doc.pendingCanonical` (line 338), mà `markSaved` giả định giá trị đó thuộc về lần save kế tiếp (xem docstring line 68-84). Nếu dùng `markdown()` cho Copy, phải **không** ghi `pendingCanonical`. Cách sạch: tách tham số `markdown(path, { forSave = true } = {})` và chỉ set `pendingCanonical` khi `forSave`.

## P2-10 · `performSave` vẫn ghi đĩa khi projection thất bại

`~/workbench/Workbench.tsx:186-192`:
```ts
const written = isMarkdown(path) ? projectMarkdown(path, true) : undefined
...
const result = await registry.save(path)
```
Nếu `documents.markdown()` trả `undefined` (document chưa mở), `written` là `undefined` nhưng `registry.save()` **vẫn chạy** và ghi nội dung buffer cũ đè lên đĩa.
**Sửa**:
```ts
if (isMarkdown(path) && written === undefined) {
  setSaveState({ error: 'document not ready' })
  onNotify('Save skipped: the document is still opening')
  return false
}
```

---

# P3 — Lỗi vặt / đánh bóng

| # | File | Vấn đề | Sửa |
|---|---|---|---|
| P3-1 | `~/tiptap/TipTapEditor.tsx:72-78` | `dsh_toc_open`, `dsh_toc_width`, `dsh_toc_pinned` là **global**, không theo tab. Mở file khác thì TOC vẫn theo file trước. | Key theo path: `dsh_toc_open:${path}` (hoặc chấp nhận và ghi vào docs). |
| P3-2 | `~/tiptap/TipTapEditor.tsx:241-261` | Ghi `window.__dsh_active_selection` nhưng **không xoá** lúc unmount → chat panel trích dẫn selection của file đã đóng. | Thêm `delete (window as any).__dsh_active_selection` vào cleanup (line 305-313). |
| P3-3 | `~/tiptap/TipTapEditor.tsx:134, 171` | `textBetween(0, parentOffset, undefined, '￼')` — blockSeparator `undefined` khiến offset lệch nếu parent chứa inline atom nhiều hơn 1 char. | Truyền `''` cho blockSeparator để rõ ý; thêm test cho `/` sau một inline math. |
| P3-4 | `~/tiptap/SlashMenu.tsx:184` & `~/tiptap/DocLinkMenu.tsx:595` | Cả hai gắn `keydown` capture lên `window`. Nếu cùng mở (`/` rồi `@`), thứ tự xử lý không xác định. | `TipTapEditor` chỉ nên render **một** menu tại một thời điểm: khi `docLinkState !== null` thì bỏ qua `slashState`. |
| P3-5 | `~/tiptap/markdown.ts:38` | `MAX_PASSES = 8`, khi không hội tụ chỉ `console.warn` rồi vẫn lưu. Người dùng không biết file đang bị "gặm". | Đẩy cảnh báo lên UI qua `onNotify` (nối vào chuỗi P0-2.3). |
| P3-6 | `~/tiptap/frontmatter/parseFrontmatter.ts:89` | Parser YAML tự chế: không hỗ trợ nested map, multiline `\|`/`>`, số/bool. Giá trị `true` hiển thị thành chuỗi `"true"`. | Sau P0-1, frontmatter đã an toàn; nâng cấp parser là ticket riêng (cân nhắc `js-yaml`). |
| P3-7 | `~/tiptap/frontmatter/FrontmatterWidget.tsx:9` | Card **chỉ đọc** — không có đường nào sửa frontmatter trong WYSIWYG. | Ticket tính năng riêng: cho phép sửa `rawYaml` rồi ghi lại `doc.frontmatter` (cần API mới trên `DocumentRegistry`). |
| P3-8 | `~/tiptap/headingFold/HeadingFoldPlugin.ts:130-138` | `doc.nodesBetween` đệ quy → gắn class `tiptap-folded-node` cho cả node con của node đã ẩn. Thừa. | Return `false` trong callback sau khi đã gắn cho node cấp 1 để không đệ quy xuống. |
| P3-9 | `~/tiptap/mermaid/MermaidExtension.tsx:232` | `renderMarkdown` nối `'```mermaid' + code + '```'`; nếu `code` đã có `\n` cuối sẽ sinh dòng trống thừa. | `code.replace(/\r?\n+$/, '')` trước khi nối. |
| P3-10 | `~/workbench/Workbench.tsx` | Không có file-watcher: file bị sửa ngoài app thì editor giữ bản cũ và lưu đè. | Ticket riêng: poll mtime hoặc SSE từ `dsh-host-files`, rồi gọi `documents.reopen`. |

---

# Thứ tự thực thi đề nghị

1. **P0-5 + P2-1 + P2-2** (registry/lifecycle) — nhỏ, gỡ crash, làm nền cho phần còn lại.
2. **P0-1** (frontmatter) — sửa đúng nguyên nhân "miss hiển thị".
3. **P0-2, P0-3** (reconcile + passthrough) — sửa "lưu xong hỏng file".
4. **P0-4** (file quá lớn) — sửa "không lưu được".
5. **P1-1** (subscribe) — sửa "UI đứng hình".
6. **P1-2 … P1-6** (fold).
7. **P2, P3** theo thứ tự.

---

# Harness kiểm chứng

Lưu vào `.tmpaudit/roundtrip.test.mts` (nhớ xoá sau khi xong, hoặc chuyển thành test thật trong `plugins/dsh-client-vscode-layout/tests/`):

```ts
// Chạy: JSD=$(ls -d $PWD/node_modules/.pnpm/jsdom@*/node_modules/jsdom)/lib/api.js
//       sed "s#JSDOMPATH#$JSD#" roundtrip.test.mts > run.mts && node_modules/.bin/tsx run.mts
import { JSDOM } from 'JSDOMPATH'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
for (const k of ['HTMLElement','Element','Node','DOMParser','getComputedStyle','MutationObserver','Range','NodeFilter'])
  (globalThis as any)[k] = (dom.window as any)[k]

const base = process.cwd() + '/plugins/dsh-client-vscode-layout/src/client/tiptap/'
const { roundTrip } = await import(base + 'markdown.ts')

const samples: Record<string, string> = {
  frontmatter:    '---\ntitle: Hello\ntags:\n  - a\n  - b\n---\n\n# Heading\n\nBody text.\n',
  footnote:       'Some text[^1]\n\n[^1]: the footnote\n',
  reflink:        '[label][ref]\n\n[ref]: https://x.com\n',
  autoLink:       'See <https://example.com> ok\n',
  htmlBlock:      '<div align="center">\n  <b>hi</b>\n</div>\n',
  nestedListCode: '- item\n  - sub\n\n    ```js\n    const a = 1\n    ```\n',
  inlineMath:     'Euler $e^{i\\pi}+1=0$ done\n',
  strikethrough:  '~~gone~~ and **bold**\n',
  taskList:       '- [ ] todo\n- [x] done\n',
  table:          '| a | b |\n| --- | --- |\n| 1 | 2 |\n',
  hardbreak:      'line one  \nline two\n',
}

let failed = 0
for (const [name, src] of Object.entries(samples)) {
  let out: string
  try { out = roundTrip(src) } catch (e: any) { out = 'THREW: ' + e.message }
  const ok = out.trim() === src.trim()
  if (!ok) failed++
  console.log(`${ok ? 'OK      ' : 'CHANGED '} ${name}`)
  if (!ok) {
    console.log('   IN :', JSON.stringify(src))
    console.log('   OUT:', JSON.stringify(out))
  }
}
console.log(`\n${failed} / ${Object.keys(samples).length} changed`)
```

**Trạng thái hiện tại (trước khi sửa):** `frontmatter, footnote, reflink, autoLink, htmlBlock, nestedListCode, inlineMath` → CHANGED (7/11).
**Mục tiêu sau P0-1 + P0-3:** `frontmatter, footnote, reflink` → OK. `autoLink, htmlBlock, inlineMath, nestedListCode` là giới hạn đã biết — ghi vào docstring, không im lặng.
