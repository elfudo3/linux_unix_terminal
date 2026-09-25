/** Shared fixture: a shell with a small, known filesystem. */
import { VirtualFS } from "../src/core/filesystem";
import { Shell } from "../src/core/shell";

export function makeShell(): Shell {
  const fs = new VirtualFS();
  fs.mkdir("/home/user/docs/archive", { parents: true });
  fs.mkdir("/home/user/src", { parents: true });
  fs.mkdir("/tmp");
  fs.mkdir("/etc");
  fs.writeFile("/home/user/notes.txt", "Buy milk\nCall Bob\nbuy bread\n");
  fs.writeFile("/home/user/.secret", "hidden\n");
  fs.writeFile("/home/user/docs/report.md", "# Report\n\nAll good.\n");
  fs.writeFile("/home/user/docs/archive/old.log", "ERROR disk full\nINFO ok\nERROR timeout\n");
  fs.writeFile("/home/user/src/app.py", "print('hi')\n");
  fs.writeFile("/home/user/src/app.js", "console.log('hi')\n");
  fs.writeFile("/etc/hosts", "127.0.0.1 localhost\n");
  return new Shell({ fs, cwd: "/home/user" });
}

/** Runs a line and returns just stdout, for terse assertions. */
export function out(shell: Shell, line: string): string {
  return shell.run(line).stdout;
}
