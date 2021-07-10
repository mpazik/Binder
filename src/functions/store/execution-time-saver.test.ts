import { newExecutionTimeSaver } from "./execution-time-saver";

describe("execution time saver", () => {
  test("passes the date of start of the last execution", async () => {
    let currentTime: Date = new Date(2000, 10, 10);
    let lastSync: Date | undefined = undefined;

    const executionTimeSaver = newExecutionTimeSaver(
      () => currentTime,
      async () => lastSync,
      async (date) => {
        lastSync = date;
      }
    );

    await executionTimeSaver(async (date) => {
      expect(date).toBeUndefined();
    });

    let previousCurrentTime = currentTime;
    currentTime = new Date(2000, 11, 10);

    await executionTimeSaver(async (date) => {
      expect(date).toEqual(previousCurrentTime);
    });

    previousCurrentTime = currentTime;

    await executionTimeSaver(async (date) => {
      expect(date).toEqual(previousCurrentTime);
    });
  });
});
