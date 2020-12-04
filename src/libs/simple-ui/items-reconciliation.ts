import { dataPortal, Processor, Provider } from "./connections";
import { equal } from "./utils/equal";

export type ItemProvider<I, ID> = { id: ID; provider: Provider<I> };

type ItemProviderState<I, ID> = {
  id: ID;
  last: I;
  provider: Provider<I>;
  update: (item: I) => void;
};

export const itemsReconciliation = <I, ID>(
  getId: (item: I) => ID
): Processor<I[], ItemProvider<I, ID>[]> => (push) => {
  let firstRun = true;
  let state: ItemProviderState<I, ID>[];
  const find = (id: ID) => state.find((it) => it.id === id);

  const newProvider = (item: I): ItemProviderState<I, ID> => {
    const [provider, update] = dataPortal<I>();
    setImmediate(() => update(item));
    return {
      id: getId(item),
      provider,
      update,
      last: { ...item },
    };
  };

  return (items) => {
    if (firstRun) {
      // initialize state on the first run
      firstRun = false;
      state = items.map(newProvider);
      push(state.map(({ id, provider }) => ({ id, provider })));
      return;
    }

    // could be written better
    // an optimization to check if the number or order of items was modified
    // if not, there is no reason to re-render the list
    let listChanged = items.length !== state.length;
    const findLocal = (id: ID, index: number) => {
      if (!listChanged) {
        const item = state[index];
        if (item && item.id === id) {
          return item;
        }
        listChanged = true;
      }
      return find(id);
    };

    state = items.map((item, index) => {
      const id = getId(item);

      const existing = findLocal(id, index);
      if (existing) {
        if (!equal(item, existing.last)) {
          existing.update(item);
          existing.last = { ...item };
        }
        return existing;
      }

      return newProvider(item);
    });

    if (listChanged) {
      push(state.map(({ id, provider }) => ({ id, provider })));
    }
  };
};
