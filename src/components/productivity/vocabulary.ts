import type { IntervalUri } from "../../libs/calendar-ld";
import type { HashUri } from "../../libs/hash";
import type { Uri } from "../common/uri";

import type { HabitTrackStatusUri, HabitUri } from "./model";

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

export type Habit = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "Habit";
  title: string;
  emojiIcon: string;
  description: string;
};

export const createHabit = (
  emojiIcon: string,
  title: string,
  description: string
): Habit => ({
  "@context": "http://docland.app/productivity.jsonld",
  "@type": "Habit",
  title,
  emojiIcon,
  description,
});

export type HabitTrackEvent = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "HabitTrackEvent";
  object: HabitUri;
  target: IntervalUri;
  result: Uri;
  published: string;
};

export const createHabitTrackEvent = (
  habit: HashUri,
  interval: IntervalUri,
  status: HabitTrackStatusUri,
  published = new Date()
): HabitTrackEvent => ({
  "@context": "http://docland.app/productivity.jsonld",
  "@type": "HabitTrackEvent",
  object: habit,
  target: interval,
  result: status,
  published: published.toISOString(),
});

export type Start = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "Start";
  object: HashUri;
  published: string;
};

export const createStart = (
  objectToStart: HashUri,
  published = new Date()
): Start => ({
  "@context": "http://docland.app/productivity.jsonld",
  "@type": "Start",
  object: objectToStart,
  published: published.toISOString(),
});

export type Finish = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "Finish";
  object: HashUri;
  published: string;
};

export const createFinish = (
  objectToFinish: HashUri,
  published = new Date()
): Finish => ({
  "@context": "http://docland.app/productivity.jsonld",
  "@type": "Finish",
  object: objectToFinish,
  published: published.toISOString(),
});
