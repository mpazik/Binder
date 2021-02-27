export const throwIfNull = <T>(
  value: T | null | undefined,
  messageSupplier?: () => string
): T => {
  if (value) return value;
  if (messageSupplier) throw new Error(messageSupplier());
  throw new Error("Expected value to be defined and non null");
};

// accepts null as a value
export const throwIfUndefined = <T>(
  value: T | undefined,
  messageSupplier?: () => string
): T => {
  if (value !== undefined) return value;
  if (messageSupplier) throw new Error(messageSupplier());
  throw new Error("Expected value to be defined");
};
