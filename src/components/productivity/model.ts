import type { IntervalUri } from "../../libs/calendar-ld";
import type { HashUri } from "../../libs/hash";
import { as } from "../../libs/linki";
import type { Uri } from "../common/uri";

export type TaskUri = HashUri;
export type TaskObject = {
  id: TaskUri;
  content: string;
} & ({ completed: false } | { completed: true; completionTime: Date });

export type HabitUri = HashUri;
export type HabitObject = {
  id: HabitUri;
  title: string;
  emojiIcon: string;
  description?: string;
  trackEvents: HabitTrackEventObject[];
};

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
