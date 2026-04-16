/**
 * Undo/redo stack with coalescing support.
 *
 * Commands are reversible operations that can be applied, undone,
 * and redone. Coalescing merges rapid sequential edits (e.g.,
 * keystrokes) into a single undo entry.
 *
 * @module
 */

// -- Types ----------------------------------------------------------------

/** A reversible command that can be applied and undone. */
export interface UndoCommand<M> {
  readonly apply: (model: M) => M;
  readonly undo: (model: M) => M;
  readonly label?: string;
  readonly coalesce?: string;
  readonly coalesceWindowMs?: number;
}

export interface UndoEntry<M> {
  readonly applyFn: (model: M) => M;
  readonly undoFn: (model: M) => M;
  readonly label: string | undefined;
  readonly coalesce: string | undefined;
  readonly timestamp: number;
}

/** Immutable undo/redo stack holding the current model and history. */
export interface UndoStack<M> {
  readonly current: M;
  readonly max_size: number;
  readonly undo_size: number;
  readonly undoStack: readonly UndoEntry<M>[];
  readonly redoStack: readonly UndoEntry<M>[];
}

// -- Time seam for testing ------------------------------------------------

let nowFn: () => number = () => Date.now();

/** Override the timestamp source (for testing). */
export function _setTimestampFn(fn: () => number): void {
  nowFn = fn;
}

/** Reset to default timestamp source. */
export function _resetTimestampFn(): void {
  nowFn = () => Date.now();
}

// -- Creation -------------------------------------------------------------

/** Create a new undo stack with the given initial model. */
export function createUndoStack<M>(model: M, opts?: { readonly max_size?: number }): UndoStack<M> {
  const max_size = opts?.max_size ?? 100;
  if (!Number.isInteger(max_size) || max_size <= 0) {
    throw new Error(`max_size must be a positive integer, got: ${String(max_size)}`);
  }
  return { current: model, max_size, undo_size: 0, undoStack: [], redoStack: [] };
}

// -- Operations -----------------------------------------------------------

/** Push a command onto the undo stack, updating the current model. Clears the redo stack. */
export function push<M>(stack: UndoStack<M>, command: UndoCommand<M>): UndoStack<M> {
  const now = nowFn();
  const newModel = command.apply(stack.current);

  // Check for coalescing with the top of the undo stack.
  if (command.coalesce !== undefined && stack.undoStack.length > 0) {
    const top = stack.undoStack[0]!;
    if (
      top.coalesce === command.coalesce &&
      now - top.timestamp <= (command.coalesceWindowMs ?? 0)
    ) {
      const capturedTopApply = top.applyFn;
      const capturedCmdApply = command.apply;
      const capturedTopUndo = top.undoFn;
      const capturedCmdUndo = command.undo;
      const merged: UndoEntry<M> = {
        applyFn: (model: M) => capturedCmdApply(capturedTopApply(model)),
        undoFn: (model: M) => capturedTopUndo(capturedCmdUndo(model)),
        label: top.label,
        coalesce: top.coalesce,
        timestamp: now,
      };
      return {
        current: newModel,
        max_size: stack.max_size,
        undo_size: stack.undo_size,
        undoStack: [merged, ...stack.undoStack.slice(1)],
        redoStack: [],
      };
    }
  }

  const entry: UndoEntry<M> = {
    applyFn: command.apply,
    undoFn: command.undo,
    label: command.label,
    coalesce: command.coalesce,
    timestamp: now,
  };

  const newUndoStack = [entry, ...stack.undoStack];
  const newSize = stack.undo_size + 1;
  const clampedStack =
    newSize > stack.max_size ? newUndoStack.slice(0, stack.max_size) : newUndoStack;
  const clampedSize = Math.min(newSize, stack.max_size);

  return {
    current: newModel,
    max_size: stack.max_size,
    undo_size: clampedSize,
    undoStack: clampedStack,
    redoStack: [],
  };
}

/** Undo the last command. Returns unchanged if nothing to undo. */
export function undo<M>(stack: UndoStack<M>): UndoStack<M> {
  if (stack.undoStack.length === 0) return stack;

  const [entry, ...rest] = stack.undoStack as [UndoEntry<M>, ...UndoEntry<M>[]];
  const oldModel = entry.undoFn(stack.current);

  return {
    current: oldModel,
    max_size: stack.max_size,
    undo_size: stack.undo_size - 1,
    undoStack: rest,
    redoStack: [entry, ...stack.redoStack],
  };
}

/** Redo the last undone command. Returns unchanged if nothing to redo. */
export function redo<M>(stack: UndoStack<M>): UndoStack<M> {
  if (stack.redoStack.length === 0) return stack;

  const [entry, ...rest] = stack.redoStack as [UndoEntry<M>, ...UndoEntry<M>[]];
  const newModel = entry.applyFn(stack.current);

  return {
    current: newModel,
    max_size: stack.max_size,
    undo_size: stack.undo_size + 1,
    redoStack: rest,
    undoStack: [entry, ...stack.undoStack],
  };
}

/** Return the current model. */
export function current<M>(stack: UndoStack<M>): M {
  return stack.current;
}

/** Return true if there are entries on the undo stack. */
export function canUndo<M>(stack: UndoStack<M>): boolean {
  return stack.undoStack.length > 0;
}

/** Return true if there are entries on the redo stack. */
export function canRedo<M>(stack: UndoStack<M>): boolean {
  return stack.redoStack.length > 0;
}

/** Return labels from the undo stack, most recent first. */
export function history<M>(stack: UndoStack<M>): (string | undefined)[] {
  return stack.undoStack.map((e) => e.label);
}
