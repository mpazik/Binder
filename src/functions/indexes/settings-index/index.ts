import type { Callback } from "linki";

import type {
  DisplaySettings,
  Settings,
} from "../../../components/display-settings";
import { defaultSettings } from "../../../components/display-settings";
import type { ReplaceAction } from "../../../components/display-settings/replace-action";
import {
  nameFromCustomSchema,
  settingValueFromCustomSchema,
} from "../../../components/display-settings/replace-action";
import type { HashUri } from "../../../libs/hash";
import type { StoreName, StoreProvider } from "../../../libs/indexeddb";
import { storeGet, storePut } from "../../../libs/indexeddb";
import { isTypeEqualTo } from "../../../libs/linked-data";
import type { LinkedDataDelete } from "../../store/local-store";
import { registerRepositoryVersion } from "../../store/repository";
import type { DynamicStoreProvider } from "../dynamic-repo-index";
import { createDynamicStoreProvider } from "../dynamic-repo-index";
import type { Indexer, UpdateIndex } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SettingsRecord = {
  setting: string;
  value: string;
  startTime?: string;
  eventId: HashUri;
};

export type SettingsStore = StoreProvider<SettingsRecord>;
export type SettingsIndex = (
  ldId: HashUri
) => Promise<SettingsRecord | undefined>;

export const settingsStoreName = "settings-index" as StoreName;

export const index: Indexer<SettingsRecord> = (ld) => {
  if (!isTypeEqualTo(ld, "ReplaceAction")) return;
  const replaceAction = (ld as unknown) as ReplaceAction;
  const target = replaceAction.target;
  if (!target || typeof target !== "string") return;
  const replacer = replaceAction.replacer;
  if (!replacer || typeof replacer !== "string") return;

  const startTime =
    typeof replaceAction.startTime === "string"
      ? replaceAction.startTime
      : undefined;

  return {
    props: {
      setting: target,
      value: replacer,
      startTime,
      eventId: ld["@id"],
    },
    key: target,
  };
};

export const createSettingsStore = (): DynamicStoreProvider<SettingsRecord> =>
  createDynamicStoreProvider(settingsStoreName);

export const createSettingsIndex = (
  store: SettingsStore
): SettingsIndex => async (hashUri) => storeGet(store, hashUri);

export const createSettingsSubscription = (
  initSettings: SettingsRecord[]
): [
  displaySettings: DisplaySettings,
  update: (record: SettingsRecord) => void,
  subscribe: (c: Callback<Settings>) => void
] => {
  const settings = defaultSettings;
  const applyRecord = <T extends keyof Settings>(record: SettingsRecord) => {
    const setting = nameFromCustomSchema(record.setting) as T;
    settings[setting] = settingValueFromCustomSchema(record.value, setting);
  };

  initSettings.forEach(applyRecord);

  const subscriptions: Callback<Settings>[] = [];

  return [
    settings,
    (record) => {
      applyRecord(record);
      subscriptions.forEach((it) => it(settings));
    },
    (subscription) => {
      subscriptions.push(subscription);
      subscription(settings);
    },
  ];
};

const createSettingsPureIndexer = (store: SettingsStore): UpdateIndex => async (
  ld
) => {
  const record = index(ld);
  if (!record) return;
  await storePut(store, record.props, record.key);
};

export const createSettingsIndexer = (
  store: SettingsStore,
  deleteLinkedData: LinkedDataDelete,
  callback: Callback<SettingsRecord>
): UpdateIndex => async (ld) => {
  const record = index(ld);
  if (!record) return;
  const previous = await storeGet(store, record.key);
  if (
    previous &&
    record.props.startTime &&
    previous.startTime &&
    record.props.startTime < previous.startTime
  ) {
    console.log("Ignore older change settings event");
    return;
  }

  await storePut(store, record.props, record.key);
  callback(record.props);

  if (previous) {
    // we don't want to pollute space with all settings changes so we store only last one
    await deleteLinkedData(previous.eventId);
  }
};

registerRepositoryVersion({
  version: 8,
  stores: [{ name: settingsStoreName }],
  index: {
    storeName: settingsStoreName,
    indexerCreator: createSettingsPureIndexer,
  },
});
