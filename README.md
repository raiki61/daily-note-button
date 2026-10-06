# Daily Note Button

[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/raiki-kiyomura.daily-note-button?label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=raiki-kiyomura.daily-note-button)
[![CI](https://github.com/raiki61/daily-note-button/actions/workflows/ci.yml/badge.svg)](https://github.com/raiki61/daily-note-button/actions/workflows/ci.yml)

One status bar button, **Today** with a book icon, that opens today's daily note. Nothing else to learn.

- Notes are named `YYYY-MM-DD.md` (ISO 8601), the same default as Obsidian and Foam, and kept flat in one folder.
- A missing note is created with a `# YYYY-MM-DD` heading. An existing note is never overwritten.
- Every click puts the cursor at the end of the note, ready for appending.
- The folder is chosen **once per machine**. The first click asks for it; after that the button just opens the note.

```
notes/diary/
├─ 2026-10-05.md
└─ 2026-10-06.md   ← Today
```

## Install

Search for **Daily Note Button** in the Extensions view, or run:

```
code --install-extension raiki-kiyomura.daily-note-button
```

Then click **Today** at the left end of the status bar and pick the folder for your notes.

## Settings

| Setting | Scope | Default |
| --- | --- | --- |
| `dailyNoteButton.folder` | machine | empty (ask on first click) |

The folder is an absolute path. It is declared with `machine` scope, so Settings Sync does not copy it: each computer keeps its own path (for example `/Users/me/notes/diary` on a Mac and `C:\Users\me\notes\diary` on Windows) while the extension itself still syncs.

## Commands

- `Daily Note: Open Today's Note` — same as the button.
- `Daily Note: Choose Folder for This Machine` — pick a different folder.

## Remote - SSH

The extension runs on the remote host, so the folder is a path on that host and the setting is stored in that host's settings.
