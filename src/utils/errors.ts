export const throwIfNull = <T>(
  value: T | null | undefined,
  messageSupplier?: () => string
): T => {
  if (value) return value;
  if (messageSupplier) throw new Error(messageSupplier());
  throw new Error("Unexpected not set value");
};
