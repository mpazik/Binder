import type { HashUri } from "../../../libs/hash";
import type { LinkedDataWithHashId } from "../../../libs/jsonld-format";
import { getHash } from "../../../libs/linked-data";
import { createQueue } from "../../../libs/subscribe";
import {
  createSettingUpdateAction,
  defaultSettings,
} from "../../../vocabulary/setting-update";

import type { SettingsRecord } from "./index";
import { createSettingsSubscription, index } from "./index";

const eventStartTime = "2021-07-31T07:00:00.000Z";
const event = {
  ...createSettingUpdateAction("fontSize", "x-small", new Date(eventStartTime)),
  "@id": "nih:sha-256;431f89d9867ae1ef62a145cb7e7f402df1a4af35489631b50acb82f6718f92d6" as HashUri,
};
const record: SettingsRecord = {
  setting: "https://schema.docland.app/fontSize",
  value: "https://schema.docland.app/fontSize_x-small",
  startTime: eventStartTime,
  eventId: getHash(event),
};

describe("index", () => {
  test("handle correct ReplaceAction", async () => {
    event;
    const createdRecord = index(event);
    expect(createdRecord?.props).toEqual(record);
  });

  test("ignores different event type", async () => {
    const record = index({ ...event, "@type": "WatchEvent" });
    expect(record).toBeUndefined();
  });

  test("ignores event with missing properties", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { replacer, ...partialEvent } = event;
    const record = index(partialEvent as LinkedDataWithHashId);
    expect(record).toBeUndefined();
  });
});

describe("createSettingsSubscription", () => {
  test("push default settings upon subscription", async () => {
    const [push, pull] = createQueue();
    const [, , subscribe] = createSettingsSubscription([]);
    subscribe(push);
    expect(await pull()).toEqual(defaultSettings);
  });

  test("push initial settings upon subscription", async () => {
    const [push, pull] = createQueue();
    const [, , subscribe] = createSettingsSubscription([record]);
    subscribe(push);
    expect(await pull()).toEqual({
      ...defaultSettings,
      fontSize: "x-small",
    });
  });

  test("push new settings", async () => {
    const [push, pull] = createQueue();
    const [, update, subscribe] = createSettingsSubscription([]);
    subscribe(push);
    await pull(); // ignore initial setting

    update(record);

    expect(await pull()).toEqual({
      ...defaultSettings,
      fontSize: "x-small",
    });
  });
});
