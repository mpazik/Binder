---
key: transaction-segment
name: Transaction Segment
tags: [ change-tracking ]
status: active
description: A bounded contiguous portion of transaction history whose sparse net contribution can be materialized, rebased, squashed, or checkpointed.
alternativeNames: [ history segment, chain segment, transaction chain segment, segment ]
sourceFiles:
  - packages/repo/src/model/transaction.ts
  - packages/repo/src/transaction-store.ts
  - packages/repo/src/transaction-applier.ts
relatesTo:
  - transaction
  - changeset
  - layer
  - entity-identity
  - repository
---

# Transaction Segment

## Details

### Overview

Binder stores immutable transactions connected by predecessor hashes. Every transaction has at most one predecessor, while multiple transactions may share the same predecessor. The complete transaction history can therefore branch even though the ancestry selected by any one head is linear.

A **transaction segment** is a bounded contiguous part of one such linear ancestry. Layers, branches, local tails, rebase, squash, and checkpoints all use transaction segments without making those concepts equivalent.

### Transaction graph, chain, and segment

#### Transaction graph

The transaction graph is the complete collection of immutable transactions and their predecessor relationships:

```text
       B1 → B2
      /
G → A1
      \
       C1 → C2
```

Each transaction has at most one predecessor. A transaction may have multiple successors when histories branch. Provenance links such as a relationship between an original and rebased transaction do not change application ancestry.

#### Transaction chain

A transaction head selects one complete linear ancestry:

```text
head B: G → A1 → B1 → B2
head C: G → A1 → C1 → C2
```

Replaying the selected chain materializes the state at its head.

#### Transaction segment

A transaction segment is identified by an ancestor base and a descendant head:

```text
(base, head]
```

The base transaction is excluded because it supplies the starting state. The head transaction is included. Both boundaries are identified by transaction hash.

For example:

```text
G → B1 → B2 → P1 → P2 → L1
```

contains these segments:

```text
base segment:       (G, B2]  = B1, B2
personal segment:   (B2, P2] = P1, P2
local-tail segment: (P2, L1] = L1
```

The base must be an ancestor of the head. `(H, H]` is a valid empty segment and contributes no state.

This example places every segment on one chain. Whether a layer's segment is attached to the lower layer's head in this way is an open question recorded below. The definition of a segment does not depend on it: a base is an ancestor in the segment's own chain.

A segment does not need a separate permanent identifier. Its exact version is identified by its base and head. A Layer or named ref provides stable semantic identity when one is needed across segment replacement.

### Heads and refs

A **head** is a transaction hash selecting a chain. A **ref** is a named pointer to a head.

```text
workspace/main       → W5
workspace/experiment → E3
```

Moving a ref does not mutate a transaction. It selects another immutable chain or replacement segment.

### Segment state

A **segment state** is the sparse state contribution produced by folding a transaction segment relative to its base:

```text
segmentState(base, head)
```

Suppose the base state contains:

```text
title  = Example
status = active
```

and the segment contains:

```text
T1: status = done
T2: privateNote = Review this
```

Its segment state is:

```text
status      = done
privateNote = Review this
```

It does not repeat the inherited `title` value.

Segment state may contain:
- entities created by the segment;
- field values and multi-value elements contributed by the segment;
- explicit field, element, and entity tombstones;
- retractions of contributions made by earlier segments of the same layer;
- config contributions;
- provenance needed by the query or inspection surface.

Absence means that the segment has no contribution for that entity, field, or element. It is distinct from an explicit tombstone that hides a contribution from an earlier segment.

A segment state is deterministic for a valid base and segment. It may be reconstructed by replay or stored as a derived query artifact.

#### Multi-value fields

A single-value field contributes at `(entity, field)`. A multi-value field contributes per element at `(entity, field, element)`, so an upper segment can add or hide one element without shadowing the elements below:

```text
lower:    tags = [research, database]
upper:    tags + datomic
resolved: tags = [research, database, datomic]
```

#### Retract

A layer may have several segments. A later segment can withdraw a value or tombstone that an earlier segment of the same layer contributed. This is a **retract**. It is not a tombstone: a tombstone hides the lower layer's value, a retract reveals it.

```text
earlier segment:  status = done
later segment:    status retracted
layer folded:     status absent
```

A key in a segment state is therefore absent, a value, a tombstone, or a retract. A retract only refers to the same layer, so a resolver reading several layers must know which segments belong to which layer.

#### Absolute and relative contributions

A contribution is **absolute** when its folded form does not depend on the base: set, clear, add or remove an element, tombstone. A contribution is **relative** when it does: insert at a position, patch an attribute of an inherited relation value.

A segment state built only from absolute contributions is a function of the segment alone and can be reused above any base. A segment state containing relative contributions is valid only for the base it was folded against and must be folded again when the base changes.

#### Touched keys

A segment state knows which keys it contributes. A resolver uses this to tell whether a hit in a lower state is definitive: it is when no higher state touches the same key.

### Segment state identity

A segment is identified by `(base, head)`. A segment state is identified by its content:

```text
segmentStateId = H(canonical sorted entries)
```

Different segments can produce the same segment state. `A → B → A` returns to the original state identity while adding two transactions to history. Splitting a layer's history into segments differently, or storing a segment state in another physical form, does not change this identity. It does not replace transaction identity.

### Folding is not squash

Folding derives segment state without changing transaction history:

```text
fold(segment) → segment state
```

For example:

```text
base: status = active
T1:   status = paused
T2:   status = done
```

folds to:

```text
status = done
```

The folded state does not inherently retain transaction boundaries, individual authors, timestamps, intermediate values, hashes, inverse information, or operation-level rebase intent.

Squash instead creates a shorter replacement transaction segment:

```text
squash(T1 → T2) → T′
```

with the required equivalence:

```text
apply(base, T′) = apply(base, T1, T2)
```

`T′` still has a predecessor, metadata, changesets, and a transaction hash. It may need to preserve operation structure that is absent from segment state. For example, two list insertions may need to remain insert operations rather than become a set of the final list so that later rebase behavior remains meaningful.

Segment state is therefore sufficient for queries and checkpoints, but not necessarily sufficient to construct a semantically faithful squash.

### Rebase

Rebase replaces a segment based on an old head with a new segment based on another head:

```text
old: (B2, P2]
new: (B3, P2′]
```

Transactions are rebased in order. Every replacement transaction points to the preceding transaction in the new chain. A changed predecessor or changeset produces a new transaction hash.

Original transactions remain immutable in the transaction graph. Provenance connects them to their replacements. Refs and Layer versions select the replacement segment.

Config keys in source transactions are resolved through source ancestry to config UIDs. Rebase preserves those UIDs and emits the keys selected by the destination ancestry, including deterministic collision suffixes where necessary.

### Checkpoints and pruning

A checkpoint stores materialized state anchored to a transaction head. It may store one segment state or a resolved state assembled from several segment states.

Creating a checkpoint does not change transaction history or transaction hashes. It only provides another verified starting point for materialization.

Pruning is separate. Pruning discards or archives transaction history behind a checkpoint and may reduce available undo, attribution, intermediate-state queries, stale rebase support, or conflict provenance. A retention policy must state which guarantees survive pruning.

### Invariants

1. A segment base is an ancestor of its head.
2. Transactions in a segment form one ordered path.
3. Folding a segment is deterministic against its declared base.
4. Segment state is sparse and distinguishes absence from an explicit tombstone.
5. Folding or checkpointing does not change transaction identity.
6. Rebase and squash create replacement transactions rather than mutate source transactions.
7. A replacement segment must satisfy transaction atomicity and repository validity at its new base.
8. A key in a segment state is absent, a value, a tombstone, or a retract. A retract refers only to an earlier segment of the same layer.
9. A segment state built only from absolute contributions is a function of the segment alone.
10. Segment state identity is a function of its canonical entries, not of the segment or its physical form.

### Open questions

1. **Layer roots.** The examples place all layers on one chain. Whether an upper layer's first transaction has the lower head as its predecessor, has no predecessor, or has a predecessor that is not rebased when the lower layer moves is undecided. How a layer's segment relates to its lower layer is a Layer property, not part of the segment definition.
