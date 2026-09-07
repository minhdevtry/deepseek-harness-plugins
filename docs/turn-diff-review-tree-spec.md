# Đặc Tả Kỹ Thuật: Cụm Turn Diff Review Tree & Bộ Rich Media Previews (PDF, Font, Media)

> **Tài liệu nghiên cứu kiến trúc & thiết kế kỹ thuật (Technical Specification & Action Plan)**  
> **Nguồn tham khảo chính:** `ref/stagewise`  
> - Cụm Turn Diff & Review: `turn-file-edits.tsx`, `turn-file-edits-utils.ts`, `diff-line-stats.tsx`, `revert-confirm-popover.tsx`, `file-tree-node-row.tsx`  
> - Cụm Rich Media Previews: `apps/browser/src/ui/components/file-preview/previews/` (`pdf.tsx`, `font.tsx`, `audio.tsx`, `video.tsx`)  
> **Dự án áp dụng:** `deepseek-harness-plugins` (`plugins/dsh-client-vscode-layout` & `plugins/dsh-host-files`)  
> **Ngày lập:** 2026-09-07  
> **Quy ước phiên:** Phiên hiện tại hoàn tất nghiên cứu & chốt tài liệu đặc tả; phiên tiếp theo triển khai code theo lộ trình.

---

## MỤC LỤC
1. [TỔNG QUAN HAI TRỤ CỘT NÂNG CẤP (TWO PILLARS)](#1-tổng-quan-hai-trụ-cột-nâng-cấp)
2. [TRỤ CỘT 1: TURN DIFF REVIEW TREE & REJECT/ACCEPT ALL TRONG CHAT](#2-trụ-cột-1-turn-diff-review-tree--rejectaccept-all)
   - [2.1. Hiện trạng & Nhược điểm của TurnReviewCard hiện tại](#21-hiện-trạng--nhược-điểm)
   - [2.2. Phân tích chi tiết cách làm của Stagewise](#22-phân-tích-cách-làm-của-stagewise)
   - [2.3. Thiết kế kiến trúc mục tiêu cho DSH](#23-thiết-kế-kiến-trúc-mục-tiêu-cho-dsh)
   - [2.4. Thuật toán phân cấp cây thư mục (turnTree.ts)](#24-thuật-toán-phân-cấp-cây-thư-mục)
   - [2.5. Chi tiết Component & Styling](#25-chi-tiết-component--styling)
3. [TRỤ CỘT 2: BỘ RICH MEDIA PREVIEWS (PDF, FONT, AUDIO, VIDEO)](#3-trụ-cột-2-bộ-rich-media-previews)
   - [3.1. Hiện trạng xử lý file nhị phân trong Workbench](#31-hiện-trạng-xử-lý-file-nhị-phân)
   - [3.2. Phân tích chi tiết cách làm của Stagewise](#32-phân-tích-cách-làm-của-stagewise-previews)
   - [3.3. Thiết kế kiến trúc mục tiêu cho DSH](#33-thiết-kế-kiến-trúc-mục-tiêu-cho-dsh-previews)
   - [3.4. Chi tiết các Previews mới (PDF, Font, Audio/Video)](#34-chi-tiết-các-previews-mới)
   - [3.5. Cập nhật Backend Host Files (MIME Streaming)](#35-cập-nhật-backend-host-files)
4. [KẾ HOẠCH TRIỂN KHAI PHIÊN TIẾP THEO (STEP-BY-STEP ROADMAP)](#4-kế-hoạch-triển-khai-phiên-tiếp-theo)

---

# 1. TỔNG QUAN HAI TRỤ CỘT NÂNG CẤP

Dựa trên nghiên cứu toàn diện từ repository tham khảo **Stagewise** (`ref/stagewise`), hai nâng cấp có giá trị trải nghiệm người dùng (UX) cao nhất đối với IDE **DeepSeek Harness Plugins** là:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                           DEEPSEEK HARNESS PLUGINS                           │
├──────────────────────────────────────────────┬───────────────────────────────┤
│                  TRỤ CỘT 1                   │           TRỤ CỘT 2           │
│   Turn Diff Review Tree & Reject/Accept All  │      Bộ Rich Media Previews   │
│             (In-Chat Experience)             │     (Workbench Tab Experience)│
├──────────────────────────────────────────────┼───────────────────────────────┤
│ • Cây thư mục thay đổi (Tree View)           │ • PDF Viewer trực tiếp        │
│ • Thống kê dòng +added / -removed phân cấp   │ • Font Typography Tester      │
│ • Mở rộng / thu gọn (Expand / Collapse All)  │ • Audio / Video Player        │
│ • Chấp nhận / hoàn tác từng file hoặc folder │ • Tự động nhận diện MIME type │
│ • Dialog xác nhận hoàn tác an toàn           │ • Hết báo lỗi "Binary file"   │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

---

# 2. TRỤ CỘT 1: TURN DIFF REVIEW TREE & REJECT/ACCEPT ALL

## 2.1. Hiện trạng & Nhược điểm
Trong `plugins/dsh-client-vscode-layout/src/client/chat/TurnReviewCard.tsx`:
- **Danh sách phẳng (Flat list):** Khi AI sửa 5-10 files trong nhiều module khác nhau, danh sách hiển thị dài lượt thượt, không rõ ngữ cảnh thư mục.
- **Không có thống kê dòng theo folder:** Người dùng không biết thay đổi tập trung ở đâu.
- **Hành động thô sơ:** Chỉ có 2 nút *"Giữ toàn bộ lượt"* hoặc *"Hoàn tác lượt này"*. Không thể duyệt từng file hay từng folder.
- **Thiếu an toàn:** Nút hoàn tác ghi đè ngay lập tức vào đĩa mà không có bước xác nhận.

## 2.2. Phân tích cách làm của Stagewise
1. **Thuật toán `buildTurnFileTree` (`turn-file-edits-utils.ts`):**
   - Phân tích `path` theo dấu `/`, gom nhóm theo folder key.
   - Cộng dồn số dòng `added` và `removed` từ các file lá lên các node folder cha.
   - Sắp xếp Folder luôn đứng trước File, theo thứ tự alphabet.
2. **Hiển thị hàng cây (`FileTreeNodeRow.tsx`):**
   - Độ thụt lề: `style={{ paddingLeft: 4 + depth * 14 }}` trên thẻ phẳng `button` giúp DOM cực kỳ nhẹ.
   - Mũi tên chevron xoay 90 độ khi mở folder.
   - Badge `DiffLineStats.tsx` font monospace tabular-nums (`+added` xanh lá, `-removed` đỏ).
3. **Cơ chế xác nhận an toàn (`revert-confirm-popover.tsx`):**
   - Trước khi hoàn tác (revert file disk write), mở popover hỏi *"Keep or revert files?"*.

## 2.3. Thiết kế kiến trúc mục tiêu cho DSH
Chúng ta tận dụng API đã sẵn sàng trong `reviewCommands.ts`:
- `summaryForTurn(turnId): ReviewFileSummary[]`
- `acceptAll(path): void`
- `rejectAll(path): Promise<void>`

Cấu trúc component mới:
```text
plugins/dsh-client-vscode-layout/src/client/chat/
├── TurnReviewCard.tsx              # Component card chính
├── TurnReviewCard.module.css       # Style Notion-grade glassmorphism
├── turnTree.ts                     # Thuật toán pure function buildReviewTree
├── TurnTreeRow.tsx                 # Render từng dòng cây thư mục hoặc file
├── TurnTreeRow.module.css          # Style dòng cây & nút hover actions
└── DiffLineStats.tsx               # Badge monospace tabular +added -removed
```

## 2.4. Thuật toán phân cấp cây thư mục (`turnTree.ts`)
```typescript
export interface ReviewFileSummary {
  path: string
  added: number
  removed: number
}

export type ReviewTreeNode =
  | {
      kind: 'folder'
      id: string              // "src/client/chat"
      name: string            // "chat"
      depth: number
      added: number
      removed: number
      children: ReviewTreeNode[]
      allFilePaths: string[]  // Phục vụ accept/reject toàn bộ folder
    }
  | {
      kind: 'file'
      id: string
      name: string
      depth: number
      added: number
      removed: number
      path: string
    }

export interface ReviewTreeResult {
  nodes: ReviewTreeNode[]
  folderIds: string[]
  totalAdded: number
  totalRemoved: number
  totalFiles: number
}

export function buildReviewTree(files: ReviewFileSummary[], workspaceRoot?: string): ReviewTreeResult {
  let totalAdded = 0
  let totalRemoved = 0
  const folderIds: string[] = []

  interface MutableFolderNode {
    kind: 'folder'
    id: string
    name: string
    depth: number
    added: number
    removed: number
    children: (MutableFolderNode | Extract<ReviewTreeNode, { kind: 'file' }>)[]
    allFilePaths: string[]
  }

  const root: MutableFolderNode = {
    kind: 'folder',
    id: '',
    name: '',
    depth: -1,
    added: 0,
    removed: 0,
    children: [],
    allFilePaths: []
  }

  const foldersById = new Map<string, MutableFolderNode>()

  for (const file of files) {
    totalAdded += file.added
    totalRemoved += file.removed

    let relPath = file.path
    if (workspaceRoot && relPath.startsWith(workspaceRoot)) {
      relPath = relPath.slice(workspaceRoot.length).replace(/^[/\\]+/, '')
    }
    relPath = relPath.replace(/\\/g, '/')

    const segments = relPath.split('/').filter(Boolean)
    const fileName = segments.pop() || relPath

    let currentParent = root
    currentParent.allFilePaths.push(file.path)

    let currentPath = ''
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      currentPath = currentPath ? `${currentPath}/${seg}` : seg

      let folder = foldersById.get(currentPath)
      if (!folder) {
        folder = {
          kind: 'folder',
          id: currentPath,
          name: seg,
          depth: i,
          added: 0,
          removed: 0,
          children: [],
          allFilePaths: []
        }
        foldersById.set(currentPath, folder)
        folderIds.push(currentPath)
        currentParent.children.push(folder)
      }

      folder.added += file.added
      folder.removed += file.removed
      folder.allFilePaths.push(file.path)
      currentParent = folder
    }

    currentParent.children.push({
      kind: 'file',
      id: file.path,
      name: fileName,
      depth: segments.length,
      added: file.added,
      removed: file.removed,
      path: file.path
    })
  }

  function sortNodes(nodes: (MutableFolderNode | Extract<ReviewTreeNode, { kind: 'file' }>)[]) {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const node of nodes) {
      if (node.kind === 'folder') sortNodes(node.children)
    }
  }

  sortNodes(root.children)

  return {
    nodes: root.children as ReviewTreeNode[],
    folderIds,
    totalAdded,
    totalRemoved,
    totalFiles: files.length
  }
}
```

## 2.5. Chi tiết Component & Styling
- **Header Bar:** Hiển thị `Changed files (N)`, nút `Expand/Collapse All`, và badge tổng `DiffLineStats`.
- **Tree Rows:** 
  - Tái sử dụng `FileIcon` (`fileIconId`, `dirIconId`) từ explorer sprite.
  - Hover row hiện 2 nút micro-action: `[✓]` (Accept) và `[✕]` (Reject).
- **Confirmation Dialog:** Sử dụng `client/ui/Dialog.tsx` có sẵn để xác nhận hoàn tác file/lượt.

---

# 3. TRỤ CỘT 2: BỘ RICH MEDIA PREVIEWS (PDF, FONT, AUDIO, VIDEO)

## 3.1. Hiện trạng xử lý file nhị phân trong Workbench
Trong `Workbench.tsx` (dòng 901-903):
```tsx
{!isImage && status?.kind === 'binary' && (
  <div className={css.notice}>Binary file — no preview ({status.size.toLocaleString()} bytes).</div>
)}
```
Bất kỳ file nào ngoài ảnh (PNG, JPG, GIF, WebP, SVG, ICO) đều bị coi là file nhị phân không hỗ trợ xem trước, gây khó khăn lớn cho lập trình viên khi làm việc với tài liệu thiết kế (Font, PDF) hoặc asset đa phương tiện (Audio, Video).

## 3.2. Phân tích cách làm của Stagewise
Trong `ref/stagewise/apps/browser/src/ui/components/file-preview/previews/`:
1. **PDF Preview (`pdf.tsx` & `pdf-expanded.tsx`):**
   - Sử dụng thẻ nhúng trình duyệt: `<embed src={src} type="application/pdf" className="size-full" />`.
   - Trình duyệt tích hợp sẵn Chromium PDF Plugin giúp zoom, in ấn, tìm kiếm từ khóa cực kỳ mượt mà mà không tốn dung lượng JS bundle.
2. **Font Preview (`font.tsx` & `font-expanded.tsx`):**
   - Sử dụng native Web API `FontFace`:
     ```typescript
     const family = `preview-font-${instanceId}`
     const fontFace = new FontFace(family, `url(${src})`)
     await fontFace.load()
     document.fonts.add(fontFace)
     ```
   - Render:
     - Câu Pangram: *"The quick brown fox jumps over the lazy dog"*
     - Bảng chữ cái Alphabet hoa/thường: `AaBbCc...`
     - Bảng chữ số: `0123456789`
     - Clean-up: Khi unmount, tự động gọi `document.fonts.delete(fontFace)` tránh rò rỉ bộ nhớ.
3. **Audio Preview (`audio.tsx` & `audio-expanded.tsx`):**
   - Render thẻ HTML5 `<audio src={src} controls />` kèm thanh điều khiển thời lượng, âm lượng, tốc độ phát.
4. **Video Preview (`video.tsx` & `video-expanded.tsx`):**
   - Render thẻ HTML5 `<video src={src} controls playsInline />` hỗ trợ Picture-in-Picture và toàn màn hình.

## 3.3. Thiết kế kiến trúc mục tiêu cho DSH

```text
plugins/dsh-client-vscode-layout/src/client/workbench/previews/
├── ImagePreview.tsx             # (Đã có) Xem ảnh PNG/JPG/SVG/WebP/ICO
├── CsvPreview.tsx               # (Đã có) Xem bảng tính CSV
├── HtmlPreview.tsx              # (Đã có) Xem trước web HTML
├── PdfPreview.tsx               # [MỚI] Xem trước PDF tài liệu & báo cáo
├── PdfPreview.module.css        # [MỚI] Styling cho PDF Viewer
├── FontPreview.tsx              # [MỚI] Trình kiểm thử Typography Font chữ
├── FontPreview.module.css       # [MỚI] Styling cho Font Tester
├── MediaPreview.tsx             # [MỚI] Trình phát Audio & Video
└── MediaPreview.module.css      # [MỚI] Styling cho Audio/Video
```

## 3.4. Chi tiết các Previews mới

### 1. `PdfPreview.tsx`
- **Props:** `{ path: string; size?: number }`
- **Cơ chế:** URL nguồn lấy từ backend host: `/vscode-files/raw?path=${encodeURIComponent(path)}`.
- **Giao diện:**
  - Toolbar trên cùng: Tên file, dung lượng (KB/MB), nút mở ngoài (`Open in default app`), nút copy đường dẫn.
  - Vùng xem: `<embed src={src} type="application/pdf" className={css.pdfEmbed} />`.

### 2. `FontPreview.tsx` (Typography Tester)
- **Props:** `{ path: string; size?: number }`
- **Hỗ trợ định dạng:** `.woff2`, `.woff`, `.ttf`, `.otf`
- **Tính năng độc quyền vượt trội:**
  - Tự động nạp font qua `new FontFace()`.
  - Hiển thị Pangram & Alphabet.
  - **Interactive Tester:** Hộp nhập văn bản tùy ý cho phép người dùng tự gõ chữ tiếng Việt (có dấu) để kiểm tra font có bị lỗi ký tự (tofu) hay không.
  - **Font Size Slider:** Thanh trượt điều chỉnh kích cỡ font trực tiếp từ `12px` đến `72px`.

```tsx
export function FontPreview({ path, size }: { path: string; size?: number }) {
  const [fontSize, setFontSize] = useState(24)
  const [customText, setCustomText] = useState('')
  const src = `/vscode-files/raw?path=${encodeURIComponent(path)}`
  const { fontFamily, loading, error } = useFontFace(src)
  // Render Pangram, Alphabet, Digits, and Editable Test Area
}
```

### 3. `MediaPreview.tsx` (Audio / Video)
- **Props:** `{ path: string; size?: number; type: 'audio' | 'video' }`
- **Hỗ trợ định dạng:**
  - Audio: `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`
  - Video: `.mp4`, `.webm`, `.mov`, `.ogg`
- **Giao diện:** Player responsive căn giữa, nền tối thanh lịch, hiển thị time-scrubber và controls chuẩn.

## 3.5. Cập nhật Backend Host Files
Trong `plugins/dsh-host-files/lib/index.js`, cập nhật danh mục MIME type tại endpoint `/vscode-files/raw`:
```javascript
const mimeMap = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  bmp: "image/bmp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  pdf: "application/pdf",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf"
};
```

---

## 3.6. Định tuyến trong `Workbench.tsx`
Cập nhật hàm nhận diện loại file trong `Workbench.tsx`:
```typescript
const isImage = activePath !== undefined && /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i.test(activePath)
const isCsv = activePath !== undefined && /\.csv$/i.test(activePath)
const isHtml = activePath !== undefined && /\.(html|htm)$/i.test(activePath)
const isPdf = activePath !== undefined && /\.pdf$/i.test(activePath)
const isFont = activePath !== undefined && /\.(woff2?|ttf|otf)$/i.test(activePath)
const isAudio = activePath !== undefined && /\.(mp3|wav|ogg|m4a|flac)$/i.test(activePath)
const isVideo = activePath !== undefined && /\.(mp4|webm|mov)$/i.test(activePath)
```
Và render component tương ứng trong thẻ `body`, loại bỏ thông báo `Binary file — no preview` cho các định dạng trên.

---

# 4. KẾ HOẠCH TRIỂN KHAI PHIÊN TIẾP THEO (ACTION PLAN)

Lộ trình triển khai ở phiên tới sẽ gồm 5 bước tuần tự, an toàn và dễ kiểm soát:

```text
  BƯỚC 1: TRỤ CỘT 1 - CORE LOGIC & UNIT TESTS (TDD)
  ├── Viết `plugins/dsh-client-vscode-layout/src/client/chat/turnTree.ts`
  └── Viết test `plugins/dsh-client-vscode-layout/tests/turn-tree.test.ts` (chạy `npm run test:unit`)

  BƯỚC 2: TRỤ CỘT 1 - GIAO DIỆN CÂY & ACTIONS TRONG CHAT
  ├── Tạo `DiffLineStats.tsx` & `DiffLineStats.module.css`
  ├── Tạo `TurnTreeRow.tsx` & `TurnTreeRow.module.css`
  └── Nâng cấp `TurnReviewCard.tsx` (Tree view, toggle expand/collapse, revert dialog, accept/reject từng file)

  BƯỚC 3: TRỤ CỘT 2 - BACKEND MIME TYPES
  └── Cập nhật `plugins/dsh-host-files/lib/index.js` (bổ sung MIME cho woff2, ttf, otf, flac, mov)

  BƯỚC 4: TRỤ CỘT 2 - RICH MEDIA PREVIEWS
  ├── Tạo `PdfPreview.tsx` & CSS
  ├── Tạo `FontPreview.tsx` & CSS (với FontFace loader + interactive font tester)
  ├── Tạo `MediaPreview.tsx` & CSS (hỗ trợ cả Audio & Video)
  └── Tích hợp router hiển thị trong `Workbench.tsx` và StatusBar badge

  BƯỚC 5: BUILD, KIỂM THỬ TOÀN DIỆN & DEPLOY
  ├── `npm run typecheck`
  ├── `npm run test:unit`
  ├── `npm run build:layout`
  └── `npm run deploy`
```

---

# 5. KẾT LUẬN

Tài liệu này đã kết hợp toàn bộ nghiên cứu chuyên sâu về **cả 2 yêu cầu cốt lõi**:
1. **Cụm Diff per turn / Tree view / Reject & Accept all trong Chat**
2. **Bộ Rich Media Previews (PDF, Font typography, Audio, Video)**

Tất cả cấu trúc dữ liệu, thuật toán, component tree, CSS tokens và các bước thực thi đã sẵn sàng 100%. Trong phiên làm việc tới, chúng ta chỉ cần mở tài liệu này và triển khai từng bước!
