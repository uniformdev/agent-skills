# Relationships

Reference fields connect entries to other entries — the mechanism for content reuse, classification, and shared domain objects, and the place where over-modeling hurts most.

Default to **embed**; promote data to a referenced entry only when reuse, an independent lifecycle/publish state, its own page or API queries, or different team ownership demands it. Every reference adds a resolution hop and a publish dependency.

## Configuring reference fields

- **Always restrict allowed content types.** An unrestricted reference field lets authors link anything, which breaks frontend assumptions and makes the model unauditable.
- **Single vs multi cannot be changed after setup, so default to multi.** Choose a single reference *only* when exactly one reference is allowed forever, with no exceptions. If there is any doubt, configure a multi-reference field with plural naming (in the public id and label) and set a `max: 1` validation. Relaxing that later — raising or removing the max count — is a validation change; switching single → multi is not possible, so it would force a re-model and migration. Example: a blog post usually has one author but occasionally a co-author, so model an `authors` multi-reference with `max: 1` rather than a single `author` reference — the day a co-author is needed you just raise or drop the max, instead of rebuilding the field.

## Shared reference types

Shared domain objects that many types reference — Author, Brand, Organization, Category, Location — deserve their own small content types: few fields (name, slug, image, short description, plus type-specific facts), stable slugs (the delivery-API filter key works only on id/slug/name), referenced from many types but rarely the other way around. Keep them **leaf-like**: a shared reference type referencing other shared reference types deepens every resolution chain that touches it (max depth 3).

## Resolution depth budgeting

See [delivery-aware-modeling.md](delivery-aware-modeling.md) for the depth model (default 1, max 3). Design common views to resolve at depth 1; list views at depth 0–1 with projections; flatten chains that regularly need depth 3.

## Graph hygiene

- Circular references are safe — the API stubs repeated references. But model hierarchy in **one direction only** (child → parent); bidirectional "parent" references that both sides maintain drift out of sync.
- **Don't mirror relationships.** Store "Article references Category", not also "Category lists its Articles" — derive the reverse via a filtered query.
- **Watch fan-out**: a multi-reference with dozens of entries resolved at depth 2+ multiplies payload size. Cap multi-references and keep referenced types lean.

## Publishing behavior

Published entries resolve only published references: a draft referenced entry is dropped from the published view, and a modified one resolves to its last published version. So required references should point at types whose entries are reliably published (shared reference types), and publish workflows should treat a parent and its new references as one unit.
