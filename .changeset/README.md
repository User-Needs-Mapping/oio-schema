# Changesets

Each pull request that changes what the package ships adds a changeset here: run
`npx changeset`, pick the bump, and write one or two sentences for the changelog.

Pick the bump by what the change does to documents, not by how big the diff is:

- **major**: a document that was valid can become invalid. Removing a property or a value,
  making a field required, narrowing a pattern.
- **minor**: a new optional field, value or section. This is a new `oio_version`, so the
  same pull request adds it to the schema's `oio_version` enum, gates the new content on it,
  freezes the previous schema in `schemas/versions/`, and points `LATEST_SCHEMA_VERSION` at
  it. `test/release.test.mjs` fails until the schema version matches the bump.
- **patch**: nothing changes what validates. Description wording, README, examples,
  validator and tooling fixes.

A change nobody using the package would notice, such as a CI tweak, needs no changeset.

Merging to `main` keeps a "Version packages" pull request open. Merging that one bumps
`package.json`, writes `CHANGELOG.md` and dates the new heading. Tagging is done by hand
for now: see "Releases and changelog" in the README.
