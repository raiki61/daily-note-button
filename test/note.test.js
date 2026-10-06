// UTC+9, so 00:30 local time is still the previous day in UTC. Set before any Date is made.
process.env.TZ = "Asia/Tokyo";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { isoDate, noteFileName, initialContent } = require("../src/note");
const { ensureNote } = require("../src/notefs");

test("uses ISO 8601 with zero padding", () => {
  assert.equal(isoDate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(isoDate(new Date(2026, 9, 6)), "2026-10-06");
});

test("uses the local calendar date, not UTC", () => {
  assert.equal(new Date(2026, 9, 6, 0, 30).getTimezoneOffset(), -540);
  assert.equal(isoDate(new Date(2026, 9, 6, 0, 30)), "2026-10-06");
  assert.equal(isoDate(new Date(2027, 0, 1, 0, 30)), "2027-01-01");
});

test("file name and heading carry the same date", () => {
  const d = new Date(2026, 11, 31);
  assert.equal(noteFileName(d), "2026-12-31.md");
  assert.equal(initialContent(d), "# 2026-12-31\n\n");
});

const now = new Date(2001, 1, 3, 9, 0);

async function tempDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daily-note-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test("creates a missing note named and headed with the given date", async (t) => {
  const dir = await tempDir(t);
  const file = await ensureNote(dir, now);
  assert.equal(file, path.join(dir, "2001-02-03.md"));
  assert.equal(await fs.readFile(file, "utf8"), "# 2001-02-03\n\n");
});

test("never overwrites an existing note", async (t) => {
  const dir = await tempDir(t);
  const existing = path.join(dir, "2001-02-03.md");
  await fs.writeFile(existing, "keep");
  assert.equal(await ensureNote(dir, now), existing);
  assert.equal(await fs.readFile(existing, "utf8"), "keep");
});

test("says why a folder setting cannot be used", async (t) => {
  const dir = await tempDir(t);
  const notAFolder = path.join(dir, "notes.txt");
  await fs.writeFile(notAFolder, "keep");
  const cases = [
    [123, /must be a path string/],
    ["notes/diary", /must be an absolute path: notes\/diary/],
    ["~/notes", /must be an absolute path: ~\/notes/],
    [path.join(dir, "gone"), /not found on this machine/],
    [notAFolder, /is not a folder/],
  ];
  for (const [folder, reason] of cases) {
    await assert.rejects(ensureNote(folder, now), { message: reason }, String(folder));
  }
  await assert.rejects(fs.stat(path.join(dir, "gone")), { code: "ENOENT" });
  assert.equal(await fs.readFile(notAFolder, "utf8"), "keep");
});

test("refuses a directory at the note path", async (t) => {
  const dir = await tempDir(t);
  await fs.mkdir(path.join(dir, "2001-02-03.md"));
  await assert.rejects(ensureNote(dir, now), { message: /not a file/ });
});

test("refuses a dangling link at the note path", { skip: process.platform === "win32" }, async (t) => {
  const dir = await tempDir(t);
  const link = path.join(dir, "2001-02-03.md");
  await fs.symlink(path.join(dir, "elsewhere.md"), link);
  await assert.rejects(ensureNote(dir, now), { message: /Could not read/ });
  await assert.rejects(fs.stat(path.join(dir, "elsewhere.md")), { code: "ENOENT" });
});

test(
  "reports other errors with the file it could not create",
  { skip: process.platform === "win32" || process.getuid?.() === 0 },
  async (t) => {
    const dir = await tempDir(t);
    await fs.chmod(dir, 0o500);
    try {
      await assert.rejects(ensureNote(dir, now), { message: /Could not create .*EACCES/ });
    } finally {
      await fs.chmod(dir, 0o700);
    }
  },
);
