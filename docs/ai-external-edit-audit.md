# Audit: AI sửa file đang mở trong editor

Câu hỏi: khi agent trong panel chat ghi vào một file mà workbench đang mở thì
cần làm gì.

Trả lời ngắn: **hiện tại đang mất dữ liệu, im lặng, không có cảnh báo nào.**
Và tín hiệu để sửa thì host đã gửi sẵn qua wire rồi — không cần viết file
watcher.

Mọi kết luận dưới đây đã đối chiếu với source thật: client trong
`plugins/dsh-client-vscode-layout/src`, host route trong
`plugins/dsh-host-files/lib/index.js`, contract của DSH trong `.ref/deepseek-harness`.

---

## Phần C — Hiện trạng

### C-1 (P0). Autosave ghi đè âm thầm lên thay đổi của AI

Ba sự thật ghép lại thành một lỗ mất dữ liệu:

1. `writeFile` là **ghi đè nguyên file, không kiểm tra gì**.
   `workbench/buffers.ts:205`:
   ```ts
   async save(path: string): Promise<ApiResult<void>> {
     const written = buffer.state.doc
     const result = await writeFile(path, written.toString())   // full overwrite
   ```
   Route host (`dsh-host-files/lib/index.js:656`) cũng không có điều kiện nào:
   `stat` rồi `writeFile` thẳng.

2. **Không có bất kỳ cơ chế phát hiện thay đổi ngoài nào.**
   `grep -rn "watch|mtime|Watcher|fs.watch" src/` → **0 kết quả** (ngoài một
   placeholder URL YouTube). `BufferRegistry.reload()` có tồn tại
   (`buffers.ts:137`) nhưng `grep "\.reload("` → **0 caller**. Nó là code chết,
   và đúng là thứ cần dùng.

3. **Autosave 1200ms** (`Workbench.tsx:54`, `AUTOSAVE_MS = 1200`) tự động chạy
   mỗi khi buffer dirty.

Kịch bản mất dữ liệu, không cần user làm gì sai:

```
t0   File X mở trong editor, sạch. diskDoc = nội dung cũ.
t1   User bảo AI "sửa hàm foo trong X". AI ghi X trên đĩa.
t2   Editor không biết gì. Màn hình vẫn nội dung cũ. Tab không có dấu hiệu gì.
t3   User gõ một ký tự → dirty.
t4   +1200ms, autosave: writeFile(X, toàn bộ nội dung CŨ + 1 ký tự).
     → Toàn bộ thay đổi của AI biến mất. Không lỗi, không cảnh báo.
```

Bước t3 không cần là "gõ một ký tự" — bất cứ thứ gì làm buffer dirty đều đủ.
Và nếu autosave tắt, chỉ cần một lần Ctrl+S là ra kết quả y hệt.

Đây không phải chuyện UX. Đây là mất dữ liệu.

### C-2 (P1). File sạch thì cũng không bao giờ tự cập nhật

Cùng gốc với C-1. Buffer sạch, AI sửa file → editor hiển thị nội dung cũ **vĩnh
viễn**, cho tới khi user đóng tab rồi mở lại. Người dùng đọc một phiên bản
không còn tồn tại và tưởng AI chưa làm gì.

### C-3 (P2). Git badge và SCM panel cũng lệch

`explorer/ScmPanel.tsx` chỉ `refresh()` khi mount hoặc khi user bấm nút; git
badge trong `FileTree` cũng vậy (`refreshGit`). Sau khi AI sửa 5 file, cây file
vẫn xanh sạch. `FileTree` đã có handle `refresh()` imperative
(`FileTree.tsx:79`) nên cái này rẻ nhất trong ba cái.

---

## Phần D — Tín hiệu: đừng viết file watcher

### D-1. Host đã gửi sẵn diff qua wire

Đây là phát hiện quan trọng nhất của lần audit này.

Mỗi tool call `write`/`edit` khi settle đều mang theo một **render intent** dạng
`card: 'diff'`, và trong đó là các hunk đã áp dụng thật:

`.ref/deepseek-harness/packages/client/ui-tool/src/client/tool/models/diff-card-model.ts:53`

```ts
const { path, oldText, newText } = hunk as Record<string, unknown>
```

Doc của chính file đó nói rõ ai là nguồn đúng:

> "The result side is authoritative once the call settles: the write/edit tools
> return the applied contextual hunks there (an edit's real before/after, a
> create's whole-file diff)".

Nghĩa là ta có **nhiều hơn** một file watcher đưa được:

| file watcher cho ta | wire diff cho ta |
|---|---|
| "file X vừa đổi" | "file X vừa đổi" |
| — | **đổi đúng chỗ nào** (`oldText` → `newText`) |
| — | **`oldText` để đối chiếu conflict** |
| phải poll / inotify | push, không tốn gì |
| có độ trễ, có debounce | đến đúng lúc call settle |
| bắt cả thay đổi của chính mình → vòng lặp | chỉ thay đổi của agent |

`oldText` là thứ quý nhất: nó cho phép trả lời câu hỏi "user có sửa đúng vùng
AI vừa sửa không" mà không cần đọc lại đĩa.

### D-2. Cách subscribe từ plugin

Chuỗi face, tất cả đều là contract công khai:

```
ctx.sessions                                  ISessions
  .sessionOf(actx)                            → SessionFace | undefined
SessionFace = ISession & ObservableSnapshot<ConversationSnapshot>
  .subscribe(fn) / .getSnapshot()             (contract/store.ts:27)
ConversationSnapshot.nodes: ConversationNode[]  (sessions/conversation.ts:440)
  → ToolResultNode { kind:'tool-result', callId, call:{name,argsRaw}, resultView }
     resultView.card === 'diff' → resultView.diffs
```

Code cụ thể, đặt cạnh reference writer đã có ở `client/index.ts`:

```ts
ctx.effect(() => {
  let stop: (() => void) | undefined
  const rebind = () => {
    stop?.()
    const sessionId = ctx.sessions.list.getSnapshot().current
    if (sessionId === undefined) { stop = undefined; return }
    const actx = ctx.sessions.scope(sessionId)
    const face = actx === undefined ? undefined : ctx.sessions.sessionOf(actx)
    if (face === undefined) { stop = undefined; return }
    stop = face.subscribe(() => { drainDiffs(face.getSnapshot()) })
    drainDiffs(face.getSnapshot())
  }
  const off = ctx.sessions.list.subscribe(rebind)   // đổi session thì rebind
  rebind()
  return () => { off(); stop?.() }
}, 'vscode-layout: watch agent file writes')
```

Bốn cái bẫy phải xử lý trong `drainDiffs`:

1. **Snapshot republish rất nhiều lần.** Mỗi chunk streaming đều bump. Phải
   dedupe theo `callId` (`ToolResultNode.callId` là identity ổn định do host
   mint) trong một `Set` sống theo đời của effect. Không dedupe = reload editor
   hàng chục lần một turn.

2. **`subCalls`.** `ToolResultNode.subCalls` chứa call con (subagent). Một
   subagent ghi file thì hunk nằm trong đó, không nằm ở tầng ngoài. Phải duyệt
   đệ quy.

3. **Dạng đường dẫn.** `hunk.path` đến từ host agent, chưa chắc cùng dạng với
   `panels.activePath` (đường dẫn tuyệt đối — xem `ScmPanel.tsx:257`). Phải
   chuẩn hoá cả hai về một dạng trước khi so, dùng cwd của session như
   `fileSource.ts` đang làm. So sai = bỏ sót thay đổi, tức là quay lại C-1.

4. **Không phải mọi thay đổi đều có diff card.** `classifyTool`
   (`tool-call-model.ts`) chỉ map `write` và `edit`. Agent chạy `bash` với
   `sed -i`, `mv`, `git checkout`, `npm run format` — tất cả đều sửa file mà
   **không** sinh hunk nào. Vì vậy D-1 là đường nhanh và chính xác, **không phải
   lưới an toàn**. Lưới an toàn là Phần F.

### D-3. Có sẵn một WebSocket đang chạy, và nó đang không được dùng

`dsh-host-files/lib/index.js:47` có nguyên một "Real-time Collaboration Engine
(Yjs + WebSocket)", route `GET /vscode-files/collab-info → { wsPort, wsUrl }`,
và `node_modules` của nó có `yjs`, `y-protocols`, `ws`.

Phía client: `grep -rn "collab-info|yjs|Y.Doc|WebsocketProvider" src/` → **0 kết
quả**, và `package.json` của client **không có** `yjs`.

Tức là hạ tầng push đã tồn tại và đang chạy không tải. Nếu sau này cần đường
"file trên đĩa đổi" tổng quát (Phần F-2), kênh đã có sẵn, không phải dựng mới.
Nhưng đừng vội mừng: dùng Yjs làm CRDT cho editor là một dự án khác hẳn, không
phải thứ giải quyết câu hỏi này.

---

## Phần E — Xử lý theo trạng thái buffer

Khi biết file X vừa bị AI sửa, quyết định phụ thuộc **trạng thái buffer**, và
mỗi trạng thái là một bài toán khác nhau.

| trạng thái | xử lý | rủi ro |
|---|---|---|
| Không mở | không làm gì (chỉ refresh git badge) | không |
| Mở, sạch | adopt luôn, không hỏi | mất caret / undo — xem E-2 |
| Mở, dirty, AI sửa vùng khác | merge tự động | thấp, có sẵn máy móc |
| Mở, dirty, đụng nhau | hỏi user | phải có UI |

### E-1 (P0). Đóng băng autosave ngay khi biết có write đang chạy

Làm **trước** mọi thứ khác, vì nó chặn C-1 mà không cần merge đúng.

`ConversationSnapshot.runningCalls` cho biết call **đang chạy** kèm `argsRaw`.
Parse `argsRaw` lấy `file_path`/`path` → biết AI *sắp* ghi vào đâu, trước khi nó
ghi xong. Ngay lúc đó:

```ts
saveQueue.hold(path)     // huỷ timer autosave đang chờ, chặn timer mới
```

và thả ra sau khi đã reconcile xong (hoặc sau khi user quyết định ở E-4).

`SaveQueue` đã có `#autosaveTimers` và `#cancelAutosave` private — thêm một
`#held: Set<string>` và một điều kiện trong `reconcileAutosave` là đủ:

```ts
for (const path of dirtyPaths) {
  if (this.#held.has(path)) continue          // <-- thêm
  if (this.#autosaveTimers.has(path)) continue
  ...
}
```

Và `enqueue` cũng phải từ chối khi bị hold, nếu không Ctrl+S thủ công vẫn lọt.

Lưu ý: `argsRaw` là chuỗi JSON thô do model sinh, **có thể hỏng**. Parse trong
`try/catch`, hỏng thì bỏ qua — hold nhầm còn hơn không hold, nhưng ném thì làm
chết cả effect.

### E-2 (P1). Buffer sạch không có nghĩa là adopt được miễn phí

Với file thường (CodeMirror) thì `registry.reload(path)` là đúng và rẻ.

Với **markdown** thì không. Đường duy nhất hiện có là
`documents.reopen(path, text)` — và doc của chính nó cảnh báo:

`tiptap/documents.ts:245`
> "adopting new text throws away the undo history, so it has to be something a
> caller asks for by name rather than something that can happen by accident"

`reopen` = `forget()` + `open()` + `attach()`. Cái mất đi:

- **undo history** — user không Ctrl+Z được thay đổi của AI. Cursor thì được.
- **vị trí caret và selection**
- **vị trí cuộn**
- **trạng thái fold** của các heading (`HeadingFoldPlugin` giữ state trong
  plugin state, chết theo editor)

Nếu AI sửa một dòng ở cuối file dài, user đang đọc giữa file, thì `reopen` quăng
họ về đầu tài liệu. Với một turn agent sửa 5 file thì đó là 5 lần bị quăng.

**Cách làm đúng** (khó hơn nhưng là thứ tạo ra khác biệt): AI đã cho `oldText` và
`newText`. Thay vì reopen, dựng văn bản mới rồi **áp bằng một transaction** lên
editor đang sống:

```ts
// 1. Lấy nguồn hiện tại của tài liệu (đúng bytes trên đĩa mà editor đang giữ)
const before = documents.source(path)                   // documents.ts:407
// 2. Áp hunk
const after = applyHunks(before, hunks)                 // oldText -> newText
// 3. Parse ra ProseMirror doc bằng ĐÚNG pipeline đang dùng
//    (splitFrontmatter + encodeRawHtmlLines + parse) — nếu không, frontmatter
//    và opaque line sẽ bị phá đúng như các lỗi đã sửa vòng trước.
// 4. Diff hai doc và dispatch một transaction thay vì thay cả editor
```

Bước 4 là phần phải viết mới. Nhưng đổi lại: undo giữ nguyên (Ctrl+Z hoàn tác
được thay đổi của AI — đúng hành vi Cursor), caret được ProseMirror tự map qua
`tr.mapping`, fold state sống sót vì plugin state không bị huỷ.

**Đề xuất chia hai bước.** Bước 1 dùng `reopen` cho xong C-1/C-2 (mất undo,
chấp nhận, nhưng phải khôi phục caret bằng cách map offset qua diff và cuộn lại
đúng chỗ). Bước 2 làm transaction thật. Đừng gộp — bước 1 là chặn mất dữ liệu,
cần ra sớm; bước 2 là chất lượng, không gấp.

### E-3 (P1). Buffer dirty: máy móc merge đã có sẵn, đừng viết lại

`tiptap/reconcile.ts` sinh ra đúng để làm việc này: nó nhận
`{ originalSource, baseCanonical, edited, roundTrip }`, diff phần canonical rồi
**replay diff đó lên bytes gốc trên đĩa**, có bước re-parse để chứng minh kết
quả vẫn đúng nghĩa, và fallback về canonical khi không chứng minh được.

Đó chính xác là hình dạng của bài toán merge ba chiều ở đây:

```
originalSource  = bytes trên đĩa TRƯỚC khi AI sửa   (documents.source(path))
edited          = bản của AI                        (after = applyHunks(...))
                  và bản của user                   (documents.markdown(path))
```

Không cần thư viện merge mới. Nhưng có hai ràng buộc phải tôn trọng:

- **Cap 120 KB.** `RECONCILE_SIZE_CAP_CODE_UNITS = 120_000` — trên ngưỡng đó
  reconcile bỏ cuộc và rơi về canonical. File lớn thì phải đi nhánh E-4 (hỏi
  user) chứ không im lặng merge sai.
- **Fallback là "canonical hoá cả file"**, tức là diff to. Với merge thì fallback
  đó không chấp nhận được — nó ghi đè định dạng gốc của phần AI vừa viết. Nhánh
  merge phải coi fallback = thất bại và chuyển sang E-4.

### E-4 (P1). Đụng nhau: UI đã có, chỉ thiếu người gọi

`workbench/Workbench.tsx:587` đã render một `DiffView` với `onAccept` /
`onDiscard`, hiện chỉ dùng cho "xem trước thay đổi trước khi lưu". Cùng component
đó dùng lại được cho xung đột: bên trái bản của AI, bên phải bản của user.

Ba lựa chọn phải cho user, không được ít hơn:
- **Giữ bản của tôi** (ghi đè AI — nhưng phải cảnh báo rõ là mất thay đổi của AI)
- **Lấy bản của AI** (mất thay đổi chưa lưu của user)
- **Lưu bản của tôi ra file khác** rồi lấy bản AI — cái này Cursor không có và
  là lối thoát duy nhất khi user không muốn mất bên nào

Cách phát hiện đụng nhau, dùng `oldText`: với mỗi hunk, tìm `oldText` trong
`documents.source(path)`; nếu vùng đó **nằm trong** phạm vi user đã sửa (so
`documents.markdown(path)` với `documents.source(path)`) thì là xung đột. Nếu
không, merge tự động ở E-3.

---

## Phần F — Lưới an toàn ở tầng ghi (bắt buộc, độc lập với D)

D-1 chỉ bắt được `write`/`edit`. Còn `bash sed -i`, `git checkout`, `mv`, một
agent khác, một editor khác, hay chính user sửa file bằng vim ở terminal — không
gì trong số đó sinh diff card. Nếu chỉ làm Phần D, C-1 vẫn còn nguyên với những
đường đó.

### F-1 (P0). `write` phải có CAS theo mtime

Đây là thay đổi nhỏ nhất trong cả tài liệu này và bịt được **mọi** đường ghi
ngoài cùng lúc.

Host **đã stat sẵn** ở cả hai route, chỉ là không dùng:

```js
// lib/index.js:864  — route read
const info = await stat(target);
return sendJson(res, 200, { ok: true, kind: "text", content: text, size: info.size });
//                                                    ^ info.mtimeMs có đây, không gửi

// lib/index.js:668  — route write
const info = await stat(writePath).catch(() => void 0);
if (info !== void 0 && info.isDirectory()) return ...
await writeFile(writePath, content, "utf8");
//  ^ không so gì với info.mtimeMs
```

Sửa:

```js
// read: thêm một field
return sendJson(res, 200, { ok: true, kind, content, size: info.size, mtimeMs: info.mtimeMs });

// write: thêm một guard
const expected = body?.expectedMtimeMs;
if (typeof expected === "number" && info !== void 0 && info.mtimeMs !== expected) {
  return sendJson(res, 409, {
    ok: false, error: "file changed on disk", conflict: true, mtimeMs: info.mtimeMs,
  });
}
```

Phía client: `FileContent` thêm `mtimeMs`, `BufferStatus.text` giữ lại, và
`buffers.save()` gửi kèm. Nhận 409 thì **không** báo "save failed" chung chung —
đi thẳng vào nhánh E-4.

`expectedMtimeMs` để optional nên tương thích ngược: caller cũ không gửi thì
hành vi y như bây giờ.

**Cảnh báo về nguồn.** `plugins/dsh-host-files` trong repo này chỉ có `lib/`
(bundle đã build) và `package.json`, không có `src/`. Phải tìm nguồn thật trước
khi sửa; vá thẳng vào `lib/index.js` sẽ bị build sau ghi đè.

**Cảnh báo về độ phân giải.** mtime trên một số filesystem chỉ tới giây. Hai lần
ghi trong cùng một giây có thể cho mtime bằng nhau. Nếu cần chắc hơn thì so cặp
`(mtimeMs, size)`, hoặc hash nội dung — nhưng `(mtimeMs, size)` đủ cho mọi
trường hợp thực tế ở đây và không tốn gì.

### F-2 (P2). Kiểm tra lại khi tab được focus

Rẻ và bắt được phần lớn phần còn lại: khi tab được chọn hoặc cửa sổ lấy lại
focus, gọi `read` cho path đang active, so `mtimeMs` với cái đã lưu. Lệch →
chạy đúng luồng Phần E. Không cần watcher, không cần WebSocket.

---

## Phần G — UX

Chuẩn đối chiếu: VS Code và Cursor đều **không** hiện modal chặn khi file đổi
bên ngoài. Buffer sạch → cập nhật im lặng. Buffer dirty → thanh thông báo trong
tab, user tự chọn lúc nào xử lý.

Đề xuất, theo thứ tự xâm lấn tăng dần:

1. **Chấm trên tab** — file này vừa bị AI sửa, khác màu với chấm dirty.
2. **Toast gộp** khi turn kết thúc (`snapshot.running` chuyển false):
   "AI đã sửa 3 file" + nút "Xem thay đổi". **Đợi turn xong rồi mới toast** —
   một turn agent sửa 20 lần thì 20 toast là không dùng được.
3. **Thanh trong editor** chỉ khi có xung đột thật: "File này đã bị AI sửa trong
   lúc bạn đang chỉnh. [Xem khác biệt] [Giữ bản của tôi] [Lấy bản AI]".
4. **Không bao giờ** modal chặn. User đang gõ dở, bị chặn giữa chừng là mất mạch.

Về nhấp nháy: nếu đi đường "adopt im lặng khi sạch", cũng phải debounce theo turn
— reload editor 20 lần trong 30 giây làm màn hình giật liên tục và cuộn nhảy
loạn. Gom theo `callId` đã thấy, áp một lần khi turn kết thúc, trừ khi file đó
không mở trên màn hình (lúc đó áp ngay cũng không ai thấy).

---

## Thứ tự làm

1. **E-1** — đóng băng autosave khi thấy write đang chạy. Ít code nhất, chặn
   được kịch bản mất dữ liệu phổ biến nhất. Làm trước cả khi merge còn chưa đúng.
2. **F-1** — CAS mtime ở route write. Bịt mọi đường ghi ngoài, kể cả những đường
   Phần D không thấy. Cần tìm nguồn của `dsh-host-files` trước.
3. **D-1 + D-2** — subscribe diff qua wire, dedupe theo `callId`, chuẩn hoá path.
4. **E-2 bước 1** — buffer sạch thì `reload`/`reopen`, có khôi phục caret.
   Giải quyết C-2.
5. **G-1, G-2** — chấm trên tab, toast gộp cuối turn.
6. **E-3 + E-4** — merge tự động khi không đụng, DiffView khi đụng.
7. **E-2 bước 2** — áp thay đổi bằng transaction thay vì reopen. Giữ undo, caret,
   fold. Đây là bước biến nó từ "chấp nhận được" thành "giống Cursor".
8. **C-3, F-2** — refresh git badge, kiểm tra lại khi focus.

## Test nên viết kèm

- **Hồi quy C-1**, quan trọng nhất: mở file, giả lập AI ghi, gõ một ký tự, đợi
  quá `AUTOSAVE_MS` → nội dung trên đĩa **phải** còn thay đổi của AI.
- `SaveQueue.hold`: path bị hold thì `reconcileAutosave` không tạo timer, timer
  đang chờ bị huỷ, `enqueue` từ chối; thả ra thì timer mới lên bình thường.
- `drainDiffs`: cùng một `callId` xuất hiện 10 lần trong 10 snapshot → chỉ áp 1
  lần. Hunk trong `subCalls` → vẫn thấy. `argsRaw` là JSON hỏng → không ném.
- Chuẩn hoá path: hunk path tương đối vs `activePath` tuyệt đối → khớp đúng.
- CAS mtime: write với `expectedMtimeMs` cũ → 409, buffer không bị đánh dấu sạch.
- Merge: AI sửa dòng 10, user sửa dòng 200 → tự merge, cả hai còn. AI và user
  cùng sửa dòng 10 → báo xung đột, không tự chọn bên nào.
- Markdown giữ nguyên các bảo đảm vòng trước: file có frontmatter và opaque line
  (`<!-- -->`, `[^1]:`) đi qua luồng adopt vẫn round-trip byte-for-byte.
