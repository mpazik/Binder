export type Opaque<V> = V & { readonly __opq__: unique symbol };
