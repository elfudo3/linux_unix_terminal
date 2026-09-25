/** Environment and session: whoami, hostname, uname, date, history, clear, env, printenv, export, unset, true, false. */
import type { Command } from "../types";
import { joinLines } from "./args";

const CATEGORY = "System";

const simple = (name: string, summary: string, output: (ctx: Parameters<Command["run"]>[0]) => string): Command => ({
  name,
  category: CATEGORY,
  summary,
  usage: name,
  details: summary[0]!.toUpperCase() + summary.slice(1) + ".",
  run: (ctx) => ({ stdout: output(ctx) + "\n" }),
});

export const whoami = simple("whoami", "print your user name", ({ shell }) => shell.user);
export const hostname = simple("hostname", "print the machine's name", ({ shell }) => shell.host);

export const uname: Command = {
  name: "uname",
  category: CATEGORY,
  summary: "print system information",
  usage: "uname [-a]",
  details: "Prints the operating system name. -a prints everything: kernel, host, version and machine type.",
  run: ({ args, shell }) => ({
    stdout: args.includes("-a") ? `Linux ${shell.host} 6.1.0 #1 SMP x86_64 GNU/Linux\n` : "Linux\n",
  }),
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const date = simple("date", "print the current date and time", () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, " ");
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${day} ${time} UTC ${d.getUTCFullYear()}`;
});

export const history: Command = {
  name: "history",
  category: CATEGORY,
  summary: "show previously run commands",
  usage: "history [-c]",
  details: "Lists the commands you have typed, numbered. -c clears the list. Use the Up/Down arrow keys to recall commands.",
  run: ({ args, shell }) => {
    if (args.includes("-c")) {
      shell.history.length = 0;
      return {};
    }
    return { stdout: joinLines(shell.history.map((line, i) => `${String(i + 1).padStart(5)}  ${line}`)) };
  },
};

export const clear: Command = {
  name: "clear",
  category: CATEGORY,
  summary: "clear the screen",
  usage: "clear",
  details: "Clears the terminal screen. Ctrl+L does the same.",
  run: () => ({ clear: true }),
};

const envLines = (env: Map<string, string>) => joinLines([...env].map(([k, v]) => `${k}=${v}`));

export const env: Command = {
  name: "env",
  category: CATEGORY,
  summary: "list environment variables",
  usage: "env",
  details: "Prints every environment variable as NAME=value.",
  run: ({ shell }) => ({ stdout: envLines(shell.env) }),
};

export const printenv: Command = {
  name: "printenv",
  category: CATEGORY,
  summary: "print one or all environment variables",
  usage: "printenv [name]",
  details: "Prints the value of NAME, or every variable when no name is given. Exit status 1 if NAME is unset.",
  run: ({ args, shell }) => {
    const name = args[0];
    if (name === undefined) return { stdout: envLines(shell.env) };
    const value = shell.env.get(name);
    return value === undefined ? { code: 1 } : { stdout: value + "\n" };
  },
};

export const exportCmd: Command = {
  name: "export",
  category: CATEGORY,
  summary: "set an environment variable",
  usage: "export NAME=value",
  details: [
    "Sets NAME to VALUE so later commands can read it as $NAME.",
    "With no arguments, lists all exported variables.",
    "",
    "Example: export EDITOR=vim; echo $EDITOR",
  ].join("\n"),
  run: ({ args, shell }) => {
    if (args.length === 0) {
      const sorted = [...shell.env].sort(([a], [b]) => (a < b ? -1 : 1));
      return { stdout: joinLines(sorted.map(([k, v]) => `declare -x ${k}="${v}"`)) };
    }
    for (const arg of args) {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)(?:=(.*))?$/.exec(arg);
      if (!match) return { stderr: `bash: export: \`${arg}': not a valid identifier\n`, code: 1 };
      if (match[2] !== undefined) shell.env.set(match[1]!, match[2]);
    }
    return {};
  },
};

export const unset: Command = {
  name: "unset",
  category: CATEGORY,
  summary: "remove an environment variable",
  usage: "unset name...",
  details: "Deletes each NAME from the environment.",
  run: ({ args, shell }) => {
    for (const name of args) shell.env.delete(name);
    return {};
  },
};

export const trueCmd: Command = {
  name: "true",
  category: CATEGORY,
  summary: "do nothing, successfully",
  usage: "true",
  details: "Always exits with status 0. Useful for testing && and || chains.",
  run: () => ({}),
};

export const falseCmd: Command = {
  name: "false",
  category: CATEGORY,
  summary: "do nothing, unsuccessfully",
  usage: "false",
  details: "Always exits with status 1. Useful for testing && and || chains.",
  run: () => ({ code: 1 }),
};

export const systemCommands = [whoami, hostname, uname, date, history, clear, env, printenv, exportCmd, unset, trueCmd, falseCmd];
