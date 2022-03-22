import type { IntervalUri } from "../../libs/calendar-ld";
import type { HashUri } from "../../libs/hash";

export type Task = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "Task";
  content: string;
};

export const createTask = (content: string): Task => ({
  "@context": "http://docland.app/productivity.jsonld",
  "@type": "Task",
  content,
});

export type Complete = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "Complete";
  object: HashUri;
  published: string;
};

export type Schedule = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "Schedule";
  object: HashUri;
  target: IntervalUri;
  published: string;
};
