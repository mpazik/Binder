import type {
  ReplaceAction as ReplaceActionSchema,
  WithContext,
} from "schema-dts";

export type ReplaceAction = WithContext<ReplaceActionSchema>;

export const createReplaceAction = (
  target: string,
  replacer: string,
  replacee?: string,
  startTime?: Date,
  agent?: string
): WithContext<ReplaceAction> => ({
  "@context": "https://schema.org",
  "@type": "ReplaceAction",
  ...(startTime ? { startTime: startTime.toISOString() } : {}),
  ...(agent ? { agent } : {}),
  target,
  replacer,
  ...(replacee ? { replacee } : {}),
});
