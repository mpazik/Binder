import { createSettingUpdateAction } from "../../../components/display-settings/replace-action";
import { HashUri } from "../../../libs/hash";
import { LinkedDataWithHashId } from "../../../libs/jsonld-format";
import { getHash } from "../../../libs/linked-data";
import { createQueue } from "../../../libs/subscribe";

import { createSettingsSubscription, index, SettingsRecord } from "./index";

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
    // eslint-disable-next-line unused-imports/no-unused-vars-ts,@typescript-eslint/no-unused-vars
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
    expect(await pull()).toEqual({
      fontSize: "medium",
      lineLength: "small",
      theme: "light",
    });
  });

  test("push initial settings upon subscription", async () => {
    const [push, pull] = createQueue();
    const [, , subscribe] = createSettingsSubscription([record]);
    subscribe(push);
    expect(await pull()).toEqual({
      fontSize: "x-small",
      lineLength: "small",
      theme: "light",
    });
  });

  test("push new settings", async () => {
    const [push, pull] = createQueue();
    const [, update, subscribe] = createSettingsSubscription([]);
    subscribe(push);
    await pull(); // ignore initial setting

    update(record);

    expect(await pull()).toEqual({
      fontSize: "x-small",
      lineLength: "small",
      theme: "light",
    });
  });
});
