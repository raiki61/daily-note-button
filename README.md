# Daily Note Button

One status bar button, **Today** with a book icon, that opens today's daily note.

- Notes are named `YYYY-MM-DD.md` (ISO 8601), the same default as Obsidian and Foam, and kept flat in one folder.
- A missing note is created with a `# YYYY-MM-DD` heading.
- Every click puts the cursor at the end of the note, ready for appending.
- The folder is chosen **once per machine**. The first click asks for it; after that the button just opens the note.

## Why per machine

The folder lives in the `dailyNoteButton.folder` setting, declared with `machine` scope. Settings Sync does not copy machine-scoped settings, so each computer keeps its own path (for example `/Users/me/notes/diary` on a Mac and `C:\Users\me\notes\diary` on Windows) while the extension itself still syncs.

Over Remote - SSH the extension runs on the remote host, so the folder is a path on that host.

## Commands

- `Daily Note: Open Today's Note` — same as the button.
- `Daily Note: Choose Folder for This Machine` — pick a different folder.
