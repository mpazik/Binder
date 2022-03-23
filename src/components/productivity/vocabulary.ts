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

export type Undo = {
  "@context": "https://www.w3.org/ns/activitystreams";
  "@type": "Undo";
  object: HashUri;
  published: string;
};

export const createUndo = (
  actionToUndo: HashUri,
  published = new Date()
): Undo => ({
  "@context": "https://www.w3.org/ns/activitystreams",
  "@type": "Undo",
  object: actionToUndo,
  published: published.toISOString(),
});
