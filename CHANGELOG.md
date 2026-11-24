# @user-needs-mapping/oio-schema

## 1.2.0 (unreleased)

### Minor Changes

- d44c193: Add fulfilment context. `context_dimensions` declares the situations a model
  distinguishes between, and a `fulfilledBy` link can carry a `context` saying which of them
  it holds in, in the same shape Fast Flow Toolkit uses. Undeclared keys produce warnings, not
  errors. Using either requires `oio_version: "1.2"`. The 1.1 schema is frozen as
  `schemas/versions/oio-schema-1.1.0.json`. See
  [decision 0002](docs/decisions/0002-fulfilment-context.md).
- [#3](https://github.com/User-Needs-Mapping/oio-schema/pull/3): Add `stance` to signals: `observation` or `working-explanation`, defaulting to
  `observation`. Shared vocabulary with Fast Flow Toolkit. A document recording a stance
  must declare `oio_version: "1.2"`.

### Patch Changes

- c2bcae7: License under Apache 2.0, with the grant from the author of the original User
  Needs Mapping schema recorded in `LICENSING.md` and attribution in `NOTICE`.

## 1.1.0 (2026-09-09)

### Minor Changes

- 08f7e18: Add the optional investigation extension: `signals`, `constraints`, `outcomes`,
  `flow_decision_records`, `metrics` and embedded check-ins, with stable identifiers on
  structural entities so that evidence stays attached through a rename. Using any of it
  requires `oio_version: "1.1"`. The structural schema is frozen as
  `schemas/versions/oio-schema-1.0.0.json`. See
  [decision 0001](docs/decisions/0001-investigation-and-decision-extension.md).
- 08f7e18: Repair the structural schema, which did not parse and whose internal `$ref`s did
  not resolve, and correct its `$id` to name this repository.

### Patch Changes

These landed on `main` after 1.1.0 without a version bump, before releases were defined.

- 6ada559: Change the decision verdict values from `validated | disproved` to
  `supported | not-supported | inconclusive`, following FFTK ADR-016, and make a
  `state_at_commit` stamp on a decision that has not committed a validation error, following
  ADR-017. Remove the unused `system.profiles` field. Under the versioning rules now in
  place, the verdict and `profiles` changes would have been breaking.
- fc3cfa6: Clarify descriptions in the frozen 1.0 schema. Nothing that validates changed.

## 1.0.0 (2026-05-06)

### Major Changes

- e011d94: The structural schema: users, needs, capabilities, technical systems, teams and
  their relationships, including `decomposesInto` on needs and capabilities and the team
  `size` band. There was no `package.json` yet, so this version was never declared; it is
  recorded here as the contract `schemas/versions/oio-schema-1.0.0.json` preserves.
