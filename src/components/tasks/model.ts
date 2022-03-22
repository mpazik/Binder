import type { HashUri } from "../../libs/hash";

export type TaskObject = {
  id: HashUri;
  content: string;
} & ({ completed: false } | { completed: true; completionTime: Date });
