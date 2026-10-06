const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { registerHooks } = require("node:module");
const { pathToFileURL } = require("node:url");

const fakeUrl = pathToFileURL(path.join(__dirname, "fake-vscode.js")).href;
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    specifier === "vscode" ? { url: fakeUrl, shortCircuit: true } : nextResolve(specifier, context),
});

const vscode = require("vscode");
const { fake } = vscode;
const root = path.join(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const extension = require(path.resolve(root, pkg.main));

const properties = pkg.contributes.configuration.properties;
const [folderSetting] = Object.keys(properties);
const now = new Date(2001, 1, 3, 9, 0);

async function tempDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daily-note-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

const contributed = pkg.contributes.commands.map((c) => c.command);

function start(t, state, at = now) {
  fake.reset(state);
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: at });
  t.mock.method(console, "error", () => {});
  const context = { subscriptions: [] };
  extension.activate(context);
  const dispose = () => context.subscriptions.forEach((d) => d.dispose());
  t.after(dispose);
  const [item] = fake.items;
  const otherCommand = contributed.find((id) => id !== item.command);
  return {
    item,
    dispose,
    click: () => fake.commands.get(item.command)(),
    chooseFolder: () => fake.commands.get(otherCommand)(),
  };
}

function openedFiles() {
  return fake.called("openTextDocument").map((c) => c.uri.fsPath);
}

function selections() {
  return fake.called("showTextDocument").map((c) => c.options.selection);
}

test("registers the commands package.json contributes and shows the button", (t) => {
  const { item } = start(t);
  assert.deepEqual([...fake.commands.keys()].sort(), [...contributed].sort());
  assert.ok(contributed.includes(item.command));
  assert.equal(item.shown, true);
  assert.equal(item.text, "$(book) Today");
  assert.equal(item.tooltip, "Open 2001-02-03.md");
});

test("tooltip follows the date while the window stays open", (t) => {
  const { item } = start(t, {}, new Date(2001, 1, 3, 23, 59, 30));
  assert.equal(item.tooltip, "Open 2001-02-03.md");
  t.mock.timers.tick(60 * 1000);
  assert.equal(item.tooltip, "Open 2001-02-04.md");
});

test("disposing the subscriptions removes the button, the commands and the tooltip timer", (t) => {
  const { item, dispose } = start(t, {}, new Date(2001, 1, 3, 23, 59, 30));
  dispose();
  assert.equal(item.disposed, true);
  assert.deepEqual([...fake.commands.keys()], []);
  t.mock.timers.tick(60 * 1000);
  assert.equal(item.tooltip, "Open 2001-02-03.md");
});

test("Choose Folder saves another folder even when one is set, without opening a note", async (t) => {
  const dir = await tempDir(t);
  const { chooseFolder } = start(t, { settings: { [folderSetting]: "/elsewhere" }, dialogs: [[vscode.Uri.file(dir)]] });
  assert.equal(await chooseFolder(), dir);
  assert.equal(fake.called("showOpenDialog").length, 1);
  assert.deepEqual(
    fake.called("update").map((c) => [c.value, c.target]),
    [[dir, vscode.ConfigurationTarget.Global]],
  );
  assert.equal(fake.called("showInformationMessage").length, 1);
  assert.deepEqual(openedFiles(), []);
});

test("first click asks once, saves the folder machine-scoped, and opens the new note at its end", async (t) => {
  const dir = await tempDir(t);
  const { click } = start(t, { dialogs: [[vscode.Uri.file(dir)]] });
  const note = path.join(dir, "2001-02-03.md");

  await click();
  assert.equal(fake.called("showOpenDialog").length, 1);
  assert.deepEqual(
    fake.called("update").map((c) => [c.value, c.target]),
    [[dir, vscode.ConfigurationTarget.Global]],
  );
  assert.deepEqual(openedFiles(), [note]);
  assert.equal(await fs.readFile(note, "utf8"), "# 2001-02-03\n\n");
  const end = { line: 2, character: 0 };
  assert.deepEqual(selections(), [new vscode.Range(end, end)]);

  await fs.appendFile(note, "one\ntwo\nlast");
  await click();
  assert.equal(fake.called("showOpenDialog").length, 1);
  assert.equal(fake.called("update").length, 1);
  assert.deepEqual(openedFiles(), [note, note]);
  const newEnd = { line: 4, character: 4 };
  assert.deepEqual(selections()[1], new vscode.Range(newEnd, newEnd));

  const touched = [...fake.called("get"), ...fake.called("update")];
  assert.ok(touched.length > 0);
  for (const { section, key } of touched) {
    assert.equal(properties[`${section}.${key}`]?.scope, "machine", `${section}.${key}`);
  }
});

test("does nothing when the folder dialog is cancelled", async (t) => {
  const { click } = start(t, { dialogs: [undefined] });
  await click();
  assert.equal(fake.called("showOpenDialog").length, 1);
  assert.deepEqual(fake.called("update"), []);
  assert.deepEqual(openedFiles(), []);
  assert.deepEqual(fake.called("showErrorMessage"), []);
});

for (const local of [true, false]) {
  test(`asks for one folder and starts in the workspace folder only if it is local (${local ? "local" : "virtual"})`, async (t) => {
    const workspace = local
      ? vscode.Uri.file(await tempDir(t))
      : { scheme: "vscode-vfs", fsPath: "/repo", toString: () => "vscode-vfs://github/repo" };
    const { click } = start(t, { workspaceFolders: [{ uri: workspace }], dialogs: [undefined] });
    await click();
    const [{ options }] = fake.called("showOpenDialog");
    assert.equal(options.canSelectFolders, true);
    assert.equal(options.canSelectFiles, false);
    assert.equal(options.canSelectMany, false);
    assert.equal(options.defaultUri, local ? workspace : undefined);
  });
}

test("rejects a folder that is not on this machine's file system", async (t) => {
  const remote = { scheme: "vscode-vfs", fsPath: "/repo", toString: () => "vscode-vfs://github/repo" };
  const { click } = start(t, { dialogs: [[remote]] });
  await click();
  assert.deepEqual(fake.called("update"), []);
  assert.deepEqual(openedFiles(), []);
  assert.match(fake.called("showErrorMessage")[0].message, /vscode-vfs:\/\/github\/repo/);
});

test("reports a missing saved folder and asks for another only if the user wants to", async (t) => {
  const gone = path.join(await tempDir(t), "gone");
  const { click } = start(t, { settings: { [folderSetting]: gone }, errorAnswers: [false] });
  await click();
  const [error] = fake.called("showErrorMessage");
  assert.match(error.message, /not found on this machine/);
  assert.equal(error.actions.length, 1);
  assert.deepEqual(fake.called("showOpenDialog"), []);
  assert.deepEqual(openedFiles(), []);
});

test("recovers from a missing saved folder through the offered action", async (t) => {
  const dir = await tempDir(t);
  const gone = path.join(dir, "gone");
  const { click } = start(t, {
    settings: { [folderSetting]: gone },
    errorAnswers: [true],
    dialogs: [[vscode.Uri.file(dir)]],
  });
  await click();
  assert.equal(fake.called("showOpenDialog").length, 1);
  assert.deepEqual(fake.called("update").map((c) => c.value), [dir]);
  assert.deepEqual(openedFiles(), [path.join(dir, "2001-02-03.md")]);
  await assert.rejects(fs.stat(gone), { code: "ENOENT" });
});

test("reports a directory at the note path and offers to choose another folder", async (t) => {
  const dir = await tempDir(t);
  await fs.mkdir(path.join(dir, "2001-02-03.md"));
  const { click } = start(t, { settings: { [folderSetting]: dir }, errorAnswers: [false] });
  await click();
  const [error] = fake.called("showErrorMessage");
  assert.match(error.message, /not a file/);
  assert.equal(error.actions.length, 1);
  assert.deepEqual(openedFiles(), []);
});

for (const openFails of [new Error("cannot open"), "cannot open"]) {
  test(`logs an editor failure and does not offer another folder for it (${typeof openFails})`, async (t) => {
    const dir = await tempDir(t);
    const { click } = start(t, { settings: { [folderSetting]: dir }, openFails });
    await click();
    const [error] = fake.called("showErrorMessage");
    assert.equal(error.message, `Could not open ${path.join(dir, "2001-02-03.md")}: cannot open`);
    assert.deepEqual(error.actions, []);
    assert.deepEqual(
      console.error.mock.calls.map((c) => c.arguments),
      [[openFails]],
    );
    assert.deepEqual(fake.called("showTextDocument"), []);
  });
}

test("opens the picked folder's note when its setting cannot be saved, and says it was not saved", async (t) => {
  const dir = await tempDir(t);
  const { click } = start(t, { dialogs: [[vscode.Uri.file(dir)]], updateFails: new Error("settings file is broken") });
  await click();
  const [error] = fake.called("showErrorMessage");
  assert.match(error.message, /was not saved.*settings file is broken/);
  assert.deepEqual(error.actions, []);
  assert.deepEqual(fake.settings, {});
  assert.deepEqual(openedFiles(), [path.join(dir, "2001-02-03.md")]);
});

test("recovering from a missing folder still opens the note when the setting cannot be saved", async (t) => {
  const dir = await tempDir(t);
  const gone = path.join(dir, "gone");
  const { click } = start(t, {
    settings: { [folderSetting]: gone },
    errorAnswers: [true],
    dialogs: [[vscode.Uri.file(dir)]],
    updateFails: "policy",
  });
  await click();
  const messages = fake.called("showErrorMessage").map((c) => c.message);
  assert.equal(messages.length, 2);
  // The old folder stays set, so the next click uses it again rather than asking.
  assert.equal(messages[1], "Daily note folder was not saved, so the setting is unchanged: policy");
  assert.deepEqual(fake.settings, { [folderSetting]: gone });
  assert.deepEqual(openedFiles(), [path.join(dir, "2001-02-03.md")]);
});

test("Choose Folder reports a setting it cannot save instead of failing the command", async (t) => {
  const dir = await tempDir(t);
  const { chooseFolder } = start(t, { dialogs: [[vscode.Uri.file(dir)]], updateFails: new Error("read-only") });
  assert.equal(await chooseFolder(), dir);
  assert.match(fake.called("showErrorMessage")[0].message, /was not saved.*read-only/);
  assert.deepEqual(fake.called("showInformationMessage"), []);
});
