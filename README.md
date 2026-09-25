# Terminal Trainer

A virtual Linux terminal that runs in your browser, with guided exercises to help you get good at the command line. Nothing touches a real computer: the filesystem, the shell and every command are simulated, so you can `rm -rf` to your heart's content.

![Terminal Trainer screenshot](docs/screenshot.png)

## What you get

- **A realistic shell.** Pipes (`|`), redirects (`>`, `>>`, `<`), `&&` / `||` / `;`, quotes, `$VARIABLES`, `~`, wildcards (`*.txt`), Tab completion, Up/Down history, `Ctrl+L`, `Ctrl+C`.
- **40 commands** with real error messages and `man` pages: `ls cd pwd tree cat touch mkdir rm rmdir cp mv chmod echo head tail wc grep sort uniq cut tr sed awk find which xargs whoami hostname uname date history clear env printenv export unset true false help man`.
- **62 exercises** across navigation, files, viewing, searching, pipes, permissions and environment. Each is checked automatically after every command. Progress is saved in your browser.
- **Zero runtime dependencies.** The whole app is 26 KB gzipped and works offline once loaded.

## Run it locally

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
npm run dev
```

Open the URL it prints (usually <http://localhost:5173>).

## Run the tests

```bash
npm test          # run everything once
npm run test:watch
```

The project was built test-first. There are 165 tests: every command, the parser, the filesystem, tab completion, the trainer, the two UI views, and a test that solves every exercise with its own reference answer.

## Deploy it

```bash
npm run build
```

This type-checks the code and writes a static site to `dist/`. Upload that folder to any static host (GitHub Pages, Netlify, Vercel, an S3 bucket, nginx...). Paths are relative, so it works from a sub-folder too.

**GitHub Pages:** the workflow in `.github/workflows/ci.yml` runs the tests on every push and deploys `dist/` to Pages on pushes to `main`. Turn it on once under *Settings → Pages → Source: GitHub Actions*.

## How it is organised

```
index.html              the page
src/
  main.ts               entry point: wires the three layers together
  styles.css
  core/                 the shell, no DOM code, fully unit tested
    filesystem.ts       in-memory filesystem (files, dirs, permissions)
    parser.ts           command line → words, pipes, redirects
    glob.ts             *.txt expansion
    shell.ts            runs a line: expansion, pipes, redirects, exit codes
    completion.ts       Tab completion
    sample-fs.ts        the files you start with
    commands/           one file per group: navigation, files, text, search, system, help
  trainer/              practice mode
    challenges.ts       the exercises
    trainer.ts          loads a task, checks it, saves progress
    commands.ts         task, hint, answer, next, skip, progress, reset
  ui/                   the widget
    terminal.ts         output log + input line, keyboard handling
    panel.ts            the task card beside the terminal
tests/                  mirrors src/
```

The layers only point downwards: `ui` uses `trainer` and `core`; `trainer` uses `core`; `core` uses nothing. Each command is a small object with a name, a summary, a `man` text and a `run` function, so `help` and `man` are generated from the same data the shell runs.

## Add a command

1. Add an object to the right file in `src/core/commands/` (or a new file, and list it in `commands/index.ts`):

   ```ts
   export const rev: Command = {
     name: "rev",
     category: "Text",
     summary: "reverse each line",
     usage: "rev [file...]",
     details: "Prints each line of FILE (or stdin) backwards.",
     run: (ctx) => readInputs("rev", ctx, ctx.args, (text) =>
       joinLines(splitLines(text).map((line) => [...line].reverse().join(""))),
     ),
   };
   ```

2. Write a test in `tests/core/commands/` first: `expect(out(shell, "echo abc | rev")).toBe("cba\n")`.

## Add an exercise

Append an object to `src/trainer/challenges.ts`:

```ts
{
  id: "files-rev",              // unique and permanent (progress is stored by id)
  topic: "Files",
  title: "Backwards",
  task: "Print notes.txt with every line reversed.",
  hint: "There is a command called rev.",
  solution: ["rev notes.txt"],  // the test suite runs this to prove the check works
  check: ({ result }) => result.stdout.startsWith("daerb"),
}
```

`check` runs after every command and receives the shell (files, current directory, variables), the line typed, and what it printed. An optional `setup(shell)` prepares files before the task starts. Every task begins from a fresh copy of the sample filesystem.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Tab` | complete a command or path (press again to list options) |
| `↑` / `↓` | walk through history |
| `Ctrl+L` | clear the screen (same as `clear`) |
| `Ctrl+C` | cancel the line you are typing |
| `Ctrl+U` | erase the line you are typing |
