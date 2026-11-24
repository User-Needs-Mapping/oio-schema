# 0002: Fulfilment context (OIO 1.2)

**Status:** Proposed
**Date:** 2026-11-13
**Applies to:** `schemas/oio-schema.json`, `schemas/versions/oio-schema-1.1.0.json`

## Context

A need is often fulfilled by different capabilities in different situations. A meal reaches
a customer over a counter, through a drive-through window or by courier, and a different
capability does the work in each. OIO had no way to say so. Every `fulfilledBy` link read as
applying everywhere, and the workarounds were to write the situation into a description, or
to split one user or one need into several, which then drift apart and cannot be compared.

Fast Flow Toolkit (FFTK) has designed and begun shipping this as *contextual fulfilment*
(its spec of 2026-11-02, decisions D-1 to D-11). Its profile now declares a `context`
property on `fulfilled-by`, of a new field type `context-condition`: a map from a dimension
key to a non-empty list of value keys, with at most 6 dimensions and 12 values each, keys in
kebab-case. The vocabulary of dimensions and values lives in the workspace, not in the
graph. FFTK's spec names an upstream OIO change as the way to carry this through
interchange, and until there is one it plans to write each condition into the link's
description as a sentence, which no reader can parse back.

FFTK's spec also plans `applies_when` on `has-need` — whether a need arises in a situation
at all. That has not been built.

## Decision

Add fulfilment context to OIO as an optional structural addition, version 1.2.

### D1 — Context is structural, not investigation

`context_dimensions` and `fulfilledBy[].context` sit with the structural core. A condition
is a claim about where a link applies; it is not an observation, a hypothesis or a
decision. So projecting a document to its structural core keeps context, and projecting it
to 1.1 strips it and counts what was lost.

### D2 — The condition shape matches FFTK exactly

`context` is a map from a dimension key to a non-empty, duplicate-free list of value keys.
At most 6 dimensions, at most 12 values in any one. Keys are lowercase kebab-case, at most
64 characters. Dimensions combine with AND, values within one dimension with OR, and a
dimension left out is unspecified. An absent or empty `context` means the link applies in
every context, which is what every existing link has always meant.

Matching the consumer's shape exactly makes interchange a copy rather than a translation.
`npm run check:ontology` checks that FFTK still declares the property with the same type.

### D3 — The vocabulary travels in the document

`context_dimensions` declares each dimension's `key`, optional `name` and `description`, and
its `values`. A value is a bare key or an object with `key`, `name` and `description`, the
same short-form/long-form idiom OIO uses for relationships. Without the vocabulary a reader
gets keys with no names and cannot tell an unknown key from a known one.

The section name is snake_case, like every other top-level section. FFTK's spec sketched it
as `contextDimensions`; that sketch was illustrative and marked as needing an upstream
decision, and this is that decision.

### D4 — Unknown keys are reported, never refused

A condition may use a key `context_dimensions` does not declare. The validator warns and
the document stays valid. This follows FFTK's invariant that an unknown key is kept and
flagged: a vocabulary is edited in one place and links in another, and refusing a link
because the vocabulary moved would lose the claim the link records. A vocabulary that
declares the same dimension, or the same value within one dimension, twice is an error,
because a condition naming it cannot say which it means.

### D5 — Context belongs to `fulfilledBy` only

The general `relationship` definition is unchanged. `fulfilledBy` now uses its own
`fulfilmentRelationship`, which is `relationship` plus `context`. Context on any other link
is rejected. Nothing in FFTK's design puts it anywhere else, and widening later is additive
where narrowing would be breaking.

### D6 — Using any of it requires `oio_version: "1.2"`

The top level and every relationship object are closed. A 1.1 validator refuses a document
that carries context, so the document must say it needs 1.2 before anyone starts reading.
The schema enforces this for `context_dimensions` and for any `fulfilledBy` link with a
`context`, whether or not dimensions are declared. A document may declare 1.2 without using
anything 1.2 adds.

### D7 — Freeze 1.1

`schemas/versions/oio-schema-1.1.0.json` is the 1.1 schema as last published, with only its
`$id` and description changed. Tests check that 1.2 keeps every structural constraint 1.1
imposes, that every 1.1 example stays valid under 1.2, and that the 1.1 contract rejects
context.

## Consequences

- **No existing document changes meaning.** Every link without a context applies
  everywhere, as before. Every 1.0 and 1.1 document remains valid under 1.2.
- **FFTK cannot exchange context yet.** Its exporter and importer need to read and write
  the key, and to write `context_dimensions` from the workspace vocabulary. Until then its
  plan to write conditions into descriptions stands, and those descriptions should not be
  parsed back.
- **Promotion loss is FFTK's, not OIO's.** FFTK leaves `context` off canonical
  relationships (its D-8). An OIO document exported from a workspace carries conditions;
  one exported from organisation level will not.
- **`role` stays context-blind**, matching FFTK's open question J.5. Where a link plays a
  different part in different situations, record that as a signal.

## Not decided here

- **Need applicability** (`applies_when` on `has-need`). FFTK has not built it. In OIO a
  need has exactly one `user`, so it would most naturally be `need.applies_when` with the
  same condition shape. It should be added when FFTK ships it, not before.
- **Context on evidence.** Whether a signal or check-in should carry a context (FFTK's
  open question J.7).
- **Several conditions on one link.** FFTK decided one condition per link (its D-7), and
  OIO follows.

## Alternatives considered

- **Generic `context` on every relationship.** Rejected: no consumer needs it, and it would
  invite context on links where it has no defined meaning.
- **Flat tags (`string-list`) on the link.** Rejected for the same reason FFTK rejected it:
  the stored value would not say which dimension a value belongs to.
- **Leave it to descriptions.** Rejected: a sentence in a description cannot be matched,
  checked or imported.
- **Ship it as 1.1.** Rejected: a 1.1 validator already in use would refuse documents that
  claim to be 1.1.
