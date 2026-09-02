# Content-agnostic vs content-specific components

A core experience-modeling decision: should a component know what kind of content it displays?

## Content-agnostic by default

In general, components should not be tied to a specific kind of content. The component is the display container; the content comes from elsewhere.

- Name components after their visual/structural role, not the data they happen to show today: "Card" over "Recipe Card", "Hero" over "Campaign Hero", "List" over "Article List".
- Content-agnostic components keep the component catalog small, reduce code duplication, and let the same design-system component serve many content types.

## Content-specific variations via component patterns

Create content-specific variations of a base component with **component patterns** instead of new component definitions:

1. Create a pattern based on the agnostic component (e.g. a "Recipe Card" pattern based on "Card").
2. Add a **data resource** to the pattern that fetches an entry of the content type (e.g. a "Recipe" entry, selectable on the pattern instance).
3. Connect entry fields to the component's parameters with **dynamic tokens** (e.g. Card title ← `${#jptr:/recipe/fields/title}`).

Authors then insert the "Recipe Card" pattern, pick a recipe, and the title and image are wired up automatically — no new component definition, no new code. This works for any data source, not just Uniform entries: external CMSes, commerce APIs, or other REST sources can power the same agnostic component through patterns.

Not every pattern needs a data resource — see [patterns](patterns.md) for the static vs connected-to-data decision, overrides, and slot sections.

## When content-specific components are justified

Sometimes a dedicated component definition is the right call:

- **Core domain objects used heavily.** If "Product" is the center of the business and product displays appear everywhere, a dedicated "Product Card" component can be clearer for editors and developers than a generic Card plus many patterns.
- **Use-case-specific functionality or state.** A "Product Card" with an "Add to cart" button, live pricing, or inventory state has behavior that a generic Card's code component shouldn't carry.

Before creating a content-specific component, always check whether a component pattern on an agnostic base covers the requirement. Only when the component needs its own code behavior — not just its own data connection — is a dedicated definition warranted.

## Decision summary

| Situation | Approach |
|-----------|----------|
| Display a content type in a standard layout | Agnostic component + component pattern with data resource |
| Same content shown in multiple layouts (hero, card, list) | One pattern per layout, all connecting to the same content type |
| Component needs content-specific behavior or state (add to cart, live data) | Content-specific component definition |
| Core domain object, very high usage, editor clarity matters | Content-specific component definition (after ruling out patterns) |
