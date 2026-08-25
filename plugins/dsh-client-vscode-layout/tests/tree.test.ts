/**
 * File-tree model tests: path arithmetic, git badge rollup, and flattening.
 *
 * Run: node --test --experimental-strip-types plugins/dsh-client-vscode-layout/tests/tree.test.ts
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Listing } from '../src/client/api/files.ts'
import {
  ancestorsOf, badgeFor, creationParent, flatten, normalize, relativeTo,
} from '../src/client/explorer/tree.ts'

const ROOT = '/work/app'

/** Build a listing from bare names; `dirs` and `files` take `name` or `name!` for hidden. */
function listing(path: string, dirs: string[], files: string[]): Listing {
  const entry = (name: string) => ({
    name: name.replace(/!$/, ''),
    path: `${path}/${name.replace(/!$/, '')}`,
    hidden: name.endsWith('!'),
  })
  return {
    path,
    sandboxRoot: ROOT,
    dirs: dirs.map(entry),
    files: files.map(name => ({ ...entry(name), size: 0, mtimeMs: 0 })),
  }
}

describe('normalize', () => {
  it('unifies separators and drops a trailing slash', () => {
    assert.equal(normalize('C:\\work\\app\\'), 'C:/work/app')
    assert.equal(normalize('/work/app/'), '/work/app')
    // A bare root must not be emptied.
    assert.equal(normalize('/'), '/')
  })
})

describe('relativeTo', () => {
  it('returns the forward-slashed relative path', () => {
    assert.equal(relativeTo(ROOT, '/work/app/src/main.ts'), 'src/main.ts')
    assert.equal(relativeTo(ROOT, ROOT), '')
  })

  it('rejects a sibling whose name merely shares the prefix', () => {
    // Without a separator check, '/work/app2' would read as inside '/work/app'.
    assert.equal(relativeTo(ROOT, '/work/app2/main.ts'), undefined)
  })

  it('rejects a path outside the root', () => {
    assert.equal(relativeTo(ROOT, '/etc/passwd'), undefined)
  })
})

describe('badgeFor', () => {
  const statuses = { 'src/main.ts': 'M', 'src/new.ts': '??', 'docs/readme.md': '??' }

  it('gives a file its own status', () => {
    assert.equal(badgeFor(ROOT, '/work/app/src/main.ts', 'file', statuses), 'M')
    assert.equal(badgeFor(ROOT, '/work/app/src/other.ts', 'file', statuses), undefined)
  })

  it('rolls a directory badge up from its subtree', () => {
    assert.equal(badgeFor(ROOT, '/work/app/src', 'dir', statuses), 'M')
    assert.equal(badgeFor(ROOT, '/work/app/docs', 'dir', statuses), '??')
  })

  it('prefers a real letter over the untracked marker when both are beneath', () => {
    // 'src' holds one modified and one untracked file; modified is the signal
    // worth surfacing on a collapsed folder.
    assert.equal(badgeFor(ROOT, '/work/app/src', 'dir', statuses), 'M')
  })

  it('is silent outside a repository', () => {
    assert.equal(badgeFor(ROOT, '/work/app/src/main.ts', 'file', undefined), undefined)
  })
})

describe('flatten', () => {
  const listings = new Map([
    [ROOT, listing(ROOT, ['src', 'node_modules!'], ['package.json', '.env!'])],
    [`${ROOT}/src`, listing(`${ROOT}/src`, [], ['main.ts', 'util.ts'])],
  ])

  it('orders directories before files, each alphabetically', () => {
    const rows = flatten(ROOT, listings, new Set(), { showHidden: true })
    assert.deepEqual(rows.map(r => r.name), ['node_modules', 'src', '.env', 'package.json'])
  })

  it('hides dotfiles and collapsed directories unless asked', () => {
    const rows = flatten(ROOT, listings, new Set(), { showHidden: false })
    assert.deepEqual(rows.map(r => r.name), ['src', 'package.json'])
  })

  it('recurses only into expanded directories, and indents them', () => {
    const rows = flatten(ROOT, listings, new Set([`${ROOT}/src`]), { showHidden: false })
    assert.deepEqual(rows.map(r => `${r.depth}:${r.name}`), ['0:src', '1:main.ts', '1:util.ts', '0:package.json'])
  })

  it('renders an expanded directory whose listing has not arrived yet', () => {
    // The fetch is in flight; the row must still show, just without children.
    const rows = flatten(ROOT, new Map([[ROOT, listing(ROOT, ['src'], [])]]), new Set([`${ROOT}/src`]), { showHidden: false })
    assert.deepEqual(rows.map(r => r.name), ['src'])
    assert.equal(rows[0]?.expanded, true)
  })

  it('attaches badges from the status map', () => {
    const rows = flatten(ROOT, listings, new Set([`${ROOT}/src`]), {
      showHidden: false,
      statuses: { 'src/main.ts': 'M' },
    })
    assert.equal(rows.find(r => r.name === 'main.ts')?.badge, 'M')
    assert.equal(rows.find(r => r.name === 'src')?.badge, 'M')
    assert.equal(rows.find(r => r.name === 'package.json')?.badge, undefined)
  })

  it('returns nothing when the root listing has not loaded', () => {
    assert.deepEqual(flatten(ROOT, new Map(), new Set(), { showHidden: true }), [])
  })

  it('emits normalised paths so backslash listings still resolve', () => {
    // The host joins with the platform separator, so on Windows a child path
    // arrives as `C:\work\app\src`. Caches and the expansion set are keyed by
    // normalised path; emitting the raw form would make every subtree
    // unopenable there while looking correct on Linux.
    const winRoot = 'C:\\work\\app'
    const winListings = new Map([
      ['C:/work/app', {
        path: winRoot,
        sandboxRoot: winRoot,
        dirs: [{ name: 'src', path: 'C:\\work\\app\\src', hidden: false }],
        files: [],
      }],
      ['C:/work/app/src', {
        path: 'C:\\work\\app\\src',
        sandboxRoot: winRoot,
        dirs: [],
        files: [{ name: 'main.ts', path: 'C:\\work\\app\\src\\main.ts', hidden: false, size: 0, mtimeMs: 0 }],
      }],
    ])
    const rows = flatten(winRoot, winListings, new Set(['C:/work/app/src']), { showHidden: false })
    assert.deepEqual(rows.map(r => r.path), ['C:/work/app/src', 'C:/work/app/src/main.ts'])
    assert.equal(rows[0]?.expanded, true)
  })
})

describe('ancestorsOf', () => {
  it('lists the chain from the root down to the parent', () => {
    assert.deepEqual(ancestorsOf(ROOT, '/work/app/src/lib/x.ts'), [ROOT, `${ROOT}/src`, `${ROOT}/src/lib`])
  })

  it('is empty for the root itself and for outside paths', () => {
    assert.deepEqual(ancestorsOf(ROOT, ROOT), [])
    assert.deepEqual(ancestorsOf(ROOT, '/elsewhere/x.ts'), [])
  })
})

describe('creationParent', () => {
  it('targets a directory itself, and a file\'s parent', () => {
    assert.equal(creationParent({ path: '/work/app/src', kind: 'dir' }), '/work/app/src')
    assert.equal(creationParent({ path: '/work/app/src/main.ts', kind: 'file' }), '/work/app/src')
  })
})

import { getDocLinkInfo, resolveRelativePath, removeDiacritics, getAcronym, slugifyHeading } from '../src/client/utils/path.ts'

describe('getDocLinkInfo', () => {
  it('uses simple filename without extension for same directory files', () => {
    const info = getDocLinkInfo('/work/app/src/App.tsx', '/work/app/src/Button.tsx')
    assert.equal(info.title, 'Button')
    assert.equal(info.href, './Button.tsx')
    assert.equal(info.folderBadge, '.')
  })

  it('includes subfolder in title and href for nested files', () => {
    const info = getDocLinkInfo('/work/app/src/App.tsx', '/work/app/src/components/Modal.tsx')
    assert.equal(info.title, 'components/Modal')
    assert.equal(info.href, './components/Modal.tsx')
    assert.equal(info.folderBadge, 'components')
  })

  it('provides clean title without ../ for sibling or external folders', () => {
    const infoWithRoot = getDocLinkInfo('/work/app/src/tiptap/Editor.tsx', '/work/app/src/utils/path.ts', '/work/app')
    assert.equal(infoWithRoot.title, 'src/utils/path')
    assert.equal(infoWithRoot.href, '../utils/path.ts')
    assert.equal(infoWithRoot.folderBadge, 'src/utils')

    const infoExternal = getDocLinkInfo('/work/app/src/App.tsx', '/home/user/Downloads/Code/notes.md')
    assert.equal(infoExternal.title, 'Downloads/Code/notes')
    assert.equal(infoExternal.folderBadge, 'Downloads/Code')
  })

  it('handles heading section anchors correctly', () => {
    const headingInfo = getDocLinkInfo('/work/app/src/App.tsx', '#Điểm khởi động')
    assert.equal(headingInfo.title, '# Điểm khởi động')
    assert.equal(headingInfo.href, '#diem-khoi-dong')
    assert.equal(headingInfo.isHeading, true)

    const fileHeadingInfo = getDocLinkInfo('/work/app/src/App.tsx', '/work/app/src/ARCHITECTURE.md#Điểm khởi động')
    assert.equal(fileHeadingInfo.title, 'ARCHITECTURE > Điểm khởi động')
    assert.equal(fileHeadingInfo.href, './ARCHITECTURE.md#diem-khoi-dong')
  })
})

describe('resolveRelativePath', () => {
  it('resolves same folder and parent folder relative paths', () => {
    assert.equal(resolveRelativePath('/work/app/src/App.tsx', './Button.tsx'), '/work/app/src/Button.tsx')
    assert.equal(resolveRelativePath('/work/app/src/tiptap/Editor.tsx', '../utils/path.ts'), '/work/app/src/utils/path.ts')
  })

  it('preserves hash fragments in resolved paths', () => {
    assert.equal(resolveRelativePath('/work/app/src/App.tsx', './ARCHITECTURE.md#entrypoint'), '/work/app/src/ARCHITECTURE.md#entrypoint')
    assert.equal(resolveRelativePath('/work/app/src/App.tsx', '#heading'), '/work/app/src/App.tsx#heading')
  })
})

describe('removeDiacritics and getAcronym', () => {
  it('removes Vietnamese and Latin diacritics', () => {
    assert.equal(removeDiacritics('[Vuihoc] Tổng hợp lỗi hệ thống 2026'), '[vuihoc] tong hop loi he thong 2026')
    assert.equal(removeDiacritics('Điểm Khởi Động'), 'diem khoi dong')
  })

  it('extracts snake_case, kebab-case and CamelCase acronyms', () => {
    assert.equal(getAcronym('speechsuper_word_eval.py'), 'swe')
    assert.equal(getAcronym('HDSD.md'), 'hdsd')
    assert.equal(getAcronym('FileIcon.tsx'), 'fi')
  })

  it('slugifies headings with diacritics into URL-safe slugs', () => {
    assert.equal(slugifyHeading('1. Điểm khởi động (Entrypoint)'), '1-diem-khoi-dong-entrypoint')
  })
})
