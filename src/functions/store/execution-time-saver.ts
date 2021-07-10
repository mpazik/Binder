/**
 * executes an action with a date of start of it last execution
 */
export type ExecutionTimeSaver = (
  action: (since: Date | undefined) => Promise<void>
) => Promise<void>;

export const newExecutionTimeSaver = (
  getCurrentTime: () => Date,
  getLastSync: () => Promise<Date | undefined>,
  saveSyncTime: (date: Date) => Promise<void>
) => async (
  action: (date: Date | undefined) => Promise<void>
): Promise<void> => {
  const currentSync = getCurrentTime();
  const lastSync = await getLastSync();
  await action(lastSync);
  await saveSyncTime(currentSync);
};
