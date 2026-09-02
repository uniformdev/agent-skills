# Component definitions

Component-level design decisions: metadata, mapping from code, display variants, and editing safeguards. See the [components guide](https://docs.uniform.app/docs/guides/models/components) for the full configuration reference.

## Component metadata

| Field | Best practice |
|-------|---------------|
| Name | Title-cased prose describing the visual/structural role ("Hero", "Card"). No technical shorthand, no "Component" suffix, no naming after placeholder content |
| Public ID | camelCase, derived from the name (`mainHeader` for "Main Header"). Cannot be changed after creation. Ideally matches the code component's name/registration key |
| Icon | Set one — authors identify components by icon when scanning the structure panel and component browser |
| Category | Assign every component to a category (e.g. "Layout", "Content", "Navigation"). Avoid leaving components in "Uncategorized" |
| Preview image | Provide a screenshot of the rendered component — it's shown when authors browse components to insert |
| Description | Brief explanation of what the component is for and when to use it |

### Descriptions double as AI guidance

The component description is read by both authors and Uniform's AI (Scout, AI quick edits) to decide when and how to use the component and what content to generate for it. Write it deliberately: state the component's purpose, where it belongs, and any usage constraints. Parameter-level guidance handles value-specific instructions; the description handles component-level intent.

## Mapping from code components

A Uniform component typically maps to a code component (React, Vue, Svelte, etc.):

- **Parameters map to props.** Match public IDs and types to props (see [parameters](parameters.md)).
- **Slots map to children** or child-component props (see [slots](slots.md)).
- **Not every prop needs a parameter.** Expose only props editors should control; hardcode internal flags, analytics IDs, and style-system internals.
- Keep the mapping thin: if it requires complex transformation logic to render the parameter value in a code component, revisit the parameter design instead.

