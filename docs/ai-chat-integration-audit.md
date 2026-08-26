# Audit: Ctrl+L, mention → chat, và reference chip

Phạm vi: đường đi từ vùng chọn trong editor sang composer của chat (Ctrl+L,
bubble menu, command palette, inline AI). Mọi kết luận dưới đây đều đã đối
chiếu với source thật của host trong `.ref/deepseek-harness` và, ở phần chip,
đã chạy thử trên chính `InputMachine` của host.

Tài liệu này viết cho người implement, không phải bản tóm tắt.

---

## Phần A — Ctrl+L

### A-1 (P0). Ctrl+L không bao giờ đóng được chat

`plugins/dsh-client-vscode-layout/src/client/AppFrame.tsx:240`

```tsx
} else if (mod && e.key.toLowerCase() === 'l' && !e.shiftKey) {
  e.preventDefault()
  if (panels.activePath) {          // <-- điều kiện sai
    actions.openRight()
    actions.setRightTab('chat')
    ...
    if (appendToComposer(`@${filename}${lineTag}`)) focusComposer()
    ...
  } else {                          // <-- nhánh toggle
    if (colsRef.current.right === 0) { actions.openRight(); actions.setRightTab('chat') }
    else { actions.closeRight() }
  }
}
```

Nhánh `else` — nhánh duy nhất gọi `closeRight()` — chỉ chạy khi **không có
file nào đang mở**. Nghĩa là suốt thời gian đang soạn tài liệu, `activePath`
luôn có giá trị, nên Ctrl+L **luôn** append mention, **luôn** `openRight()`,
**luôn** `focusComposer()`. Không tồn tại đường nào để Ctrl+L đóng chat.

Đây chính xác là hành vi user mô tả: đang chat, muốn tắt chat để tập trung vào
tài liệu, ấn Ctrl+L thì nó lại nhét thêm một dòng vào chat.

Điều kiện đúng phải là **có vùng chọn hay không**, không phải **có file hay
không**.

**Cách sửa.** Tách việc lấy selection ra trước, rồi rẽ nhánh theo nó:

```tsx
} else if (mod && e.key.toLowerCase() === 'l' && !e.shiftKey) {
  e.preventDefault()

  // Chỉ vùng chọn do chính editor công bố mới được tính. Xem A-4 vì sao
  // window.getSelection() không được dùng làm fallback ở đây nữa.
  const activeSel = (window as any).__dsh_active_selection
  const hasSelection =
    panels.activePath !== undefined &&
    activeSel != null &&
    activeSel.path === panels.activePath &&
    typeof activeSel.selectedText === 'string' &&
    activeSel.selectedText.trim().length > 0

  if (hasSelection) {
    actions.openRight()
    actions.setRightTab('chat')
    if (sendReferenceToComposer(panels.activePath!, activeSel)) focusComposer()
    else handleNotify('Open a session first', 'warning')
  } else if (colsRef.current.right === 0) {
    actions.openRight()
    actions.setRightTab('chat')
  } else {
    actions.closeRight()
  }
}
```

`sendReferenceToComposer` là hàm mới ở Phần B. Nếu chưa làm Phần B thì tạm giữ
`appendToComposer(...)` cũ, nhưng **điều kiện rẽ nhánh phải sửa ngay** — đó là
lỗi user đang chịu.

Lưu ý: `colsRef.current.right` phải đọc từ ref (đã đúng trong code hiện tại) —
`cols` không nằm trong deps của effect nên đọc trực tiếp sẽ dính giá trị cũ.

### A-2 (P1). Không có selection thì cũng đừng cướp focus

Kể cả khi Ctrl+L mở chat (nhánh giữa ở trên), hiện tại `focusComposer()` chỉ
được gọi ở nhánh có mention — đúng rồi. Giữ nguyên như patch A-1: mở panel mà
không kéo caret ra khỏi tài liệu trừ khi thật sự có gửi gì đó.

### A-3 (P1). `__dsh_active_selection` không bao giờ bị xoá khi rời editor

`tiptap/TipTapEditor.tsx:233` và `workbench/CodeEditor.tsx:128` chỉ set `null`
khi **selection trong chính editor đó** đổi thành rỗng. Không có chỗ nào xoá nó
khi:

- user click sang composer của chat (ProseMirror giữ nguyên selection cũ, không
  bắn `onSelection`),
- user đổi tab sang file khác (biến vẫn mang `path` của file cũ),
- user đóng tab (chỉ `TipTapEditor` cleanup ở `:301` mới `delete`, và chỉ khi
  component unmount thật).

Trước A-1 thì không ai để ý vì biến này chỉ ảnh hưởng phần `#L..`. **Sau A-1 nó
trở thành công tắc bật/tắt của cả phím tắt**, nên độ tươi của nó thành chuyện
quan trọng.

Ràng buộc `activeSel.path === panels.activePath` đã chặn được trường hợp đổi
tab. Còn lại: selection cũ trong cùng file vẫn được coi là hợp lệ vô thời hạn.
Cái này thực ra **đúng ý người dùng** — quy trình chuẩn là bôi đen rồi mới với
tay lên Ctrl+L, và ProseMirror giữ selection khi mất focus. Nên **không sửa**,
chỉ ghi lại để người sau không tưởng là bug.

Cái *phải* sửa: thêm dọn dẹp khi đóng tab, cạnh `actions.setTabs`/`closeFile`:

```ts
const sel = (window as any).__dsh_active_selection
if (sel?.path === closedPath) (window as any).__dsh_active_selection = null
```

### A-4 (P1). Fallback `window.getSelection()` gán nhầm chữ của panel khác cho file đang mở

`AppFrame.tsx:257`, và cùng lỗi ở `AppFrame.tsx:226` (Ctrl+K):

```tsx
const sel = reported ?? window.getSelection()?.toString() ?? ''
```

`window.getSelection()` là selection của **cả document**, không riêng editor.
Bôi đen một đoạn trong transcript chat, trong file tree, trong status bar — tất
cả đều rơi vào đây, rồi bị đem đi `getLineRangeForSelection(docText, sel)` để
dò trong nội dung file đang mở. Kết quả: hoặc ra `#L1` vô nghĩa (fallback cuối
của `chatComposer.ts` khi `indexOf` trả -1), hoặc tệ hơn, khớp trúng một dòng
trùng chữ ở chỗ khác trong file và gắn số dòng sai.

Bỏ hẳn fallback này ở nhánh Ctrl+L (patch A-1 đã bỏ). Với Ctrl+K, nếu vẫn muốn
giữ vì inline AI có thể chạy khi không có `__dsh_active_selection`, thì tối
thiểu phải kiểm tra selection nằm trong editor:

```ts
const winSel = window.getSelection()
const inEditor =
  winSel !== null && !winSel.isCollapsed &&
  winSel.anchorNode !== null &&
  document.querySelector('.ProseMirror')?.contains(winSel.anchorNode) === true
const sel = reported ?? (inEditor ? winSel!.toString() : '')
```

### A-5 (P2). Command Palette ghi nhầm phím tắt

Mục `workbench.action.toggleChat` khai `keybinding: 'Ctrl+L'` và title
"Toggle AI Chat / Details Column", nhưng thân hàm ở `AppFrame.tsx:355` là
`askAIAboutFile` — nó append mention chứ không toggle. Sau A-1 thì Ctrl+L mới
thật sự là toggle; lúc đó nên tách làm hai mục palette:

- `Toggle AI Chat` → `Ctrl+L`, gọi đúng nhánh toggle.
- `Ask AI About Active File` → không keybinding, giữ nguyên hành vi append.

---

## Phần B — Reference chip

### Kết luận ngắn

Host **đã có sẵn** toàn bộ hạ tầng chip. Plugin không dùng nó — mọi mention đều
đi qua `setDraft` nên vào composer dưới dạng text thường. Chuyển sang
`insertReference` là đủ để ra chip có nền, **không cần đụng vào host**.

Nhưng chip của host là **ô cố định 4em, không có icon**. Muốn giống hệt ảnh
(`{} openclaw.json #L34`, bề rộng co giãn theo nội dung, có icon loại file) thì
bắt buộc phải sửa host. Chi tiết ở B-3 và B-4.

### B-1 (P0). Hai đường ghi vào composer, plugin đang đi đường không có chip

Host công bố hai verb qua `IConversation.input.for(actx)`
(`.ref/.../ui-conversation/src/client/input/contract.ts`):

| verb | kết quả trong draft | hiển thị |
|---|---|---|
| `setDraft(text)` | ký tự thường | text thường |
| `insertReference(ref, span)` | một ký tự `U+FFFC` + một `Occurrence` | **chip** |

`composer.ts` chỉ bọc `setDraft`:

```ts
input.setDraft(`${draft}${gap}${text} `)   // client/index.ts:109
```

`Occurrence` là "one reference chip occurrence, backing exactly one U+FFFC
placeholder in the draft", và `deriveDecorations` (`input/decorations.ts`) biến
mỗi occurrence thành một `ChipRender` mà `skeleton/InputBar.tsx:605` render ra
`<span class={css.chip}>` — chính cái nền `rgba(97,135,216,.22)`, bo 6px.

`insertReference` yêu cầu một `TokenSpan { start, end, draftRev }` để CAS. Ctrl+L
không có token nào để thay, nhưng **span rỗng ở cuối draft là hợp lệ**:

```ts
// input/machine.ts:259
private casOk(span: TokenSpan): boolean {
  return span.draftRev === this.draftRev
    && span.start >= 0 && span.start <= span.end && span.end <= this.draft.length
}
```

`start <= end`, không đòi `start < end`.

**Đã kiểm chứng thật** — chạy trực tiếp `InputMachine` của host:

```
1) draft="giai thich doan nay" rev=1 occ=0
2) draft="giai thich doan nay￼ "
   placeholder đúng vị trí: true
   chips= [{"occurrenceId":1,"offset":19,"label":"rawHtmlLine.ts #L47-55","invalid":false}]
3) hai chip liên tiếp: n=2
4) span cũ (stale rev) bị từ chối: true
5) gõ thêm chữ, chip vẫn neo đúng chỗ: offsets=[19,21] placeholders-intact=true
6) xoá ký tự placeholder → occurrence tự rụng: n=1
```

Nghĩa là undo/redo, gõ chèn, xoá chip — tất cả đã đúng sẵn, không phải tự làm.

**Cách sửa.** Thêm verb thứ hai vào `composer.ts` cạnh `appendToComposer`:

```ts
// composer.ts
export interface ComposerReference {
  /** Tên source đã đăng ký — phải khớp `createFileSource`'s GROUP ('files'). */
  readonly source: string
  /** Id do source tự định nghĩa; đây là thứ codec.serialize() nhận lại. */
  readonly ref: string
  /** Nhãn hiển thị trên chip. Xem B-3: ngân sách ~10 ký tự. */
  readonly label: string
  /** Bản chiếu cho clipboard/persist, KHÔNG phải bản gửi cho model. */
  readonly clipboardText: string
}

export type ReferenceWriter = (ref: ComposerReference) => boolean

const NO_REFERENCE: ReferenceWriter = () => false
let referenceWriter: ReferenceWriter = NO_REFERENCE

export function installReferenceWriter(next: ReferenceWriter): () => void {
  referenceWriter = next
  return () => { if (referenceWriter === next) referenceWriter = NO_REFERENCE }
}

/** Chèn một reference chip vào cuối draft. */
export function appendReferenceToComposer(ref: ComposerReference): boolean {
  return referenceWriter(ref)
}
```

Và seat nó trong `client/index.ts`, ngay cạnh `installComposerWriter`:

```ts
ctx.effect(() => installReferenceWriter((reference) => {
  const conversation = ctx.get('conversation') as IConversation | undefined
  if (conversation === undefined) return false
  const sessionId = ctx.sessions.list.getSnapshot().current
  if (sessionId === undefined) return false
  const actx = ctx.sessions.scope(sessionId)
  if (actx === undefined) return false
  const input = conversation.input.for(actx)

  // Chip tự thêm khoảng trắng PHÍA SAU nó (replaceSpanWithChip), không thêm
  // phía trước. Nên khoảng cách với chữ đang gõ dở phải tự chèn — và phải đọc
  // lại snapshot sau đó vì setDraft đã bump draftRev, span cũ sẽ trượt CAS.
  const before = input.state.getSnapshot()
  if (before.draft.length > 0 && !/\s$/.test(before.draft)) input.setDraft(`${before.draft} `)

  const snap = input.state.getSnapshot()
  const at = snap.draft.length
  return input.insertReference(reference, { start: at, end: at, draftRev: snap.draftRev })
}), 'vscode-layout: composer reference writer')
```

Rồi ở `AppFrame.tsx`, thay chỗ `appendToComposer(`@${filename}${lineTag}`)`:

```ts
function sendReferenceToComposer(path: string, sel: any): boolean {
  const rel = toWorkspaceRelative(path)          // xem B-5
  const range = sel.rangeString ?? ''            // '#L47-L55'
  return appendReferenceToComposer({
    source: 'files',
    ref: `${rel}${range}`,
    label: shortChipLabel(basename(path) || path, range),   // xem B-3
    clipboardText: `@${rel}${range}`,
  })
}
```

Áp cùng một hàm cho cả ba call site còn lại: `BubbleMenu.tsx:581`,
`AppFrame.tsx:362` (palette), `AppFrame.tsx:398` (inline AI — chip trước, prompt
sau bằng `appendToComposer`).

### B-2 (P0, đi kèm B-1). `@`-menu cũng đang trả text thường

`inputTriggers/fileSource.ts`:

```ts
onPick({ candidate }) {
  return { text: `@${candidate.name} ` }     // <-- nhánh plain-text
}
```

`PickOutcome` có nhánh `{ insert: ReferenceInsert }` cho chip. Đang chọn nhánh
`text`, nên chọn file từ menu `@` cũng chỉ ra chữ thường.

Có một đường thứ ba host để sẵn cho nhánh `text`: `scanTextRefs` trong
`decorations.ts` sẽ vẽ nền cho `@tên` nếu source có implement `lexicon()`.
**Đường này không dùng được cho file**, vì regex của nó là:

```ts
const TEXT_REF_RE = /(^|\s)([/@])([\w-]+)/g
```

`[\w-]+` không chứa `.` và không chứa `/`. `@openclaw.json` chỉ khớp phần
`@openclaw`, còn `@src/foo.ts` thì khớp `@src` rồi đứt. Đừng mất thời gian với
`lexicon` — đi thẳng `{ insert }`:

```ts
onPick({ candidate }) {
  return {
    insert: {
      source: GROUP,
      ref: candidate.name,
      label: candidate.description ?? candidate.name,   // basename
      clipboardText: `@${candidate.name}`,
    },
  }
}
```

Sửa cùng lúc với B-1 để hai đường vào chat cho ra cùng một hình dạng.

### B-3 (P1). Ô chip rộng đúng 4em, cố định — nhãn chỉ vừa ~10 ký tự

Đây là ràng buộc cứng, không phải chuyện tinh chỉnh CSS.

Chip được vẽ ở lớp backdrop chồng lên textarea, nên bề rộng của nó **bắt buộc**
bằng bề rộng ký tự `U+FFFC` trong textarea, nếu không mọi glyph phía sau sẽ
lệch khỏi caret. Host bảo đảm điều đó bằng cách nhúng một font riêng
(`DshChipCell`) chỉ có đúng một glyph.

Giải mã font base64 trong `InputBar.module.css:8`:

```
unitsPerEm 1000, numberOfHMetrics 2
glyph 1 (U+FFFC) advance = 4000  →  4.0 em
```

Composer chạy `font-size: 16px` → ô chip = **64px, không co giãn**.

Nhãn thì bị ép vào trong ô đó:

```css
.chipLabel {
  width: calc(100% / 0.72 - 10px);
  overflow: hidden;
  white-space: nowrap;
  transform: translate(-50%, -50%) scale(0.72);
}
```

64/0.72 − 10 = 78.9px ở cỡ chữ 16px, scale về 0.72 → **~57px hiển thị ở cỡ chữ
hiệu dụng ~11.5px**, tức khoảng **10–11 ký tự latin** rồi bị cắt cụt (không có
`text-overflow: ellipsis`, chỉ `overflow: hidden` — cắt phựt giữa chữ).

Hệ quả cụ thể: `rawHtmlLine.ts #L47-55` (22 ký tự) hiện ra khoảng
`rawHtmlLin`. `openclaw.json #L34` (18) ra khoảng `openclaw.j`.

Nên trong lúc chưa sửa host, nhãn phải được rút ngắn có chủ đích. Ưu tiên giữ
số dòng vì đó là thứ phân biệt hai chip cùng file:

```ts
/** Nhãn cho ô 4em: ~10 ký tự. Ưu tiên số dòng, cắt phần tên. */
function shortChipLabel(filename: string, range: string): string {
  const lines = range.replace(/^#L/, '').replace(/-L/, '-')   // '47-55'
  const tail = lines ? `:${lines}` : ''
  const room = Math.max(3, 10 - tail.length)
  const stem = filename.length <= room ? filename : `${filename.slice(0, room - 1)}…`
  return `${stem}${tail}`
}
// 'rawHtmlLine.ts', '#L47-L55' -> 'raw…:47-55'
// 'openclaw.json', '#L34'      -> 'openclaw…:34'
```

Tên đầy đủ vẫn có: `InputBar.tsx:610` gắn `title={chip.label}` — nên nếu muốn
hover ra full path thì phải đổi `label` ở host, hoặc chấp nhận tooltip cũng
ngắn. Đây là lý do thứ hai để cân nhắc B-4.

### B-4 (P2, cần sửa host). Không có icon, và không có cách nào thêm từ phía plugin

Chuỗi dữ liệu từ plugin tới pixel:

```
ReferenceInsert { source, ref, label, clipboardText }      (types.ts)
  → Occurrence  { occurrenceId, source, ref, offset, label, clipboardText, invalid? }
  → ChipRender  { occurrenceId, offset, label, invalid }   (decorations.ts)
  → <span class={css.chipLabel}>{chip.label}</span>        (InputBar.tsx:612)
```

`label` là `string` thuần và được render làm text con — không nhận markup,
không có trường icon nào ở bất kỳ tầng nào. `InputTriggerCandidate` **có**
`icon?: string` nhưng đó là dữ liệu của menu, không đi tiếp vào `ReferenceInsert`.

Vậy cái `{}` / `TS` trong ảnh **không thể làm từ plugin**. Muốn có, phải đề
xuất với host hai thay đổi nhỏ, cả hai đều thêm-mới nên tương thích ngược:

1. `ReferenceInsert.icon?: string` → mang qua `Occurrence` → `ChipRender`,
   render thành `<svg><use href={`#${icon}`}/></svg>` trước label. Plugin đã có
   sprite icon theo loại file (`mountSprite()` trong `client/index.ts`), nên id
   là thứ duy nhất cần truyền.
2. Cho chip rộng theo nội dung. Đây mới là phần khó: bề rộng chip bị khoá vào
   advance của `U+FFFC` trong textarea. Hai hướng khả dĩ:
   - Cho `ReferenceInsert` khai một `cells?: number` (1–4), rồi máy chèn đúng
     `cells` ký tự `U+FFFC` liền nhau cho một occurrence. Chip rộng
     `cells × 4em`, textarea vẫn khớp từng ký tự, caret vẫn đúng. Đổi lại,
     logic "xoá cả chip khi xoá placeholder" phải xử lý cụm thay vì một ký tự.
   - Hoặc thêm vài glyph nữa vào `DshChipCell` (8em, 12em) map vào các mã
     private-use, rồi chọn glyph theo độ dài nhãn. Ít xâm lấn hơn cho máy,
     nhưng phải sinh lại font.

   Hướng `cells` sạch hơn về mặt kiểu dữ liệu và không đụng vào font.

Trước khi làm B-4 nên hỏi host team — đây là contract liên package
("changes require main-thread arbitration" ghi ngay đầu `types.ts`).

### B-5 (P1). Mention đang gửi tên file trần, trong khi `@`-menu gửi đường dẫn tương đối

`panels.activePath` là **đường dẫn tuyệt đối** — `ScmPanel.tsx:257` mở file
bằng `` onOpenFile(`${root}/${file.path}`) ``. Nhưng cả bốn call site đều rút
gọn bằng `basename()`:

```ts
const filename = basename(panels.activePath) || panels.activePath
appendToComposer(`@${filename}${lineTag}`)
```

Còn `@`-menu thì gửi `hit.rel` — đường dẫn tương đối so với cwd của session
(`fileSource.ts`, `searchNames`). Hai đường vào cùng một chat cho ra hai dạng
tham chiếu khác nhau, và dạng của Ctrl+L là dạng agent không giải được: repo này
có nhiều file trùng tên giữa các plugin, agent nhận `@rawHtmlLine.ts` thì không
biết là file nào.

Sửa: dùng cwd của session để quy về tương đối, đúng như `fileSource` làm.

```ts
function toWorkspaceRelative(abs: string, cwd: string | undefined): string {
  if (cwd === undefined) return abs
  const root = cwd.endsWith('/') ? cwd : `${cwd}/`
  return abs.startsWith(root) ? abs.slice(root.length) : abs
}
```

`cwd` lấy ở `ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd` — cùng nguồn
`index.ts:269` đang dùng. Vì `AppFrame` không có ctx, nên nên đặt phép quy đổi
này **bên trong reference writer ở `index.ts`** (nơi đã có ctx và đã resolve
session), và cho `ComposerReference` nhận đường dẫn tuyệt đối để writer tự quy.

### B-6 (P1). Chip bắt buộc phải có codec, nếu không submit sẽ hỏng chứ không âm thầm bỏ qua

`controller.ts:237`:

```ts
serializeReference(source, ref, signal) {
  const owner = this.deps.roster.all().find(s => s.name === source)
  if (owner?.codec === undefined) {
    return Promise.reject(new Error(`slash: no serializer for reference source "${source}"`))
  }
  return owner.codec.serialize(ref, signal)
}
```

Bình luận trong contract nói rõ: "Owner missing or codec-less rejects — the
submit attempt blocks instead of silently downgrading to the clipboard text."
Nghĩa là chip mồ côi không phải lỗi hiển thị, mà là **không gửi được tin nhắn**.

Ràng buộc rút ra:

- `source` trong `ComposerReference` **phải** là `'files'` — đúng chuỗi
  `GROUP` trong `fileSource.ts`. Nên export hằng đó ra thay vì gõ lại chuỗi:
  ```ts
  export const FILE_SOURCE = 'files'
  ```
- Đường `@` file source chỉ được đăng ký qua `ctx.inject(['inputTriggers', ...])`.
  Nếu profile không có `ui-input-trigger`, source không tồn tại, mọi chip đều
  reject lúc submit. Reference writer phải kiểm tra trước và trả `false` để
  caller rơi về `appendToComposer` text thường:
  ```ts
  if (ctx.get('inputTriggers') === undefined) return false
  ```
- Codec hiện tại `serialize: ref => Promise.resolve(`@${ref}`)` sẽ nhận nguyên
  chuỗi `src/foo.ts#L47-L55` và trả `@src/foo.ts#L47-L55`. Đó là đúng ý — agent
  thấy cả đường dẫn lẫn khoảng dòng. Không cần sửa codec.

### B-7 (P2). Nội dung vùng chọn không hề được gửi đi

Cursor và Antigravity gửi **cả đoạn text đã chọn** làm ngữ cảnh; chip chỉ là
phần hiển thị của nó. Ở đây `selectedText` được tính đầy đủ trong
`TipTapEditor.tsx:240` và `CodeEditor.tsx:122` rồi... bị vứt đi, chỉ số dòng
sống sót. Agent nhận `@file.md #L47-L55` và phải tự đọc lại file để biết user
đang nói về cái gì — tốn một vòng tool call, và sai nếu file đang dirty (chưa
lưu), vì trên đĩa nội dung khác với trên màn hình.

Điểm nối để sửa nằm sẵn ở `codec.serialize`: nó là async và nhận `ref`. Cho
`ref` mang khoảng dòng (đã làm ở B-1), rồi để codec đọc từ `DocumentRegistry`
— tức là **bản đang hiển thị**, không phải bản trên đĩa:

```ts
serialize: async (ref) => {
  const hash = ref.lastIndexOf('#L')
  if (hash === -1) return `@${ref}`
  const path = ref.slice(0, hash)
  const [a, b] = ref.slice(hash + 2).split('-L')
  const text = (window as any).__dsh_get_active_text?.(path)
  if (typeof text !== 'string') return `@${ref}`
  const lines = text.split('\n').slice(Number(a) - 1, Number(b ?? a))
  return `@${path}#L${a}${b ? `-L${b}` : ''}\n\`\`\`\n${lines.join('\n')}\n\`\`\``
}
```

Cảnh báo: `__dsh_get_active_text` hiện chỉ trả nội dung của **file đang active**
(`Workbench.tsx` bind nó vào `documents.preview(p) ?? registry.getText(p)`).
Chip của một file đã đóng sẽ rơi về `@path#L..`. Chấp nhận được, nhưng nếu muốn
đúng mọi lúc thì codec nên đọc thẳng qua `readFile` khi registry không có.

Cân nhắc trước khi làm: kèm nguyên văn đoạn chọn sẽ phình prompt. Nên giới hạn
(ví dụ ≤ 200 dòng hoặc ≤ 8 KB) và rơi về chỉ-đường-dẫn khi vượt.

---

## Thứ tự làm

1. **A-1** — một mình nó đã giải quyết đúng thứ user kêu. Sửa được ngay, rủi ro
   thấp, không phụ thuộc gì.
2. **A-4** (bỏ fallback `window.getSelection()`), **A-3** (dọn khi đóng tab).
3. **B-1 + B-2 + B-5 + B-6** — làm một cụm. Ra chip thật, đường dẫn đúng, hai
   lối vào chat thống nhất. Không cần đụng host.
4. **B-3** — rút ngắn nhãn cho vừa ô 4em. Làm sau khi B-1 chạy để nhìn thấy độ
   cắt thật rồi chỉnh.
5. **B-7** — gửi kèm nội dung. Đây là thứ tạo ra khác biệt lớn nhất về chất
   lượng câu trả lời của agent.
6. **B-4** — icon + chip co giãn. Cần host đồng ý trước.

## Test nên viết kèm

- `AppFrame` Ctrl+L: có file mở + không selection + panel đang mở → `closeRight`
  được gọi, `appendToComposer` **không** được gọi. Đây là hồi quy của A-1.
- `AppFrame` Ctrl+L: có selection → không gọi `closeRight`, có gọi writer.
- Reference writer: draft rỗng, draft kết thúc bằng space, draft kết thúc bằng
  chữ → đúng một khoảng trắng trước chip trong cả ba trường hợp.
- Reference writer: không có `conversation` / không có session / không có
  `inputTriggers` → trả `false`, không ném.
- `toWorkspaceRelative`: đường dẫn trong cwd, ngoài cwd, cwd có và không có `/`
  ở cuối.
- `shortChipLabel`: tên ngắn, tên dài, một dòng, nhiều dòng — luôn ≤ 12 ký tự.
