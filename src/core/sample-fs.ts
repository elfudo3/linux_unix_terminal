/**
 * The starting "disk" for the sandbox: a small but realistic home directory
 * plus a few system files, so exercises have something to explore.
 * Every call returns a fresh copy, which makes resetting trivial.
 */
import { VirtualFS } from "./filesystem";
import { defaultCommands } from "./commands";

const HOME = "/home/user";

/** Lines are listed without trailing newlines; one is added per line. */
const lines = (...rows: string[]) => rows.join("\n") + "\n";

const FILES: Record<string, string> = {
  "/etc/hostname": "sandbox\n",
  "/etc/hosts": lines("127.0.0.1 localhost", "127.0.1.1 sandbox", "::1 localhost ip6-localhost"),
  "/etc/passwd": lines(
    "root:x:0:0:root:/root:/bin/bash",
    "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin",
    "www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
    "user:x:1000:1000:Sandbox User:/home/user:/bin/bash",
  ),
  "/etc/os-release": lines('NAME="Sandbox Linux"', 'VERSION="1.0"', "ID=sandbox"),
  "/var/log/syslog": lines(
    "Sep 25 08:00:01 sandbox systemd[1]: Started Daily apt download activities.",
    "Sep 25 08:15:22 sandbox sshd[812]: Accepted publickey for user from 10.0.0.5",
    "Sep 25 08:17:03 sandbox kernel: [  102.3] usb 1-1: new high-speed USB device",
    "Sep 25 09:01:44 sandbox cron[913]: (user) CMD (backup.sh)",
  ),

  [`${HOME}/README.txt`]: lines(
    "Welcome to your practice terminal!",
    "",
    "This is a safe sandbox: nothing you do here touches a real computer.",
    "Look around with ls, move with cd, and read files with cat.",
    "Type  help  to see every command, or  man <command>  for details.",
    "Type  task  to see your current exercise.",
  ),
  [`${HOME}/notes.txt`]: lines(
    "Shopping: milk, eggs, bread",
    "Call the dentist on Tuesday",
    "Ideas for the weekend: hike, museum, bake bread",
    "Remember to water the plants",
  ),
  [`${HOME}/todo.txt`]: lines("[ ] finish report", "[x] pay rent", "[ ] call Bob", "[ ] learn the terminal"),
  [`${HOME}/.bashrc`]: lines("# ~/.bashrc: executed by bash for non-login shells", "alias ll='ls -la'", "export EDITOR=nano"),
  [`${HOME}/.profile`]: lines("# ~/.profile", 'PATH="$HOME/bin:$PATH"'),

  [`${HOME}/documents/essay.txt`]: lines(
    "The Unix philosophy is simple: write programs that do one thing well.",
    "Write programs that work together.",
    "Write programs to handle text streams, because that is a universal interface.",
    "",
    "These ideas, first described in 1978, still shape how we build software.",
  ),
  [`${HOME}/documents/recipe.txt`]: lines(
    "Pancakes",
    "--------",
    "2 cups flour",
    "2 eggs",
    "1 cup milk",
    "1 tbsp sugar",
    "",
    "Mix everything, rest for 10 minutes, fry until golden.",
  ),
  [`${HOME}/documents/report.md`]: lines(
    "# Quarterly Report",
    "",
    "## Summary",
    "Sales grew 12% compared to last quarter.",
    "",
    "## Risks",
    "- Supplier delays",
    "- Currency fluctuations",
  ),
  [`${HOME}/documents/meeting-notes.txt`]: lines("2024-05-01: kickoff", "2024-05-08: design review", "2024-05-15: demo"),

  [`${HOME}/downloads/setup.sh`]: lines("#!/bin/bash", 'echo "Installing..."', "sleep 1", 'echo "Done."'),
  [`${HOME}/downloads/photo.jpg`]: "ÿØÿà (binary image data)\n",
  [`${HOME}/downloads/archive.tar.gz`]: "\u001f\u008b (compressed archive)\n",
  [`${HOME}/downloads/invoice.pdf`]: "%PDF-1.4 (pdf data)\n",

  [`${HOME}/projects/website/index.html`]: lines("<!doctype html>", "<html>", "  <body><h1>Hello, world!</h1></body>", "</html>"),
  [`${HOME}/projects/website/style.css`]: lines("body { font-family: sans-serif; }", "h1 { color: teal; }"),
  [`${HOME}/projects/website/app.js`]: lines("// TODO: add interactivity", 'console.log("ready");'),
  [`${HOME}/projects/scripts/backup.sh`]: lines("#!/bin/bash", "# TODO: exclude temp files", "cp -r ~/documents ~/backup"),
  [`${HOME}/projects/scripts/deploy.sh`]: lines("#!/bin/bash", 'echo "Deploying..."'),
  [`${HOME}/projects/scripts/hello.py`]: lines("def main():", '    print("Hello from Python")', "", "main()"),
  [`${HOME}/projects/README.md`]: lines("# Projects", "", "- website: a static site", "- scripts: small helpers"),

  [`${HOME}/data/people.csv`]: lines(
    "name,age,city",
    "Alice,34,London",
    "Bob,27,Paris",
    "Carla,45,Madrid",
    "Dmitri,31,Berlin",
    "Eve,29,London",
    "Farid,52,Cairo",
  ),
  [`${HOME}/data/scores.txt`]: lines("42", "17", "99", "8", "63", "99", "25"),
  [`${HOME}/data/words.txt`]: lines("apple", "banana", "apple", "cherry", "banana", "apple", "date"),
  [`${HOME}/data/servers.txt`]: lines("web-01 10.0.0.11 up", "web-02 10.0.0.12 down", "db-01 10.0.0.21 up", "cache-01 10.0.0.31 up"),

  [`${HOME}/logs/app.log`]: lines(
    "2024-06-01 10:00:01 INFO  Server started on port 8080",
    "2024-06-01 10:00:05 INFO  Connected to database",
    "2024-06-01 10:02:13 WARN  Slow query took 2.3s",
    "2024-06-01 10:05:44 ERROR Payment gateway timeout",
    "2024-06-01 10:05:45 INFO  Retrying payment",
    "2024-06-01 10:09:10 ERROR Disk usage above 90%",
    "2024-06-01 10:15:00 INFO  Nightly backup complete",
    "2024-06-01 10:20:31 WARN  Deprecated API called from client 10.0.0.5",
    "2024-06-01 10:25:02 ERROR Payment gateway timeout",
  ),
  [`${HOME}/logs/access.log`]: lines(
    '10.0.0.5 - - [01/Jun/2024:10:00:01] "GET / HTTP/1.1" 200',
    '10.0.0.7 - - [01/Jun/2024:10:00:02] "GET /about HTTP/1.1" 200',
    '10.0.0.5 - - [01/Jun/2024:10:00:03] "GET /missing HTTP/1.1" 404',
    '10.0.0.9 - - [01/Jun/2024:10:00:04] "POST /login HTTP/1.1" 302',
    '10.0.0.5 - - [01/Jun/2024:10:00:05] "GET /admin HTTP/1.1" 403',
  ),
};

const EMPTY_DIRS = ["/tmp", "/root", "/usr/local/bin", `${HOME}/pictures`, `${HOME}/backup`];

export function createSampleFS(): VirtualFS {
  const fs = new VirtualFS();
  for (const dir of EMPTY_DIRS) fs.mkdir(dir, { parents: true });
  for (const [path, content] of Object.entries(FILES)) {
    fs.mkdir(path.slice(0, path.lastIndexOf("/")), { parents: true });
    fs.writeFile(path, content);
  }
  // /usr/bin holds a stub for every command so `ls /usr/bin` looks familiar.
  fs.mkdir("/usr/bin", { parents: true });
  for (const cmd of defaultCommands) fs.writeFile(`/usr/bin/${cmd.name}`, "");
  for (const cmd of defaultCommands) fs.chmod(`/usr/bin/${cmd.name}`, 0o755);
  return fs;
}
