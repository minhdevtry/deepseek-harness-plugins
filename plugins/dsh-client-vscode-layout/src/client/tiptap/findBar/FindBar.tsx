import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { IconButton, Tooltip } from '../../ui/primitives/index.ts'
import css from './FindBar.module.css'

declare class Highlight {
  constructor(...ranges: Range[])
}
declare namespace CSS {
  const highlights: Map<string, Highlight>
}

export interface FindBarProps {
  editor: Editor
  isOpen: boolean
  onClose: () => void
}

export function FindBar({ editor, isOpen, onClose }: FindBarProps) {
  const [query, setQuery] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [matchCount, setMatchCount] = useState(0)
  const rangesRef = useRef<Range[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  const currentIndexRef = useRef(0)
  const debounceTimerRef = useRef<any>(null)

  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  // Clean up CSS highlights on unmount
  useEffect(() => () => {
    clearHighlights()
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 30)
    } else {
      clearHighlights()
      setQuery('')
      setMatchCount(0)
      rangesRef.current = []
    }
  }, [isOpen])

  // Re-run search when editor content updates (debounced by 200ms, no auto-scroll)
  useEffect(() => {
    if (!isOpen) return
    const rerun = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        performSearch(query, matchCase, currentIndexRef.current, false)
      }, 200)
    }
    editor.on('update', rerun)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      editor.off('update', rerun)
    }
  }, [editor, isOpen, query, matchCase])

  // Clear Highlights helper
  const clearHighlights = () => {
    if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
      CSS.highlights.delete('tiptap-find-highlight')
      CSS.highlights.delete('tiptap-find-current')
    }
  }

  // Search and update highlights across editor DOM
  const performSearch = (
    text: string,
    caseSensitive: boolean,
    activeIdx: number,
    shouldScroll = false,
  ) => {
    let editorDom: HTMLElement | null = null
    try {
      if (editor && !editor.isDestroyed && editor.view) {
        editorDom = editor.view.dom
      }
    } catch {
      return
    }

    if (!editorDom || !text.trim()) {
      clearHighlights()
      setMatchCount(0)
      rangesRef.current = []
      return
    }

    const treeWalker = document.createTreeWalker(editorDom, NodeFilter.SHOW_TEXT, null)
    const ranges: Range[] = []
    const needle = caseSensitive ? text : text.toLowerCase()

    let node = treeWalker.nextNode()
    while (node) {
      const parent = node.parentElement
      if (parent === null || parent.closest?.('.tiptap-folded-node')) {
        node = treeWalker.nextNode()
        continue
      }
      const nodeText = node.textContent || ''
      const haystack = caseSensitive ? nodeText : nodeText.toLowerCase()
      let startPos = 0

      while ((startPos = haystack.indexOf(needle, startPos)) !== -1) {
        try {
          const range = document.createRange()
          range.setStart(node, startPos)
          range.setEnd(node, startPos + needle.length)
          ranges.push(range)
        } catch {
          // ignore detached node errors
        }
        startPos += needle.length
      }

      node = treeWalker.nextNode()
    }

    rangesRef.current = ranges
    const total = ranges.length
    setMatchCount(total)

    if (total === 0) {
      clearHighlights()
      setCurrentIndex(0)
      return
    }

    const validIdx = ((activeIdx % total) + total) % total
    setCurrentIndex(validIdx)

    if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
      CSS.highlights.set('tiptap-find-highlight', new Highlight(...ranges))
      if (ranges[validIdx]) {
        CSS.highlights.set('tiptap-find-current', new Highlight(ranges[validIdx]))
        if (shouldScroll) {
          // Scroll current match into view only when user explicitly navigates
          const targetEl = ranges[validIdx].startContainer.parentElement
          targetEl?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
        }
      }
    }
  }

  // Trigger search on query or matchCase change (scroll to first match)
  useEffect(() => {
    if (!isOpen) return
    performSearch(query, matchCase, 0, false)
  }, [query, matchCase, isOpen])

  const handleNext = () => {
    if (matchCount === 0) return
    const nextIdx = (currentIndex + 1) % matchCount
    performSearch(query, matchCase, nextIdx, true)
  }

  const handlePrev = () => {
    if (matchCount === 0) return
    const prevIdx = (currentIndex - 1 + matchCount) % matchCount
    performSearch(query, matchCase, prevIdx, true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        handlePrev()
      } else {
        handleNext()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      editor.commands.focus()
    }
  }

  if (!isOpen) return null

  return (
    <div className={css.findBar} role="search" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        className={css.input}
        placeholder="Find in document..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />

      <span className={css.count}>
        {query.trim() ? (matchCount > 0 ? `${currentIndex + 1} / ${matchCount}` : '0 of 0') : ''}
      </span>

      <Tooltip content="Previous Match" shortcut="⇧↵">
        <IconButton
          size="xs"
          variant="ghost"
          onClick={handlePrev}
          disabled={matchCount === 0}
        >
          ▲
        </IconButton>
      </Tooltip>

      <Tooltip content="Next Match" shortcut="↵">
        <IconButton
          size="xs"
          variant="ghost"
          onClick={handleNext}
          disabled={matchCount === 0}
        >
          ▼
        </IconButton>
      </Tooltip>

      <span className={css.divider} />

      <Tooltip content="Match Case">
        <IconButton
          size="xs"
          variant="ghost"
          active={matchCase}
          onClick={() => setMatchCase((c) => !c)}
        >
          Aa
        </IconButton>
      </Tooltip>

      <Tooltip content="Close" shortcut="Esc">
        <IconButton size="xs" variant="ghost" onClick={onClose}>
          ✕
        </IconButton>
      </Tooltip>
    </div>
  )
}
