// Notes application demonstrating all state helpers working together.
//
// Demonstrates:
// - Selection for multi-select with toggle
// - UndoStack for reversible edits with labels
// - Route for stack-based view navigation
// - Data.query() for full-text search across fields
// - View helper extraction (viewList, viewEdit)

import type { Event, UINode, WindowNode } from "../src/index.js";
import {
  app,
  Data,
  isClick,
  isInput,
  isToggle,
  Route,
  Selection,
  UndoStack,
} from "../src/index.js";
import type { Route as RouteState } from "../src/route.js";
import type { Selection as SelectionState } from "../src/selection.js";
import {
  button,
  checkbox,
  column,
  row,
  scrollable,
  text,
  textEditor,
  textInput,
  window,
} from "../src/ui/index.js";
import type { UndoStack as UndoStackState } from "../src/undo.js";

// -- Types --------------------------------------------------------------------

interface Note {
  id: number;
  title: string;
  body: string;
}

interface EditorModel {
  title: string;
  text: string;
}

interface Model {
  notes: Note[];
  nextId: number;
  searchQuery: string;
  editingId: number | null;
  selection: SelectionState;
  undo: UndoStackState<EditorModel>;
  route: RouteState;
}

// -- Helpers ------------------------------------------------------------------

function saveCurrentEdit(model: Model): Model {
  if (model.editingId === null) return model;

  const current = UndoStack.current(model.undo);
  const notes = model.notes.map((n) =>
    n.id === model.editingId ? { ...n, title: current.title, body: current.text } : n,
  );
  return { ...model, notes };
}

// -- View helpers -------------------------------------------------------------

function viewList(model: Model): UINode {
  const filtered =
    model.searchQuery === ""
      ? model.notes
      : (Data.query(model.notes as unknown as Record<string, unknown>[], {
          search: { fields: ["title", "body"], query: model.searchQuery },
        }).entries as unknown as Note[]);

  return window("main", { title: "Notes" }, [
    column({ padding: 16, spacing: 12, width: "fill" }, [
      text("heading", "Notes", { size: 24 }),

      textInput("search", model.searchQuery, { placeholder: "Search notes..." }),

      scrollable({ id: "notes_list", height: "fill" }, [
        column(
          { spacing: 4, width: "fill" },
          filtered.map((note) =>
            row({ id: `note_row:${note.id}`, spacing: 8, width: "fill" }, [
              checkbox(
                `note_select:${note.id}`,
                Selection.isSelected(model.selection, String(note.id)),
                {
                  label: note.title,
                },
              ),
              button(`note:${note.id}`, "Edit"),
            ]),
          ),
        ),
      ]),

      row({ spacing: 8 }, [
        button("new_note", "New Note"),
        button("delete_selected", "Delete Selected"),
      ]),
    ]),
  ]);
}

function viewEdit(model: Model): UINode {
  const current = UndoStack.current(model.undo);

  return window("main", { title: "Edit Note" }, [
    column({ padding: 16, spacing: 12, width: "fill" }, [
      row({ spacing: 8 }, [button("back", "Back"), button("undo", "Undo"), button("redo", "Redo")]),

      textInput("title", current.title, { placeholder: "Note title" }),
      textEditor("body", { content: current.text, width: "fill", height: "fill" }),
    ]),
  ]);
}

// -- App ----------------------------------------------------------------------

export default app<Model>({
  // -- Init -------------------------------------------------------------------

  init: {
    notes: [],
    nextId: 1,
    searchQuery: "",
    editingId: null,
    selection: Selection.createSelection({ mode: "multi" }),
    undo: UndoStack.createUndoStack({ title: "", text: "" }),
    route: Route.createRoute("/list"),
  },

  // -- Update -----------------------------------------------------------------

  update(rawState, event: Event) {
    // DeepReadonly mangles function types in Selection/UndoStack/Route,
    // but none of these helpers mutate their arguments.
    const state = rawState as unknown as Model;
    if (isClick(event, "new_note")) {
      const id = state.nextId;
      const note: Note = { id, title: "", body: "" };
      return {
        ...state,
        notes: [...state.notes, note],
        nextId: id + 1,
        editingId: id,
        undo: UndoStack.createUndoStack({ title: "", text: "" }),
        route: Route.push(state.route, "/edit"),
      };
    }

    if (isClick(event)) {
      const noteMatch = event.id.match(/^note:(\d+)$/);
      if (noteMatch) {
        const id = Number(noteMatch[1]);
        const note = state.notes.find((n) => n.id === id);
        if (!note) return state;
        return {
          ...state,
          editingId: id,
          undo: UndoStack.createUndoStack({ title: note.title, text: note.body }),
          route: Route.push(state.route, "/edit"),
        };
      }
    }

    if (isClick(event, "back")) {
      const saved = saveCurrentEdit(state);
      return {
        ...saved,
        editingId: null,
        route: Route.pop(saved.route),
      };
    }

    if (isClick(event, "delete_selected")) {
      const sel = Selection.selected(state.selection);
      return {
        ...state,
        notes: state.notes.filter((n) => !sel.has(String(n.id))),
        selection: Selection.clear(state.selection),
      };
    }

    if (isInput(event, "search")) {
      return { ...state, searchQuery: String(event.value) };
    }

    if (isInput(event, "title")) {
      const oldTitle = UndoStack.current(state.undo).title;
      const value = String(event.value);
      return {
        ...state,
        undo: UndoStack.applyCommand(state.undo, {
          apply: (c) => ({ ...c, title: value }),
          undo: (c) => ({ ...c, title: oldTitle }),
          label: "edit title",
        }),
      };
    }

    if (isInput(event, "body")) {
      const oldText = UndoStack.current(state.undo).text;
      const value = String(event.value);
      return {
        ...state,
        undo: UndoStack.applyCommand(state.undo, {
          apply: (c) => ({ ...c, text: value }),
          undo: (c) => ({ ...c, text: oldText }),
          label: "edit body",
        }),
      };
    }

    if (isClick(event, "undo")) {
      return { ...state, undo: UndoStack.undo(state.undo) };
    }

    if (isClick(event, "redo")) {
      return { ...state, undo: UndoStack.redo(state.undo) };
    }

    if (isToggle(event)) {
      const selectMatch = event.id.match(/^note_select:(\d+)$/);
      if (selectMatch) {
        return {
          ...state,
          selection: Selection.toggle(state.selection, selectMatch[1]!),
        };
      }
    }

    return state;
  },

  // -- View -------------------------------------------------------------------

  view: (rawState) => {
    const s = rawState as unknown as Model;
    switch (Route.currentPath(s.route)) {
      case "/edit":
        return viewEdit(s) as WindowNode;
      default:
        return viewList(s) as WindowNode;
    }
  },
});
