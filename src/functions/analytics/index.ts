import posthog from "posthog-js";

import { ANALYTICS_KEY } from "../../config";
import { hashToName, hashString, HashName } from "../../libs/hash";
import { DriverAccount } from "../global-db";

export type AnalyticsSender = (key: string, props?: object) => void;
export type UserId = string;

export type AnalyticsUserUpdater<T> = (userId?: UserId, props?: T) => void;
export type AnalyticsInitializer<T> = (
  userId?: UserId,
  props?: T
) => Promise<[AnalyticsSender, AnalyticsUserUpdater<T>]>;

export const initPostHogAnalytics = <T>(
  apiKey: string
): AnalyticsInitializer<T> => async (userId, props) => {
  posthog.init(apiKey, {
    api_host: "https://app.posthog.com",
  });
  if (userId) {
    posthog.identify(userId, props);
  }

  return [
    (key, props) => {
      posthog.capture(key, props);
    },
    (userId, props) => {
      if (userId) {
        posthog.identify(userId, props);
      } else {
        posthog.reset();
      }
    },
  ];
};

export const initNoopAnalytics = <T>(): AnalyticsInitializer<T> => async (
  userId,
  props
) => {
  console.debug("analytics init", userId, props);
  return [
    (key, props) => {
      console.debug("analytics send", key, props);
    },
    (userId, props) => {
      console.debug("analytics update", userId, props);
    },
  ];
};

type HashedAccount = HashName;
const hashAccount = async ({
  driver,
  email,
}: DriverAccount): Promise<HashedAccount> =>
  hashToName(`${driver}-${email}`, hashString);

type RepoAccountProps = { driver: string };
export type UpdateAnalyticsRepoAccount = (account?: DriverAccount) => void;

export const initAnalyticsForRepoAccount = async (
  initAnalytics: AnalyticsInitializer<RepoAccountProps>,
  account?: DriverAccount
): Promise<[AnalyticsSender, UpdateAnalyticsRepoAccount]> => {
  const [sendAnalytics, updateUser] = await initAnalytics(
    account ? await hashAccount(account) : undefined,
    account ? { driver: account.driver } : undefined
  );

  return [
    sendAnalytics,
    async (account) =>
      updateUser(
        account ? await hashAccount(account) : undefined,
        account ? { driver: account.driver } : undefined
      ),
  ];
};

export const initConfiguredAnalyticsForRepoAccount = async (
  account?: DriverAccount
): Promise<[AnalyticsSender, UpdateAnalyticsRepoAccount]> =>
  initAnalyticsForRepoAccount(
    ANALYTICS_KEY
      ? initPostHogAnalytics(atob(ANALYTICS_KEY))
      : initNoopAnalytics(),
    account
  );

export type ErrorSender = <T extends { key: string; message?: string }>(
  errorLog: T
) => void;
export const createErrorSender = (
  sendAnalytics: AnalyticsSender
): ErrorSender => (props) => sendAnalytics("error", props);
