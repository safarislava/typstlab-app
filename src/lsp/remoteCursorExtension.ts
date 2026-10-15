import { 
  EditorView, 
  Decoration, 
  type DecorationSet, 
  ViewPlugin, 
  type ViewUpdate, 
  WidgetType 
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { WSUserPresence } from '../core/types';

class RemoteCursorWidget extends WidgetType {
  readonly email: string;
  readonly color: string;
  readonly isFirstLine: boolean;

  constructor(email: string, color: string, isFirstLine = false) {
    super();
    this.email = email;
    this.color = color;
    this.isFirstLine = isFirstLine;
  }

  eq(other: RemoteCursorWidget) {
    return (
      other.email === this.email && 
      other.color === this.color && 
      other.isFirstLine === this.isFirstLine
    );
  }

  toDOM() {
    const wrap = document.createElement('span');
    wrap.className = 'cm-remote-cursor-caret';
    wrap.style.borderLeftColor = this.color;

    const label = document.createElement('span');
    label.className = `cm-remote-cursor-tooltip${this.isFirstLine ? ' first-line' : ''}`;
    label.style.backgroundColor = this.color;
    label.textContent = this.email.split('@')[0] || this.email;
    wrap.appendChild(label);

    return wrap;
  }

  ignoreEvent() {
    return true;
  }
}

export function createRemoteCursorsPlugin(
  collaborators: WSUserPresence[], 
  fileUuid?: string, 
  cellId?: string,
  currentUserEmail?: string,
  currentUserId?: string
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        if (!fileUuid || !collaborators || collaborators.length === 0) {
          return builder.finish();
        }

        const docLen = view.state.doc.length;
        const matching = collaborators
          .filter(c => {
            // Do not render the user's own cursor as a remote collaborator cursor unless explicitly marked as 'self'
            if (c.user_id !== 'self') {
              if (
                (currentUserEmail && c.email?.toLowerCase() === currentUserEmail.toLowerCase()) ||
                (currentUserId && c.user_id === currentUserId)
              ) {
                return false;
              }
            }

            if (c.file_id !== fileUuid || !c.cursor || typeof c.cursor.head !== 'number') {
              return false;
            }
            const targetBlock = c.cursor.block_id || c.cursor.cell_id || c.block_id || c.cell_id;
            if (cellId && targetBlock) {
              return targetBlock === cellId;
            }
            if (!cellId && !targetBlock) {
              return true;
            }
            return false;
          })
          .sort((a, b) => a.cursor.head - b.cursor.head);

        for (const c of matching) {
          const pos = Math.max(0, Math.min(c.cursor.head, docLen));
          const line = view.state.doc.lineAt(pos);
          const isFirstLine = line.number === 1;

          builder.add(
            pos,
            pos,
            Decoration.widget({
              widget: new RemoteCursorWidget(c.email, c.color || '#3B82F6', isFirstLine),
              side: 1
            })
          );
        }

        return builder.finish();
      }
    },
    {
      decorations: v => v.decorations
    }
  );
}
