import type { Uri } from "../../components/common/uri";
import type { IntervalUri } from "../../libs/calendar-ld";
import type { HashUri } from "../../libs/hash";
import { as } from "../../libs/linki";

export type HabitUri = HashUri;
export type HabitObject = {
  id: HabitUri;
  title: string;
  emojiIcon: string;
  description?: string;
  trackEvents: HabitTrackEventObject[];
};

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

export type HabitTrackEventUri = HashUri;
export type HabitTrackEventObject = {
  status: HabitTrackStatusUri;
  interval: IntervalUri;
};
export type HabitTrackStatusUri = Uri;
export type HabitTrackStatus = {
  uri: HabitTrackStatusUri;
  title: string;
  emojiIcon: string;
  description: string;
};
const createHabitTrackStatusIdUri = (name: string): HabitTrackStatusUri =>
  "http://id.docland.app/habit-track-status/" + name;
export const habitTrackStatuses = as<Record<string, HabitTrackStatus>>()({
  accomplished: {
    uri: createHabitTrackStatusIdUri("accomplished"),
    title: "Accomplished",
    emojiIcon: "✅",
    description: "I fully accomplished this resolution",
  },
  partially: {
    uri: createHabitTrackStatusIdUri("partially"),
    title: "Partially",
    emojiIcon: "😐️",
    description: "I partially accomplished this resolution",
  },
  skipped: {
    uri: createHabitTrackStatusIdUri("skipped"),
    title: "Skipped",
    emojiIcon: "🅿️",
    description: "I planed day before to skip doing this resolution today",
  },
  emergency: {
    uri: createHabitTrackStatusIdUri("emergency"),
    title: "Emergency",
    emojiIcon: "⚠️",
    description:
      "I could not accomplish this resolution because of external factors",
  },
  difficulties: {
    uri: createHabitTrackStatusIdUri("difficulties"),
    title: "Difficulties",
    emojiIcon: "😣️",
    description: "I did not accomplish because on unpredicted difficulties",
  },
  failed: {
    uri: createHabitTrackStatusIdUri("failed"),
    title: "Failed",
    emojiIcon: "💩",
    description: "I did not accomplish because I was lazy or forgot about it",
  },
});
