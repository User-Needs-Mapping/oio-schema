# 0001: The investigation, decision and learning extension (OIO 1.1)

**Status:** Proposed
**Date:** 2026-09-09
**Applies to:** `schemas/oio-schema.json`, `schemas/versions/oio-schema-1.0.0.json`

## Context

OIO is an interchange format for outside-in organisational models. Its structural core
carries users, needs, capabilities, technical systems, teams and their relationships.

The investigation around a model — what was observed, what might be limiting us, what
change we want, what we are deciding and why, what we learned afterwards — had nowhere
to go. The workaround was to write it into node descriptions. That keeps the words and
loses everything that makes them usable: which entity a report is about, who reported it,
whether anyone checked, which alternatives were weighed, and what a decision was taken
under. Once flattened into prose, a hypothesis and a finding look identical.

Fast Flow Toolkit (FFTK) is the motivating consumer. It already models Signals,
Constraints, Outcomes, Flow Decision Records and check-ins internally, with an agreed
ontology recorded in its own decision records. What it cannot do is exchange them: its
OIO exporter emits structural sections only, and its importer reads seven of the nine
sections the schema defines.

## What was found in the repository first

Three facts about the starting state, all verified, all of which shaped the design.

**The committed schema did not parse.** `schemas/oio-schema.json` was two closing braces
short. `need` and `capability` were each left unclosed, so `capability`, `technicalSystem`,
`team` and `teamInteraction` were nested inside their predecessors, and `orgGroup`,
`externalDependency`, `dataAsset` and `relationship` sat inside `teamInteraction`. Every
`$ref: "#/definitions/relationship"` in the file pointed at nothing. No validator could
have loaded it. Repairing this was a precondition for extending it, not an optional tidy-up.

**The repository identity in the file was wrong.** The schema's `$id` claimed
`User-Needs-Mapping/oio-datamodel`. That repository does not exist. The git remote is
`User-Needs-Mapping/unm-schema`, which the GitHub API resolves to
`User-Needs-Mapping/oio-schema` — the repository was renamed and the local remote still
carries the old name. `oio-schema` is therefore the canonical identity, and the `$id`
of both schema files now names it. UNM is a separate, third-party schema
(`krzachariassen/unm-platform`), which FFTK converts OIO into, one way and lossily; it is
not this repository's model and the two should not be conflated.

**There was no validator, no test, no README and no examples.** "Use the existing test
stack" had nothing to use. A minimal one was added: Node's built-in test runner, with
`ajv` and `yaml` as the only dependencies. Vitest is the usual preference, but a
schema-only repository with no build step does not earn a test framework it would
otherwise have to carry.

Two documentation defects were corrected without touching validation behaviour, because
both said something the enum did not:

- `capability.evolution_stage` described Wardley evolution as "maturity and stability"
  and glossed `commodity` as "being phased out or replaced". Evolution describes how
  ubiquitous and certain a practice is in the wider world. It is not internal
  effectiveness, not implementation maturity, and not retirement status. The description
  now says so; the four values are unchanged.
- `teamInteraction.health` described a value called `strained` that the enum does not
  contain, and omitted `neutral`, which it does. The description now matches the enum.

## Decision

### D1 — Extend by adding optional top-level sections, not by an envelope

Five new sections join the existing nine: `metrics`, `signals`, `constraints`, `outcomes`,
`flow_decision_records`. This follows the convention already in the file — flat, snake_case,
one array per kind — and keeps structural-only authoring exactly as it was. A model with no
investigation simply omits them.

An extension envelope (`extensions: { investigation: … }`) was considered and rejected: it
would have made every reference two levels deep for no gain, since `additionalProperties:
false` means an old validator rejects the document either way.

### D2 — Stable identifiers, document-global, with names left alone

Every structural entity gains an optional `id`. Every investigation record requires one.
The long form of `relationship`, and `teamInteraction`, gain an optional `id` so a signal
can point at an edge rather than only at its endpoints.

- **Uniqueness is document-global**, across every identified thing, not per section. Names
  remain per-section, as they were.
- **Investigation records reference by id only.** Structural sections keep referencing by
  name, unchanged. Referencing a structural entity from an investigation record therefore
  requires giving that entity an `id` — the smallest possible migration, applied only where
  evidence is actually being attached.
- **Ambiguity is an error.** A duplicated id fails the document. A name matching more than
  one allowed target type fails the document. Neither is resolved to a first match. This
  diverges deliberately from FFTK's importer, which resolves a name by trying allowed types
  in order; that behaviour turns an authoring mistake into a silently wrong graph.
- **A reference that resolves to nothing is an error**, and a reference resolving to a type
  the link does not allow is an error. `teamInteraction.via` is the one exception: it is
  documented as free text, so an unresolved `via` is reported as a warning.

### D3 — Reuse FFTK's agreed vocabulary; add only the axis it lacks

Where FFTK has already settled a vocabulary, OIO uses it unchanged, so that interchange is
a mapping and not a translation. That covers `signal_type` and `severity`; constraint
`certainty` and `standing`; outcome `status` and `archived_reason`; FDR `phase`, `status`,
`rollout_status`, `verdict`, `intervention_type`, `confidence`, `reversibility`; the
`affects` role; and the `reveals` effect.

OIO adds what an interchange document needs and an application database does not:

- **`provenance`** on signals, constraints, outcomes, decisions and check-ins — source,
  source type, who recorded it, when. FFTK records provenance in a server-side append-only
  event log, which does not travel with an exported document. If provenance is not carried
  in the document, it does not survive the boundary.
- **`evidence`** on signals: `reported · corroborated · direct-observation · measured ·
  disputed`. This is a third axis, independent of `signal_type` (what kind of tension) and
  `severity` (how much it matters). A reported concern can be critical and uncorroborated
  at the same time. **These values are not a ranked scale**, and the field has no default:
  an unknown evidence status is recorded by omitting it, never by inventing one.
- **`observed_at` and `observation_window`** alongside `provenance.recorded_at`, so when
  something happened stays distinct from when it was reported. Both accept a year, a month
  or a day, so an imprecisely known date is not padded into a false precision.
- **`options` and `chosen_option`** on decisions. FFTK's FDR has no field for alternatives
  considered. A decision record without them cannot answer why the chosen path was chosen.
- **`question`** on decisions, so the record stays answerable if the chosen option is later
  replaced.
- **`interpretation`** on check-ins, kept separate from the observation. This is a known
  lossy point on import to FFTK, which deliberately derives its equivalent rather than
  storing it; see D6.
- **`success_criteria`** on outcomes: qualitative, plural, and enough on their own. An
  outcome is representable with no measure, target or date.

### D4 — Relationships are declared on the source, using the established names

Direction follows the existing OIO convention that one end is the source of truth. The
relationship names are FFTK's, per its "shortest verb phrase a facilitator would use" rule.

| Relationship | Declared on | Targets |
|---|---|---|
| `references` | `signal`, `constraint`, `outcome` | any structural entity, team interaction or identified relationship |
| `cites` | `flow_decision_record` | `signal` |
| `reveals` | `signal` | `constraint`, with `effect: revealed · confirmed · contradicted` |
| `impedes` | `signal` | `flow_decision_record`, with `encountered_at` |
| `bounds` | `constraint` | `flow_decision_record`, `outcome`, with `state_at_commit` |
| `serves` | `flow_decision_record` | one `outcome` |
| `affects` | `flow_decision_record` | `user`, `need`, `capability`, `team`, `external_dependency`, with `role` |
| `requires` | `flow_decision_record` | `flow_decision_record` |
| `beneficiaries` | `outcome` | `user`, `team`, `org_group` |
| `supersedes` | any investigation record | a record of the same kind |

No generic association edge is introduced. Four kinds of link that a single "related to"
edge would collapse are kept apart: structural dependency (`dependsOn`), evidential support
(`cites`, `reveals`), intended effect (`serves`, `affects`), and temporal sequence
(`supersedes`, and the dates on records). `requires` orders decisions against each other and
must not be read as a process flow through the structural graph.

### D5 — Impediment is a relationship; there is no Impediment entity

A signal that obstructs enactment of a decision links to it with `impedes`. It keeps its own
`signal_type`, so the same signal can obstruct one decision and be cited as evidence by
another. Encountering an obstruction does not create a constraint: if a standing condition
lies behind it, that is a separate constraint, linked with `reveals`.

### D6 — A constraint's history is not rewritten by its present

`constraint.certainty` and `constraint.standing` are independent axes and both describe the
constraint *now*. `bounds[].state_at_commit` records what the constraint's certainty was when
the decision it bounds was committed, and is deliberately allowed to disagree with the current
value. A condition later confirmed, or later lifted, does not retroactively change what a
decision was taken under. The `decision-and-review` example demonstrates exactly this case and
a test pins it.

This is the whole of the historical mechanism. There is no event log, no revision chain and no
event sourcing: consequential history is carried by `supersedes` keeping the superseded record
in the document, by the dated check-ins, and by `state_at_commit`.

### D7 — Four axes on a decision, never collapsed

`status` (where it stands as a decision) · `phase` (where it sits on a roadmap) ·
`rollout_status` (how far enactment got) · `verdict` (what a review concluded). A `draft`
record implies no approval, no commitment and no enactment; it may carry `options` and no
`decision` text at all, which is the honest representation of an open question. `decision`
becomes required once `status` leaves draft, and `verdict` once `status` is `reviewed`.

The review conclusion is called **`verdict`**, never "outcome". An Outcome is a change in
conditions being pursued; a verdict is a judgement about a bet. A decision can be judged
`validated` while the outcome it serves is still `observing`.

### D8 — `need.outcome` keeps the meaning it had

`need.outcome` is a first-person sentence about what success looks like for a user. It is
not, and must never be reinterpreted as, a reference to an entry in the `outcomes` section.
The description now says so explicitly. Legacy documents are unaffected.

### D9 — Version selection is explicit, and forward compatibility is not claimed

`schemas/oio-schema.json` is the current schema. `schemas/versions/oio-schema-1.0.0.json` is
the frozen structural contract, generated once from the repaired core and verified to differ
from the committed original in nothing but its `$id`, its description and the two corrected
descriptions above — no property, type, enum or `required` change.

`system.oio_version` declares which contract a document was written against, and is
**required whenever any investigation section is present**, enforced by the schema. A
consumer can therefore decide whether it can read a document before it starts reading it.
`system.profiles` optionally names producer-specific profiles so a consumer can report the
ones it does not implement.

The compatibility position, stated plainly:

- **An existing structural document stays valid**, under both the frozen 1.0 contract and the
  current schema. Tested.
- **An extended document is rejected by a 1.0 validator.** The top level is closed with
  `additionalProperties: false`, so optional new sections buy no forward compatibility
  whatsoever. Tested, so that nobody documents it the other way round.
- **Structural-only projection is lossy and says so.** `projectToStructural` returns the
  dropped sections and their record counts. Projecting all the way back to 1.0 additionally
  strips identifiers and reports how many, because 1.0 has no room for them.

Presentation stays out: frames, canvas positions, colours and interface settings have no
place in the shared semantic core, and `system.profiles` is where a producer declares it has
its own.

The JSON Schema dialect stays draft-07. Nothing in this extension needs a later one, and
changing it would break FFTK's Ajv configuration for no benefit.

## Consequences

- **FFTK cannot import any of this today.** The schema is available; converter and
  application support are separate facts and neither exists. The follow-up work is listed in
  the README.
- **FFTK's vendored copy of the schema is stale**, missing `decomposesInto`, `size_band` and
  the `tags` removal, and carrying the unparseable structure. Updating it is FFTK-side work
  and is deliberately out of scope here.
- **`check_in.interpretation` has no home in FFTK**, which derives its equivalent by design
  rather than storing it. An importer must either drop it or park it, and must say which.
- **Edge-level uncertainty is not supported**, and no substitute is offered. `relationship.role`,
  `fulfilledBy` degree and dependency strength keep their structural meanings and must never be
  used to encode confidence. Where a structural link is a hypothesis, record a signal with an
  `evidence` status that references the entities involved — or, if the edge is declared in long
  form, give it an `id` and reference the edge itself. The `investigation-unvalidated` example
  does the former for two needs attributed to executives, and says so in a comment.
- **The validator is stricter than FFTK's importer** on name ambiguity. A document FFTK would
  import by picking the first match fails here.

## Alternatives considered

- **Free-form annotations on existing entities.** Rejected: it reproduces the description
  workaround with more syntax and still cannot express a typed relationship or a provenance.
- **Signals, constraints and outcomes as graph nodes with generic typed edges.** Rejected: a
  generic edge language would have to carry allowed source and target types anyway, and would
  invite the "related to" edge that makes every roll-up meaningless.
- **Check-ins as independently identified records in their own top-level section.** Rejected:
  nothing references a check-in except the record it belongs to, so an embedded list is the
  smaller representation. They still carry ids, so they can be cited if that ever changes.
- **Adding `superseded` to constraint `standing`.** Rejected: it would fork FFTK's agreed
  three-value enum. Supersession is a separate link, as it already is for decisions.
- **Renaming `evolution_stage` or changing its values** to resolve the conflation in its
  description. Rejected: the description was wrong, not the enum. Only the description changed.
