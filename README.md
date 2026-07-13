# TypstLab

**TypstLab** is a collaborative, offline-first interactive document editing platform. It merges the document-design simplicity of **Microsoft Word**, the scope model of **Jupyter Notebooks**, and the unparalleled typesetting quality of **Typst** — powered by a **Go** backend and a **PWA** frontend.

---

## ✨ Vision & Key Concepts

1. **User-friendly**: A fluid visual editing experience that doesn't hide the underlying power of Typst. It features autocomplete, linting, error diagnostics, and interactive tooltips (similar to the official Typst Web App) directly inline.
2. **Notebook Hybrid**: Break your documents into interactive cells of text or code.
3. **True Offline-First**: Sync and collaborate without a server connection. Typst is compiled directly in the browser via **WebAssembly**. All modifications are tracked locally via **CRDT** and synced seamlessly when connectivity is restored.
4. **Cooperative Development**: Real-time collaborative sessions over WebSockets/WebRTC with cursors, presence indicators, and conflict-free version merging.

---

## 🛠 Proposed Tech Stack

### Frontend (Progressive Web App)
- **Framework**: **React**.
- **Text Editor**: ??? with LSP, autocompletion, hover tooltips.
- **Typst Compilation**: Client-side rendering using **WebAssembly** to render PDFs or SVGs in milliseconds without a server.
- **Collaboration**: **Yjs** for conflict-free state resolution for server-backed sync.

### Backend
- **Networking**: High-performance WebSockets.
- **CRDT Synchronization**: Go-based Yjs protocol server wrapper to store and merge update chunks.
- **Database**: ??? Postgres or CoachDb
- **Authentication**: JWT/OAuth2 cookie-based authentication.

---

---

## 🗺 Roadmap


---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
