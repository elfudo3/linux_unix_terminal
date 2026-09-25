/** Built-in documentation: help and man. Both read the metadata every command carries. */
import type { Command } from "../types";

const CATEGORY = "Help";

/** The manual page for one command. */
function manualPage(cmd: Command): string {
  const indent = (text: string) => text.split("\n").map((l) => (l ? "    " + l : "")).join("\n");
  return [
    "NAME",
    `    ${cmd.name} - ${cmd.summary}`,
    "",
    "SYNOPSIS",
    `    ${cmd.usage}`,
    "",
    "DESCRIPTION",
    indent(cmd.details ?? cmd.summary),
    "",
  ].join("\n");
}

export const man: Command = {
  name: "man",
  category: CATEGORY,
  summary: "show the manual page for a command",
  usage: "man command",
  details: "Explains what COMMAND does, its options and some examples. Try: man ls",
  run: ({ args, shell }) => {
    const name = args[0];
    if (name === undefined) return { stderr: "What manual page do you want?\n", code: 1 };
    const cmd = shell.getCommand(name);
    if (!cmd) return { stderr: `No manual entry for ${name}\n`, code: 1 };
    return { stdout: manualPage(cmd) };
  },
};

export const help: Command = {
  name: "help",
  category: CATEGORY,
  summary: "list available commands",
  usage: "help [command]",
  details: "Lists every command grouped by topic. `help COMMAND` is the same as `man COMMAND`.",
  run: (ctx) => {
    if (ctx.args.length > 0) return man.run(ctx);
    // Group by category, keeping the order commands were registered in.
    const groups = new Map<string, Command[]>();
    for (const cmd of ctx.shell.listCommands()) {
      const key = cmd.category ?? "Other";
      groups.set(key, [...(groups.get(key) ?? []), cmd]);
    }
    const width = Math.max(...ctx.shell.commandNames().map((n) => n.length)) + 4;
    let text = "";
    for (const [category, cmds] of groups) {
      text += `${category}\n`;
      for (const cmd of cmds) text += `  ${cmd.name.padEnd(width)}${cmd.summary}\n`;
      text += "\n";
    }
    return { stdout: text + 'Type "man <command>" for details on one command.\n' };
  },
};

export const helpCommands = [help, man];
