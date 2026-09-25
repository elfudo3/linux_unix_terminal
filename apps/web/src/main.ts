/**
 * Entry point: builds the shell and trainer, mounts the terminal and the
 * practice panel, and connects them. This is the only file that knows
 * about all three layers.
 */
import "@terminal-trainer/ui/terminal.css";
import "./styles.css";
import { Shell, Trainer, challenges, complete, createSampleFS, describeTask, trainerCommands } from "@terminal-trainer/core";
import { createTerminal } from "@terminal-trainer/ui";
import { createPanel } from "./panel";

/** localStorage can throw (private mode, disabled storage); fall back to no persistence. */
function safeStorage(): Storage | undefined {
  try {
    localStorage.setItem("terminal-trainer.ping", "1");
    localStorage.removeItem("terminal-trainer.ping");
    return localStorage;
  } catch {
    return undefined;
  }
}

const shell = new Shell({ fs: createSampleFS() });
const trainer = new Trainer({ shell, challenges, freshFS: createSampleFS, storage: safeStorage() });
for (const cmd of trainerCommands(trainer)) shell.register(cmd);

const terminal = createTerminal(document.getElementById("terminal-root")!, {
  prompt: () => shell.prompt(),
  history: () => shell.history,
  complete: (line) => complete(shell, line),
  onSubmit: (line) => {
    const result = shell.run(line);
    if (result.clear) terminal.clear();
    terminal.print(result.stdout);
    terminal.print(result.stderr, "stderr");
    if (trainer.afterCommand(line, result) === "solved") {
      terminal.print(trainer.finished ? "✓ Task complete! That was the last one. Well done!\n" : "✓ Task complete! Type  next  to continue.\n", "success");
    }
  },
});

createPanel(document.getElementById("panel-root")!, trainer, { onCommand: (line) => terminal.submit(line) });

terminal.print(
  [
    "Welcome to Terminal Trainer. This is a simulated Linux shell: nothing here can harm a real computer.",
    "Type  help  to list commands,  man <command>  to learn one, or  task  to see your exercise.",
    "",
  ].join("\n"),
  "info",
);
terminal.print(describeTask(trainer), "info");
terminal.focus();
