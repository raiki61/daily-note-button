const fs = require("node:fs/promises");
const path = require("node:path");
const { noteFileName, initialContent } = require("./note");

async function ensureNote(folder, now) {
  if (typeof folder !== "string") {
    throw new Error(`Daily note folder setting must be a path string, not ${JSON.stringify(folder)}`);
  }
  if (!path.isAbsolute(folder)) {
    throw new Error(`Daily note folder must be an absolute path: ${folder}`);
  }
  const file = path.join(folder, noteFileName(now));
  try {
    await fs.writeFile(file, initialContent(now), { flag: "wx" });
    return file;
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(`Daily note folder not found on this machine: ${folder}`);
    }
    if (err.code === "ENOTDIR") {
      throw new Error(`Daily note folder is not a folder: ${folder}`);
    }
    if (err.code !== "EEXIST") {
      throw new Error(`Could not create ${file}: ${err.message}`);
    }
  }
  // 'wx' also reports EEXIST for a directory or a dangling link; stat follows links, so only a real file passes.
  let stats;
  try {
    stats = await fs.stat(file);
  } catch (err) {
    throw new Error(`Could not read ${file}: ${err.message}`);
  }
  if (!stats.isFile()) {
    throw new Error(`Daily note path is not a file: ${file}`);
  }
  return file;
}

module.exports = { ensureNote };
