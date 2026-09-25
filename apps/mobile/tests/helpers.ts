/** Shared fixture for mobile screen tests: a shell on the sample filesystem plus a trainer over a tiny task list. */
import { Shell, Trainer, createSampleFS, trainerCommands, type Challenge } from "@terminal-trainer/core";

export const tinyChallenges: Challenge[] = [
  { id: "a", topic: "Basics", title: "Make a", task: "Create a file named a.", hint: "Use touch.", solution: ["touch a"], check: ({ shell }) => shell.fs.exists("/home/user/a") },
  { id: "b", topic: "Basics", title: "Make b", task: "Create b.", hint: "touch b", solution: ["touch b"], check: ({ shell }) => shell.fs.exists("/home/user/b") },
  { id: "c", topic: "Pipes", title: "Say hi", task: "Print hi.", hint: "echo", solution: ["echo hi"], check: ({ result }) => result.stdout === "hi\n" },
];

export function makeFixture(challenges: Challenge[] = tinyChallenges) {
  document.body.innerHTML = '<div id="root"></div>';
  const root = document.getElementById("root")!;
  const shell = new Shell({ fs: createSampleFS() });
  const trainer = new Trainer({ shell, challenges, freshFS: createSampleFS });
  for (const cmd of trainerCommands(trainer)) shell.register(cmd);
  return { root, shell, trainer };
}

export function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}
