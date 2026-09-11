/**
 * VS Code workbench frame, browser half.
 *
 * One register() call contributes AppFrame into the runtime's built-in 'root'
 * slot and, in the same breath, declares the four child slots (declaration =
 * exclusive render authority), seats the layout store (panel geometry), and
 * wires the panel-action service face. A second effect seats the theme
 * presenter, which projects ctx.theme snapshots onto document.body.
 *
 * Replacing the stock frame is deliberate and is the only way to reach this
 * product: see contract/slots.ts. The stock `ui-layout` entry must be disabled
 * in the profile's cordis.patch.yml — two occupants of a `single` slot is a
 * load-time failure, by design.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the theme plugin's Context merge (ctx.theme).
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
// Type-only: pulls ui-sidebar's SlotMap merge, so the footer-action seat this
// package registers into resolves. We do not own that hole — we join it.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: each of these packages' Context/SlotMap merge is NOT transitive
// through another package's import — every plugin that reads ctx.slots,
// ctx.sessions, ctx.workspaces, ctx.uiWorkspace or GlobalStandardProps's
// useSessions must import that package's own `/client` entry directly, even
// if it also imports a concrete type from it elsewhere (dsh-client-runtime,
// which used to pre-merge all of these into one ClientContext, is retired).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { InputTriggerServiceContract } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the 'conversation.chat.turnTail' SlotMap key and TurnTailOwnerProps
// now live in ui-chat, not ui-conversation (the owner-props themselves are
// imported directly in chat/TurnReviewCard.tsx).
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { PanelActions } from './service.ts'
import type { FrameInjected } from './contract/slots.ts'
import './styles/tokens.css'
import { AppFrame } from './AppFrame.tsx'
import { createLayoutStore } from './stores.ts'
import { LayoutController } from './service.ts'
import { ThemePresenter } from './theme-presenter.ts'
import { mountSprite } from './explorer/icons/index.ts'
import { createViewState, type ExplorerView } from './explorer/views.ts'
import { basename, resolveWorkspacePath } from './utils/path.ts'
import { extractSettledDiffs } from './utils/extractSettledDiffs.ts'
import { RailViews, type RailViewsInjected } from './explorer/RailViews.tsx'
import { createFileSource } from './inputTriggers/fileSource.ts'
import { installComposerWriter, installReferenceWriter, toWorkspaceRelative, type ComposerReference } from './composer.ts'
import { TurnReviewCard, selectTurnId } from './chat/TurnReviewCard.tsx'

export { toWorkspaceRelative }

// Contract exports only (export discipline): the ctx.layout face consumers and
// test fakes type against, plus the owner shares registrants compose with. The
// frame components and the store factory stay package-internal.
export { LayoutController } from './service.ts'
export type { ILayout } from './service.ts'
export type { ConvOwnerProps, DetailsOwnerProps, SidebarOwnerProps } from './contract/slots.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The outward face only; the concrete service stays inside this plugin. */
    layout: import('./service.ts').ILayout
  }
}

export const name = 'dsh-vscode-workspace/client'

/** Required services (cordis fiber inject — the loader passes all module exports as an object plugin). */
export const inject = ['slots', 'theme', 'sessions', 'workspaces']

/**
 * Client plugin body: provide ctx.layout, then one register() call — AppFrame
 * into 'root' with the four child-slot declarations, the layout store seat, and
 * the inject hook that hands the store's bound actions to the service.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // Shared by two registrations that cannot see each other's stores: the frame
  // (root) and the rail switcher (ui-sidebar's footer seat). See explorer/views.ts.
  const views = createViewState()
  const layout = new LayoutController(views)

  /**
   * Select a left-column view, revealing the column if it is collapsed.
   *
   * Both callers reach the rail while it is the only thing on screen — a rail
   * icon click and a Ctrl+Shift chord — and a bare view write there would set a
   * view nobody can see. `openSidebar` is a no-op once the column is open, so
   * this stays safe to call unconditionally.
   */
  let panels: PanelActions | undefined
  const selectView = (view: ExplorerView): void => {
    views.set(view)
    panels?.openSidebar()
  }

  // The file-type symbol sprite must be in the document for the explorer's
  // <use href="#id"> references to resolve. One DOM write, retracted on unload.
  ctx.effect(() => mountSprite(), 'vscode-layout: file icon sprite')

  /**
   * Seat the composer writer (see composer.ts) on the host's own input face.
   *
   * `conversation` is read through ctx.get rather than declared in `inject`
   * for the same reason as inputTriggers below: ui-conversation is an ordinary
   * profile entry, and a hard dependency would take the whole frame down with
   * it. Without it the write simply reports false and the caller notifies.
   *
   * The current session is resolved per call, not captured: the operator can
   * switch sessions between two Ctrl+L presses and each mention belongs to
   * whichever composer is on screen at the time.
   */
  ctx.effect(() => installComposerWriter((text) => {
    const conversation = ctx.get('conversation') as IConversation | undefined
    if (conversation === undefined) return false
    const sessionId = ctx.sessions.list.getSnapshot().current
    if (sessionId === undefined) return false
    const actx = ctx.sessions.scope(sessionId)
    if (actx === undefined) return false
    const input = conversation.input.for(actx)
    const draft = input.state.getSnapshot().draft
    // Never weld onto the operator's last word; never double-space either.
    const gap = draft.length === 0 || /\s$/.test(draft) ? '' : ' '
    input.setDraft(`${draft}${gap}${text} `)
    return true
  }), 'vscode-layout: composer writer')

  /**
   * The frame's reference chip write path into the chat composer.
   * Inserts an authentic U+FFFC occurrence chip into the current session draft.
   */
  ctx.effect(() => installReferenceWriter((reference) => {
    const conversation = ctx.get('conversation') as IConversation | undefined
    if (conversation === undefined) return false
    const sessionId = ctx.sessions.list.getSnapshot().current
    if (sessionId === undefined) return false
    const actx = ctx.sessions.scope(sessionId)
    if (actx === undefined) return false
    const input = conversation.input.for(actx)

    // If inputTriggers is missing from profile, reference chips cannot be resolved by codec
    if (ctx.get('inputTriggers') === undefined) return false

    // Chip adds a trailing space after itself, but not before. Ensure a space
    // if draft already ends in non-whitespace.
    const before = input.state.getSnapshot()
    if (before.draft.length > 0 && !/\s$/.test(before.draft)) {
      input.setDraft(`${before.draft} `)
    }

    const snap = input.state.getSnapshot()
    const at = snap.draft.length

    const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd
    const relRef = toWorkspaceRelative(reference.ref, cwd)
    const resolvedRef: ComposerReference = {
      ...reference,
      ref: relRef,
      clipboardText: `@${relRef}`,
    }

    return input.insertReference(resolvedRef, { start: at, end: at, draftRev: snap.draftRev })
  }), 'vscode-layout: composer reference writer')

  // NOTE (dsh 0.1.3-alpha.1 port): this used to decorate `ctx.workspaces.openPath`
  // so a clicked file (a tool-result row, a closing-turn file mention) opened
  // in this workbench instead of the OS's default application — see
  // fileOpener.ts's routeFor/openInWorkbench for the policy this fed. That
  // method no longer exists on IWorkspaces (or anywhere else client-side —
  // searched the whole new monorepo for a replacement and found none), so the
  // decoration is removed rather than left to throw on a bind() of undefined.
  // `openInWorkbench`/`routeFor` themselves are untouched and still work for
  // whatever DOES call them explicitly (TurnReviewCard's file rows); only the
  // host-wide click interception is gone until a new hook turns up upstream.

  /**
   * Transient operator feedback.
   */
  const notify: FrameInjected['notify'] = (message) => {
    ctx.logger.info(message)
  }

  /**
   * Connect and switch to a workspace directory.
   */
  const openWorkspace: FrameInjected['openWorkspace'] = async (targetPath: string) => {
    try {
      if (!ctx.workspaces) return
      const snapshot = ctx.workspaces.list.getSnapshot()
      let ws = snapshot.items.find(item => item.path === targetPath)
      if (!ws) {
        ws = await ctx.workspaces.create({ path: targetPath })
      }
      if (ws?.workspaceId && ctx.uiWorkspace) {
        const sessionId = await ctx.uiWorkspace.connectWorkspace(ws.workspaceId)
        ctx.sessions.open(sessionId)
      }
    } catch (err) {
      ctx.logger.error('Failed to open workspace:', err)
    }
  }

  /**
   * Open native directory picker to select a folder on disk.
   */
  const pickDirectory: FrameInjected['pickDirectory'] = async () => {
    try {
      if (!ctx.uiWorkspace) return null
      return await ctx.uiWorkspace.pickDirectory()
    } catch (err) {
      ctx.logger.error('Directory picker error:', err)
      return null
    }
  }

  /**
   * List all registered workspaces.
   */
  const listWorkspaces: FrameInjected['listWorkspaces'] = () => {
    try {
      if (!ctx.workspaces) return []
      const items = ctx.workspaces.list.getSnapshot().items
      return items.map(w => ({
        workspaceId: String(w.workspaceId),
        path: w.path,
        name: w.title || basename(w.path) || w.path,
      }))
    } catch {
      return []
    }
  }

  ctx.effect(() => {
    const disposeService = ctx.reflect.provide('layout', layout)
    const disposeRegistration = ctx.slots.register({
      name: 'root',
      children: {
        'sidebar': { kind: 'single', scope: 'root' },
        'conversation': { kind: 'single', scope: 'session-maybe' },
        'details': { kind: 'single', scope: 'session' },
        'shell.overlay': { kind: 'list', scope: 'root' },
      },
      // Exclusive store: the factory itself — the framework instantiates per
      // entry and delivers useStore/actions to AppFrame as standard props.
      store: createLayoutStore,
      // The hook connects the root store to ctx.layout and hands the frame the
      // ctx-backed callbacks its components cannot build themselves.
      inject: (actions: PanelActions): FrameInjected => {
        layout.attachPanels(actions)
        panels = actions
        return {
          notify, openWorkspace, pickDirectory, listWorkspaces,
          useExplorerView: views.use, setExplorerView: selectView,
        }
      },
    }, AppFrame)
    return () => {
      disposeRegistration()
      // provide()'s disposer settles asynchronously; teardown is synchronous fire-and-forget.
      void disposeService()
    }
  }, 'vscode-layout: service + root registration')

  /**
   * The view switcher, into ui-sidebar's `sidebar.footer.action` seat.
   *
   * `slots.inject` rather than a bare register: that hole is declared by
   * ui-sidebar's own entry, which may activate after this one (or re-declare on
   * reload), and inject re-runs the registration against each live declaration
   * instead of throwing on a hole that is not there yet.
   *
   * The seat is a `list`, so this is purely additive — Settings and every
   * shipped footer action stay exactly where they were.
   */
  ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'vscode-layout-views',
    // Above Settings, below anything the host considers more urgent.
    order: 20,
    inject: (): RailViewsInjected => ({
      useExplorerView: views.use,
      setExplorerView: selectView,
    }),
  }, RailViews)), 'vscode-layout: rail view switcher')

  /**
   * Register In-Chat Turn Review Card into conversation.chat.turnTail.
   * Gives a sleek per-turn review card with deep-link into editor.
   */
  ctx.effect(() => ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail',
    select: selectTurnId,
  }, TurnReviewCard)), 'vscode-layout: in-chat turn review card')

  /**
   * Workspace files as an `@` group, beside ui-subagent's agents.
   *
   * `ctx.inject` defers until the service exists: ui-input-trigger is an
   * ordinary profile entry an operator may disable, and a hard dependency would
   * take this whole frame down with it. Without the service the composer simply
   * offers no file candidates.
   */
  ctx.inject(['inputTriggers', 'sessions'], (scope: ClientContext) => {
    const inputTriggers = scope.inputTriggers as InputTriggerServiceContract
    scope.effect(
      () => inputTriggers.registerSource(createFileSource(
        session => scope.sessions.list.getSnapshot().byId[session.sessionId]?.cwd,
      )),
      'vscode-layout: @ workspace files',
    )
  })

  /**
   * Watch agent tool calls and diffs from active session.
   * When an agent writes or edits a file, automatically trigger AI Review mode!
   */
  ctx.inject(['sessions'], (scope: ClientContext) => {
    scope.effect(() => {
      const processedCallIds = new Set<string>()
      // Paths held per in-flight callId, so a hold taken for a call that
      // later errors, is cancelled, or settles without a diff still gets
      // released — not only the settled-with-a-write path. A hold with no
      // matching release freezes autosave (and silently no-ops Ctrl+S) for
      // that path for the rest of the session.
      const heldByCall = new Map<string, Set<string>>()
      // The agent turn each callId belongs to, so a review can be grouped
      // with every other file the same turn touched (the in-chat review
      // card's whole reason for existing). Only the `tool/call` event
      // carries `turn` — the paired `tool/result` does not — so this is
      // captured when the call event is first seen and carried forward.
      const turnByCall = new Map<string, number>()
      // `tool/result`'s `meta` carries the diff for `edit`; a `write`'s own
      // fallback (extractSettledDiffs) needs the ORIGINAL call's name and
      // raw arguments, which likewise live only on the `tool/call` event.
      const callInfoByCall = new Map<string, { name: string, argsRaw: string }>()
      // Sessions whose history this watcher has already caught up on once —
      // see `rebind`'s `suppressReview` for why this exists.
      const seenSessionIds = new Set<string>()
      let isVeryFirstRebind = true
      let unsubscribeSession: (() => void) | undefined
      let currentCwd: string | undefined

      const releaseHeld = (paths: Iterable<string>) => {
        for (const p of paths) (window as any).__dsh_release_autosave?.(p)
      }

      /**
       * Walk a session's raw event window and act on `tool/call`/`tool/result`.
       *
       * Not `sessionFace.getSnapshot()` — `SessionSnapshot`'s real type (read
       * directly from `@deepseek-ai/dsh-api-session-controller`'s source, not
       * guessed) has no node list and no running-call list at all; measured
       * live, `.getSnapshot().nodes` is consistently `undefined`. Every prior
       * version of this function read `snap.nodes`/`snap.runningCalls`,
       * fields that do not exist on that type, so this watcher never
       * reliably fired for a real agent turn.
       *
       * The actual raw event stream is `sessionFace.eventSource` — present
       * on the concrete `Session` class and exported as a public type
       * (`SessionEventWindow`/`SessionEventLikeEntry`) from the same
       * package, but not declared on the narrower `SessionFace` alias
       * `sessionOf()` returns, hence the cast below. `.getSnapshot().entries`
       * are `{type: 'event', event: SessionEvent}` in append order, matching
       * the durable JSONL log verbatim (verified against two real captured
       * sessions, not inferred).
       */
      const drainEvents = (eventWindow: any, running: boolean, opts?: { suppressReview?: boolean, onlyPopLatestDiff?: boolean }) => {
        const suppressReview = opts?.suppressReview ?? false
        if (!eventWindow) return
        const resolvePath = (raw: string) => resolveWorkspacePath(currentCwd, raw)

        // A page load's one-time catch-up (see `rebind`) must not replay
        // every diff-bearing tool/result the whole session ever produced —
        // only the single most recent one, matching what the comment there
        // actually promises. Without this, a session with N past edits popped
        // N reviews on every reload, and every one but the last tried to
        // reconstruct a baseline against content the file has long since
        // moved past — the "không thể tái tạo chính xác" notification,
        // repeated once per stale turn. A speculative pre-pass (mirroring
        // the main loop's own call-info tracking, but without its side
        // effects) finds that one callId; everything else this call
        // processes is marked seen without popping a review, same as
        // `suppressReview`.
        let onlyPopCallId: string | undefined
        if (opts?.onlyPopLatestDiff) {
          const speculativeCallInfo = new Map<string, { name: string, argsRaw: string }>()
          for (const entry of eventWindow.entries ?? []) {
            if (entry?.type !== 'event') continue
            const event = entry.event
            if (event === undefined || event === null) continue
            if (event.type === 'tool/call') {
              const { callId, name, arguments: argsRaw } = event.data ?? {}
              if (typeof callId === 'string' && typeof name === 'string' && typeof argsRaw === 'string') {
                speculativeCallInfo.set(callId, { name, argsRaw })
              }
              continue
            }
            if (event.type !== 'tool/result') continue
            const callId: unknown = event.data?.message?.source?.callId
            if (typeof callId !== 'string') continue
            const resultBlock = (event.data?.message?.content ?? []).find(
              (block: any) => block?.type === 'tool-result',
            )
            const isError = resultBlock?.isError === true
            const diffs = !isError
              ? extractSettledDiffs({ isError, meta: event.data?.meta, call: speculativeCallInfo.get(callId) ?? null })
              : null
            if (diffs !== null) onlyPopCallId = callId
          }
        }

        for (const entry of eventWindow.entries ?? []) {
          if (entry?.type !== 'event') continue
          const event = entry.event
          if (event === undefined || event === null) continue

          // 1. A running or just-settled call: remember its turn and its
          // own name/arguments (for extractSettledDiffs's write fallback),
          // and hold autosave for any path-shaped argument — released
          // below once this same callId's tool/result appears, however it
          // settles.
          if (event.type === 'tool/call') {
            const { callId, name, arguments: argsRaw, turn } = event.data ?? {}
            if (typeof callId !== 'string') continue
            if (typeof turn === 'number') turnByCall.set(callId, turn)
            if (typeof name !== 'string' || typeof argsRaw !== 'string') continue
            callInfoByCall.set(callId, { name, argsRaw })
            try {
              const parsed = JSON.parse(argsRaw)
              const target = parsed.path || parsed.file_path || parsed.target_file || parsed.filePath || parsed.TargetFile
              if (typeof target === 'string') {
                const absPath = resolvePath(target)
                ;(window as any).__dsh_hold_autosave?.(absPath)
                let held = heldByCall.get(callId)
                if (held === undefined) { held = new Set(); heldByCall.set(callId, held) }
                held.add(absPath)
              }
            } catch {}
            continue
          }

          if (event.type !== 'tool/result') continue
          const callId: unknown = event.data?.message?.source?.callId
          if (typeof callId !== 'string') continue
          if (processedCallIds.has(callId)) continue

          // An interrupted or failed call mutated nothing this plugin should
          // act on — the arguments it carries describe what was ASKED, not
          // what happened, and (for an interrupted `edit`) may be a fragment
          // the agent never actually wrote. `isError` lives on the
          // tool-result content block, not the event data itself.
          const resultBlock = (event.data?.message?.content ?? []).find(
            (block: any) => block?.type === 'tool-result',
          )
          const isError = resultBlock?.isError === true

          // The host's own "this call changed files" signal: settled
          // reconciliation metadata (or, for a write, its own arguments),
          // never a name-substring guess.
          const diffs = !isError
            ? extractSettledDiffs({ isError, meta: event.data?.meta, call: callInfoByCall.get(callId) ?? null })
            : null
          const hasDiffs = diffs !== null

          // During the one-time page-load catch-up, every diff-bearing call
          // except the single most recent one is suppressed exactly like
          // pre-existing history normally is — see `onlyPopCallId` above.
          const suppressThisOne = suppressReview
            || (opts?.onlyPopLatestDiff === true && callId !== onlyPopCallId)

          // Only commit (mark processed, release the hold, consume the turn)
          // once there is somewhere real to hand a review off to. Marking
          // processed unconditionally used to mean: if this node settled
          // before Workbench had mounted and installed the window global,
          // its write was silently dropped forever — a later snapshot would
          // never see it again to retry. A node with nothing to dispatch
          // (no diffs, or errored) has no such dependency and commits right away.
          if (hasDiffs && !suppressThisOne && typeof (window as any).__dsh_start_ai_review !== 'function') continue

          processedCallIds.add(callId)
          const held = heldByCall.get(callId)
          if (held !== undefined) {
            releaseHeld(held)
            heldByCall.delete(callId)
          }
          const turn = turnByCall.get(callId)
          turnByCall.delete(callId)
          callInfoByCall.delete(callId)

          // `suppressThisOne` marks this node "seen" (above) without popping
          // a review for it — either a session's pre-existing history at the
          // moment this watcher first looks at it, or (page-load catch-up)
          // every diff-bearing call but the single most recent one.
          if (!hasDiffs || suppressThisOne) continue

          // A page reload (or window truncation) mid-turn can settle a call
          // whose running phase this watcher never observed — there is no
          // turn number to attribute it to. Falling back to the callId keeps
          // it out of every real turn's grouping rather than merging it into
          // whichever turn happens to be numbered the same as `undefined`.
          const turnId = turn !== undefined ? String(turn) : `unattributed-${callId}`

          // Group by path first: a multi-hunk edit reports one FileDiff per
          // hunk, and each must reach the review as one call carrying every
          // hunk for that path — not one call per hunk, which would each
          // reset the review Workbench had just installed for the last one.
          const byPath = new Map<string, { oldText: string | null; newText: string }[]>()
          for (const hunk of diffs) {
            if (typeof hunk?.path !== 'string' || typeof hunk?.newText !== 'string') continue
            const absPath = resolvePath(hunk.path)
            const list = byPath.get(absPath) ?? []
            list.push({ oldText: typeof hunk.oldText === 'string' ? hunk.oldText : null, newText: hunk.newText })
            byPath.set(absPath, list)
          }
          for (const [absPath, hunksForPath] of byPath) {
            ;(window as any).__dsh_start_ai_review(absPath, hunksForPath, turnId)
          }
        }

        // Backstop: the turn ended (or was interrupted) with a call whose
        // settlement never arrived in this window. Release everything rather
        // than freeze autosave on those paths for the rest of the session.
        if (running === false && heldByCall.size > 0) {
          for (const held of heldByCall.values()) releaseHeld(held)
          heldByCall.clear()
        }
      }

      const rebind = () => {
        unsubscribeSession?.()
        const currentSessionId = scope.sessions.list.getSnapshot().current
        if (currentSessionId === undefined) {
          unsubscribeSession = undefined
          return
        }
        const actx = scope.sessions.scope(currentSessionId)
        if (actx === undefined) {
          unsubscribeSession = undefined
          return
        }
        const sessionFace = scope.sessions.sessionOf(actx) as any
        if (sessionFace === undefined) {
          unsubscribeSession = undefined
          return
        }

        currentCwd = scope.sessions.list.getSnapshot().byId[currentSessionId]?.cwd

        // A session's full event history is whatever
        // `eventSource.getSnapshot()` returns right after subscribing —
        // there is no server-side "only what's new" filter. Without
        // suppressing this first catch-up, switching to (or resuming) a
        // session with a long history popped a review for every past diff
        // in it, all at once, as if the agent had just written every one of
        // those files this instant. The exception is the very first rebind
        // of this watcher's own lifetime (a page load): the active
        // session's most recent write may be a review the operator was
        // mid-way through before the reload, and that one should still
        // reappear — but only that ONE, not the whole history (see
        // `onlyPopLatestDiff` in `drainEvents`): every edit before it has
        // long since been superseded on disk, and trying to reconstruct a
        // baseline for each is exactly what produced the "không thể tái tạo
        // chính xác" notification once per stale turn on every reload.
        const isFirstLookAtThisSession = !seenSessionIds.has(currentSessionId)
        seenSessionIds.add(currentSessionId)
        const isPageLoadCatchUp = isFirstLookAtThisSession && isVeryFirstRebind
        const suppressReview = isFirstLookAtThisSession && !isVeryFirstRebind
        isVeryFirstRebind = false

        const drain = () => {
          drainEvents(sessionFace.eventSource.getSnapshot(), sessionFace.getSnapshot().running)
        }
        const unsubEvents = sessionFace.eventSource.subscribe(drain)
        // Also watch the session's own snapshot: `.running` flipping false is
        // this function's only cue to run the held-path backstop, and a run
        // can settle without necessarily publishing a new event-window
        // revision in the same tick.
        const unsubSession = sessionFace.subscribe(drain)
        unsubscribeSession = () => { unsubEvents(); unsubSession() }
        drainEvents(sessionFace.eventSource.getSnapshot(), sessionFace.getSnapshot().running, {
          suppressReview,
          onlyPopLatestDiff: isPageLoadCatchUp,
        })
      }

      const offList = scope.sessions.list.subscribe(rebind)
      rebind()

      return () => {
        offList()
        unsubscribeSession?.()
        // Backstop: a hold must never outlive the watcher that took it.
        for (const held of heldByCall.values()) releaseHeld(held)
        heldByCall.clear()
        turnByCall.clear()
        callInfoByCall.clear()
      }
    }, 'vscode-layout: watch agent file writes')
  })

  // Theme presentation: pure DOM writes from resolved snapshots — initial state
  // through the getter once, then event-driven only; no React path.
  ctx.effect(() => {
    const presenter = new ThemePresenter()
    presenter.apply(ctx.theme.getTheme())
    const off = ctx.on('theme/change', (snapshot) => { presenter.apply(snapshot) })
    return () => {
      off()
      presenter.dispose()
    }
  }, 'vscode-layout: theme presenter')
}
