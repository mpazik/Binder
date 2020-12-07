import { Consumer, Provider } from "./types";
export type {
  Consumer,
  Provider,
  Processor,
  ClosableProvider,
  ProviderSetup,
  OnCloseRegister,
} from "./types";
export {
  entityListChanger,
  mapChanger,
  objectChanger,
  booleanChanger,
} from "./changers";
export type {
  EntityListChange,
  MapChange,
  BooleanChange,
  ObjectChange,
} from "./changers";
export * from "./processors";

export const dataPortal = <T>(): [
  provider: Provider<T>,
  consumer: Consumer<T>
] => {
  let consumer: ((value: T) => void) | undefined;
  return [
    (c) => {
      consumer = c;
    },
    (value) => {
      if (consumer) {
        consumer(value);
      } else {
        throw new Error("invoked data portal before it is set up");
      }
    },
  ];
};

export type Action = () => void;
export type HandlerRegister = (action: () => void) => void;

export const actionPortal = (): [register: HandlerRegister, action: Action] => {
  let handler: Action | undefined;
  return [
    (h) => (handler = h),
    () => {
      if (handler) {
        handler();
      } else {
        throw new Error("invoked action portal before it is set up");
      }
    },
  ];
};
