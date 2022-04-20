import type { IntervalUri } from "../libs/calendar-ld";
import type { HashUri } from "../libs/hash";

export type Task = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "Task";
  content: string;
  published: string;
};
export const createTask = (content: string, published = new Date()): Task => ({
  "@context": "http://docland.app/productivity.jsonld",
  "@type": "Task",
  content,
  published: published.toISOString(),
});

export type Complete = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "Complete";
  object: HashUri;
  published: string;
};

export const createComplete = (
  objectToComplete: HashUri,
  published = new Date()
): Complete => ({
  "@context": "http://docland.app/productivity.jsonld",
  "@type": "Complete",
  object: objectToComplete,
  published: published.toISOString(),
});

export type Schedule = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "Schedule";
  object: HashUri;
  target: IntervalUri;
  published: string;
};
