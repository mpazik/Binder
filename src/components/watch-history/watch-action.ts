import type { WatchAction as WatchActionSchema, WithContext } from "schema-dts";

export type WatchAction = WithContext<WatchActionSchema>;
export const createWatchAction = (
  url: string,
  startTime?: Date,
  endTime?: Date,
  agent?: string
): WithContext<WatchAction> => ({
  "@context": "https://schema.org",
  "@type": "WatchAction",
  ...(startTime ? { startTime: startTime.toISOString() } : {}),
  ...(endTime ? { endTime: endTime.toISOString() } : {}),
  ...(agent ? { agent } : {}),
  target: url,
});
