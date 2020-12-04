import { Consumer, CloseHandler, Provider, OnCloseRegister } from "./types";
export type {
  Consumer,
  CloseHandler,
  OnCloseRegister,
  Provider,
  Processor,
  ClosableProvider,
  ProviderSetup,
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
export {
  reducer,
  combineLatest,
  map,
  filter,
  fork,
  merge,
  filterType,
  flatten,
  match,
} from "./processors";

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
        throw new Error("invoiced data portal before it is set up");
      }
    },
  ];
};

export const actionPortal = (): [
  register: OnCloseRegister,
  handler: CloseHandler
] => {
  let handler: CloseHandler | undefined;
  return [
    (h) => (handler = h),
    () => {
      if (handler) {
        handler();
      } else {
        throw new Error("invoiced action portal before it is set up");
      }
    },
  ];
};
