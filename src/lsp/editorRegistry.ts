import { EditorView } from '@codemirror/view';

class EditorRegistry {
  private views = new Map<string, EditorView>();
  private activeId: string | null = null;

  register(id: string, view: EditorView) {
    this.views.set(id, view);
  }

  unregister(id: string) {
    this.views.delete(id);
    if (this.activeId === id) {
      this.activeId = null;
    }
  }

  setActiveId(id: string) {
    this.activeId = id;
  }

  getActiveView(): EditorView | null {
    if (!this.activeId) return null;
    return this.views.get(this.activeId) || null;
  }
}

export const globalEditorRegistry = new EditorRegistry();
