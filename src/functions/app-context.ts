export type AppContext = {
  user?: string;
  name?: string;
};

export type AppContextProvider = <K extends keyof AppContext>(
  key: K
) => AppContext[K];

export type AppContextSetter = (context: Partial<AppContext>) => void;

export const createAppContext = (): {
  provider: AppContextProvider;
  setter: AppContextSetter;
} => {
  let context: AppContext = {};
  return {
    provider: (key) => context[key],
    setter: (contextChange) => {
      context = { ...context, ...contextChange };
    },
  };
};
