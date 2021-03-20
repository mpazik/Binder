export type Opaque<V> = V & { readonly __opq__: unique symbol };

type Narrowable = string | number | boolean | undefined | null | void | {};
export const tuple = <T extends Narrowable[]>(...t: T): T => t;
