/**
 * Per-file save serialization and per-file autosave timers.
 *
 * Two bugs this replaces:
 *
 * 1. **One timer for the whole dirty set.** The autosave effect used to
 *    `setTimeout` once for the *entire* dirty set and re-arm it whenever that
 *    set's reference changed — which happens on every new edit to *any* file,
 *    since a fresh keystroke in file B changes the Set object even though
 *    file A's pending save has nothing to do with it. Typing in B kept
 *    pushing A's save further into the future. Each path now gets its own
 *    timer, armed once when it becomes dirty and left alone until it fires,
 *    is saved, or the file goes clean some other way.
 *
 * 2. **No serialization.** `save()` had no queue: a manual Cmd+S arriving
 *    while an autosave for the same path was still awaiting `writeFile`
 *    would run a second, fully independent save concurrently — two writes
 *    racing, with whichever settles last deciding the file's final bytes
 *    regardless of which one was actually newer. `enqueue` chains a new save
 *    for a path onto whatever's already in flight for it, so only one save
 *    per path is ever actually running.
 */
export class SaveQueue {
  readonly #inFlight = new Map<string, Promise<boolean>>()
  readonly #autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

  /**
   * Run `task` for `path` after any save already queued or in flight for it.
   * @param path - absolute file path.
   * @param task - the save to perform; only ever runs once its turn arrives.
   * @returns whether that save succeeded.
   */
  enqueue(path: string, task: () => Promise<boolean>): Promise<boolean> {
    const previous = this.#inFlight.get(path) ?? Promise.resolve(true)
    const chained = previous.catch(() => false).then(task)
    const tracked = chained.finally(() => {
      if (this.#inFlight.get(path) === tracked) this.#inFlight.delete(path)
    })
    this.#inFlight.set(path, tracked)
    return tracked
  }

  /** True while a save for `path` is queued or in flight. */
  isSaving(path: string): boolean {
    return this.#inFlight.has(path)
  }

  /**
   * Reconcile per-path autosave timers against the current dirty set.
   *
   * A path already carrying a timer is left untouched even if it's still in
   * `dirtyPaths` — that timer is this path's own countdown, and no other
   * path's edits get to reset it. A path that dropped out of `dirtyPaths`
   * (saved some other way, tab closed) has its timer cancelled. A newly
   * dirty path with no timer yet gets one.
   * @param dirtyPaths - paths currently considered unsaved.
   * @param delayMs - autosave delay.
   * @param run - called with a path once its timer fires.
   */
  reconcileAutosave(dirtyPaths: ReadonlySet<string>, delayMs: number, run: (path: string) => void): void {
    for (const path of [...this.#autosaveTimers.keys()]) {
      if (!dirtyPaths.has(path)) this.#cancelAutosave(path)
    }
    for (const path of dirtyPaths) {
      if (this.#autosaveTimers.has(path)) continue
      const timer = setTimeout(() => {
        this.#autosaveTimers.delete(path)
        run(path)
      }, delayMs)
      this.#autosaveTimers.set(path, timer)
    }
  }

  /** Cancel every pending autosave timer, e.g. when autosave is turned off. */
  cancelAllAutosaves(): void {
    for (const path of [...this.#autosaveTimers.keys()]) this.#cancelAutosave(path)
  }

  #cancelAutosave(path: string): void {
    const timer = this.#autosaveTimers.get(path)
    if (timer !== undefined) {
      clearTimeout(timer)
      this.#autosaveTimers.delete(path)
    }
  }

  /** Cancel every pending timer. In-flight saves are left to finish; nothing new is queued behind them. */
  dispose(): void {
    this.cancelAllAutosaves()
    this.#inFlight.clear()
  }
}
