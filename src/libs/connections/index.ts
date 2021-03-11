import { Consumer, Provider } from "./types";
export type {
  Consumer,
  Provider,
  Processor,
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
    (onClose, c) => {
      onClose(() => {
        consumer = undefined;
      });
      if (consumer) {
        throw new Error(
          "Data portal provider can not be subscribed multiple times"
        );
      } else {
        consumer = c;
      }
    },
    (value) => {
      if (consumer) {
        consumer(value);
      } else {
        throw new Error(
          "Data portal consumer was invoked before provider was set up"
        );
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
