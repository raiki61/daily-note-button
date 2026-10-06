const vscode = require("vscode");
const { noteFileName } = require("./note");
const { ensureNote } = require("./notefs");

const SECTION = "dailyNoteButton";

function activate(context) {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.text = "$(book) Today";
  item.command = `${SECTION}.openToday`;
  item.show();
  context.subscriptions.push(
    item,
    vscode.commands.registerCommand(`${SECTION}.openToday`, openToday),
    vscode.commands.registerCommand(`${SECTION}.chooseFolder`, chooseFolder),
  );
  refreshTooltip(item);
  // The date changes while the window stays open; keep the tooltip honest.
  const timer = setInterval(() => refreshTooltip(item), 60 * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

function refreshTooltip(item) {
  item.tooltip = `Open ${noteFileName(new Date())}`;
}

async function openToday() {
  const configured = vscode.workspace.getConfiguration(SECTION).get("folder", "");
  await openNoteIn(configured === "" ? await chooseFolder() : configured);
}

async function openNoteIn(folder) {
  if (folder === undefined) {
    return;
  }
  let file;
  try {
    file = await ensureNote(folder, new Date());
  } catch (err) {
    // Offer another folder right here, so a broken saved folder is not a dead end on every click.
    if (await vscode.window.showErrorMessage(err.message, "Choose Folder")) {
      await openNoteIn(await chooseFolder());
    }
    return;
  }
  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
    const end = doc.lineAt(doc.lineCount - 1).range.end;
    await vscode.window.showTextDocument(doc, { selection: new vscode.Range(end, end) });
  } catch (err) {
    // Another folder would not fix this, so keep the stack for a bug report instead of offering one.
    console.error(err);
    vscode.window.showErrorMessage(`Could not open ${file}: ${err?.message ?? err}`);
  }
}

async function chooseFolder() {
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Use for Daily Notes",
    title: "Choose the daily note folder for this machine",
    defaultUri: workspaceUri?.scheme === "file" ? workspaceUri : undefined,
  });
  if (!picked || picked.length === 0) {
    return undefined;
  }
  const folder = picked[0];
  // fsPath is only meaningful for file URIs; a folder on a virtual file system has no path to store.
  if (folder.scheme !== "file") {
    vscode.window.showErrorMessage(`Daily note folder must be on this machine's file system: ${folder.toString()}`);
    return undefined;
  }
  try {
    // Machine-scoped, so this lands in this machine's settings and Settings Sync leaves it alone.
    await vscode.workspace
      .getConfiguration(SECTION)
      .update("folder", folder.fsPath, vscode.ConfigurationTarget.Global);
  } catch (err) {
    // A broken or policy-locked settings file is not fixed by picking another folder, so still use this one.
    vscode.window.showErrorMessage(`Daily note folder was not saved, so the setting is unchanged: ${err?.message ?? err}`);
    return folder.fsPath;
  }
  vscode.window.showInformationMessage(`Daily notes on this machine: ${folder.fsPath} (${noteFileName(new Date())})`);
  return folder.fsPath;
}

function deactivate() {}

module.exports = { activate, deactivate };
