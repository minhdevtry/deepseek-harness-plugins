/**
 * File-click routing policy unit tests.
 *
 * This is the whole decision the `openPath` decoration makes, and getting it
 * wrong is not a cosmetic bug: claiming a PDF would replace a working OS reader
 * with an editor that cannot render it, and delegating a `.md` would leave the
 * feature not working at all. So the policy is asserted directly here rather
 * than only through a live click.
 *
 * Run: node --test --experimental-strip-types plugins/dsh-client-vscode-layout/tests/fileOpener.test.ts
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { installWorkbenchOpener, openInWorkbench, routeFor } from '../src/client/fileOpener.ts'

describe('routeFor click routing policy', () => {
  it('claims the text and code files the workbench renders', () => {
    for (const path of [
      '/w/README.md', '/w/notes.markdown', '/w/a.txt', '/w/app.ts', '/w/app.tsx',
      '/w/mod.rs', '/w/main.go', '/w/style.css', '/w/data.json', '/w/conf.yaml',
      '/w/q.sql', '/w/run.sh', '/w/table.csv', '/w/page.html', '/w/fix.patch',
    ]) {
      assert.equal(routeFor(path), 'workbench', path)
    }
  })

  it('claims images, which the workbench previews', () => {
    assert.equal(routeFor('/w/shot.png'), 'workbench')
    assert.equal(routeFor('/w/photo.JPEG'), 'workbench')
  })

  it('hands documents, archives, media and binaries to the OS', () => {
    for (const path of [
      '/w/report.pdf', '/w/sheet.xlsx', '/w/deck.pptx', '/w/letter.docx',
      '/w/bundle.zip', '/w/src.tar.gz', '/w/song.mp3', '/w/clip.mp4',
      '/w/tool.exe', '/w/lib.so', '/w/font.woff2', '/w/art.psd', '/w/app.db',
    ]) {
      assert.equal(routeFor(path), 'os', path)
    }
  })

  it('is case-insensitive about extensions', () => {
    assert.equal(routeFor('/w/REPORT.PDF'), 'os')
    assert.equal(routeFor('/w/NOTES.MD'), 'workbench')
  })

  it('hands a trailing-separator path to the OS without probing', () => {
    // Only ever written for a directory, so the round trip is not worth paying.
    assert.equal(routeFor('/w/src/'), 'os')
    assert.equal(routeFor('C:\\w\\src\\'), 'os')
  })

  it('probes when the name cannot settle file from directory', () => {
    // Extensionless: a repo is full of both kinds and neither spelling wins.
    assert.equal(routeFor('/w/Makefile'), 'probe')
    assert.equal(routeFor('/w/LICENSE'), 'probe')
    assert.equal(routeFor('/w/.gitignore'), 'probe')
    assert.equal(routeFor('/w/src/components'), 'probe')
    // A known-nothing extension is equally unsettled.
    assert.equal(routeFor('/w/archive.xyz'), 'probe')
  })

  it('hands a blank path to the OS rather than opening an empty tab', () => {
    assert.equal(routeFor(''), 'os')
    assert.equal(routeFor('   '), 'os')
  })
})

describe('workbench opener seam', () => {
  it('reports false until a frame installs an opener', () => {
    assert.equal(openInWorkbench('/w/a.md'), false)
  })

  it('routes to the installed opener and restores the inert default', () => {
    const seen: string[] = []
    const retract = installWorkbenchOpener((path) => { seen.push(path); return true })
    assert.equal(openInWorkbench('/w/a.md'), true)
    assert.deepEqual(seen, ['/w/a.md'])
    retract()
    assert.equal(openInWorkbench('/w/b.md'), false)
  })

  it('lets a newer install win and ignores the stale disposer', () => {
    // Two frames overlapping across a remount must not leave the seam inert.
    const retractFirst = installWorkbenchOpener(() => true)
    let secondCalls = 0
    installWorkbenchOpener(() => { secondCalls += 1; return true })
    retractFirst()
    assert.equal(openInWorkbench('/w/c.md'), true)
    assert.equal(secondCalls, 1)
  })
})
