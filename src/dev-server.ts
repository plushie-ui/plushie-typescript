/**
 * File watcher for hot reload during development.
 *
 * Watches directories for changes, debounces rapid edits, and calls
 * back when it's time to reload. Module cache invalidation and
 * re-import are handled by the consumer (runtime/CLI); this module
 * only watches and debounces.
 *
 * @module
 */

import { type FSWatcher, watch } from "node:fs";
import { resolve } from "node:path";

/** Options for creating a DevServer. */
export interface DevServerOptions {
  /** Directories to watch for changes. */
  readonly dirs: readonly string[];
  /** Debounce interval in milliseconds. Defaults to 100. */
  readonly debounceMs?: number;
  /** Callback invoked when files change (after debounce). */
  readonly onReload: (changedPaths: string[]) => void;
}

/**
 * File watcher that debounces filesystem changes and fires a callback.
 *
 * Modelled after Plushie.DevServer from the Elixir SDK; same
 * concept (watch, debounce, notify), adapted for Node's fs.watch API.
 */
export class DevServer {
  private readonly dirs: readonly string[];
  private readonly debounceMs: number;
  private readonly onReload: (changedPaths: string[]) => void;
  private watchers: FSWatcher[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private changedPaths: Set<string> = new Set();
  private running = false;

  constructor(opts: DevServerOptions) {
    this.dirs = opts.dirs;
    this.debounceMs = opts.debounceMs ?? 100;
    this.onReload = opts.onReload;
  }

  /** Start watching all configured directories. */
  start(): void {
    if (this.running) return;
    this.running = true;

    for (const dir of this.dirs) {
      const resolved = resolve(dir);
      try {
        const watcher = watch(resolved, { recursive: true }, (_eventType, filename) => {
          if (filename !== null && filename !== undefined) {
            this.handleChange(resolve(resolved, filename));
          }
        });
        watcher.on("error", (err) => {
          console.error(`[plushie dev] watcher error on ${resolved}: ${String(err)}`);
        });
        this.watchers.push(watcher);
      } catch (err) {
        console.error(`[plushie dev] failed to watch ${resolved}: ${String(err)}`);
      }
    }
  }

  /** Stop watching and cancel any pending debounce. */
  stop(): void {
    this.running = false;

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this.changedPaths.clear();
  }

  private handleChange(filePath: string): void {
    if (!this.running) return;

    this.changedPaths.add(filePath);

    if (this.debounceTimer === null) {
      this.debounceTimer = setTimeout(() => {
        this.flush();
      }, this.debounceMs);
    }
  }

  private flush(): void {
    this.debounceTimer = null;

    if (this.changedPaths.size === 0) return;

    const paths = [...this.changedPaths].sort();
    this.changedPaths.clear();

    try {
      this.onReload(paths);
    } catch (err) {
      console.error(`[plushie dev] onReload error: ${String(err)}`);
    }
  }
}
