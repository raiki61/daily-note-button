// Not a Proxy, so a call to a member not defined here throws instead of passing silently.
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const fake = {
  calls: [],
  items: [],
  commands: new Map(),
  settings: {},
  dialogs: [],
  errorAnswers: [],
  openFails: undefined,
  updateFails: undefined,
  workspaceFolders: undefined,
  reset({ settings = {}, dialogs = [], errorAnswers = [], openFails, updateFails, workspaceFolders } = {}) {
    Object.assign(fake, { calls: [], items: [], settings, dialogs, errorAnswers, openFails, updateFails, workspaceFolders });
    fake.commands.clear();
  },
  called(name) {
    return fake.calls.filter((c) => c.name === name);
  },
};

function record(name, args) {
  fake.calls.push({ name, ...args });
}

class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}

module.exports = {
  fake,
  Range,
  StatusBarAlignment: { Left: 1, Right: 2 },
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  Uri: {
    file: (fsPath) => ({ scheme: "file", fsPath, toString: () => pathToFileURL(fsPath).href }),
  },
  commands: {
    registerCommand(id, callback) {
      fake.commands.set(id, callback);
      return { dispose: () => fake.commands.delete(id) };
    },
  },
  window: {
    createStatusBarItem(alignment, priority) {
      const item = {
        alignment,
        priority,
        shown: false,
        disposed: false,
        show: () => (item.shown = true),
        dispose: () => (item.disposed = true),
      };
      fake.items.push(item);
      return item;
    },
    async showOpenDialog(options) {
      record("showOpenDialog", { options });
      return fake.dialogs.shift();
    },
    async showErrorMessage(message, ...actions) {
      record("showErrorMessage", { message, actions });
      return fake.errorAnswers.shift() ? actions[0] : undefined;
    },
    async showInformationMessage(message) {
      record("showInformationMessage", { message });
    },
    async showTextDocument(doc, options) {
      record("showTextDocument", { doc, options });
    },
  },
  workspace: {
    get workspaceFolders() {
      return fake.workspaceFolders;
    },
    getConfiguration: (section) => ({
      get(key, defaultValue) {
        record("get", { section, key });
        const value = fake.settings[`${section}.${key}`];
        return value === undefined ? defaultValue : value;
      },
      async update(key, value, target) {
        record("update", { section, key, value, target });
        if (fake.updateFails) {
          throw fake.updateFails;
        }
        fake.settings[`${section}.${key}`] = value;
      },
    }),
    async openTextDocument(uri) {
      record("openTextDocument", { uri });
      if (fake.openFails) {
        throw fake.openFails;
      }
      const lines = fs.readFileSync(uri.fsPath, "utf8").split("\n");
      return {
        uri,
        lineCount: lines.length,
        lineAt: (line) => ({ range: { end: { line, character: lines[line].length } } }),
      };
    },
  },
};
