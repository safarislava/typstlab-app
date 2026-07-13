# TypstLab App

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://react.dev/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-624DE8?style=flat&logo=webassembly&logoColor=white)](https://webassembly.org/)

**TypstLab App** is the client-side Progressive Web App (PWA) for the TypstLab collaborative document editor. It merges the document-design simplicity of **Microsoft Word**, the scope model of **Jupyter Notebooks**, and the typesetting quality of **Typst** — running entirely in the browser via **WebAssembly**.

This repository contains the user interface and client-side compilation engine. For the backend synchronization service, see the TypstLab Backend repository.

---

## ✨ Key Frontend Features

1. **Inline Visual Editor (Notebook Hybrid)**:
   - Split documents into interactive, reorderable cells of rich text or Typst code.
   - Live preview rendering side-by-side or inline.
   - Code diagnostics, autocompletion, linting, and hover tooltips for Typst syntax.

2. **True Offline-First Architecture**:
   - **In-Browser Typst Compilation**: Uses WebAssembly to compile Typst source code to SVGs/PDFs client-side in milliseconds, eliminating server roundtrips.
   - **Local State & CRDT**: Local changes are tracked using **Yjs** CRDTs, stored in IndexedDB, and synchronized conflict-free once connection is established.

3. **Real-time Collaboration**:
   - Seamless collaboration via WebSockets/WebRTC.
   - Collaborative cursors, presence indicators, and peer list.

4. **Progressive Web App (PWA)**:
   - Installable on desktop and mobile.
   - Works fully offline with service workers caching application assets and WebAssembly modules.

---

## 🛠 Tech Stack

- **Framework**: [React](https://react.dev/) (with Vite for fast bundling)
- **Text Editor**: [CodeMirror 6](https://codemirror.net/) / [Monaco Editor](https://microsoft.github.io/monaco-editor/) (customized for Typst syntax and LSP integration)
- **Typst Compiler**: Client-side WASM compilation of [Typst](https://github.com/typst/typst)
- **Conflict-free Replicated Data Types (CRDT)**: [Yjs](https://github.com/yjs/yjs) with Y-IndexedDB provider for local storage
- **Styling**: Modern CSS / CSS Modules
- **Communication Protocol**: WebSockets & WebRTC via [y-websocket](https://github.com/yjs/y-websocket) and [y-webrtc](https://github.com/yjs/y-webrtc)

---

## 🗺 Roadmap (Frontend)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
