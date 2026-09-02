---
name: uniform-forms
description: >-
  Use when adding a form (like contact, signup, newsletter, lead-capture or survey) to a
  Uniform project, when creating form field component definitions or building a generic form submission endpoint.
  Do not use when embedding an iframe for an external form provider.
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# Uniform forms

A form in Uniform is not a special entity — it is a **composition of components**. A `Form` container component renders the `<form>` element and owns the resulting submit action; each input is its own component placed in the container's slot. Authors assemble forms in Uniform's visual editor; developers own the markup, state, and submission.

## Architecture

```
form                       container: renders <form>, owns state, submits
├── slot: formFields       formTextField, formTextAreaField, formSelectField,
│                          formCheckboxField, formRadioField (+ $personalization, $test)
└── slot: formButtons      formButton (min 1) (+ $personalization, $test)

formSelectField / formRadioField
└── slot: options          formSelectOption, formRadioOption (+ $personalization, $test)
```

Field components **self-register** with that context on mount and read/write their own value through it. The container never inspects its slot contents.

## Author-set Field name and identifier

**Every field must have a stable, author-set identifier.** The `name` parameter is required on every field component. Slugify it to get the identifier used for the HTML `name`/`id`, and the payload key. **Never fall back to a generated identifier, warn in the Uniform's visual editor when a field is missing an identifier**.

## Form Submit or Fields should self-register

**Do not introspect slots.** Do not walk `component.slots.formFields` to build fields. That code can easily miss fields nested inside `$personalization` or `$test` wrappers, and duplicates the slot's structure in two places. Use the form submit event to gather the data or self-register each field based on the component's nested context.

## Options are a slot, not a `$block` parameter

Dropdown and radio options are components in an `options` slot. This is good practice for these components as it allows them to be personalized, be A/B tested, or support visibility conditions. Do not use blocks or a `$block` parameter as **it cannot be created or edited via MCP or AI**, so a block-based model cannot be built or maintained by an agent.

## Restrict every slot explicitly

**Never set `allowAllComponents: true`.** List the field components, and add `$personalization` and `$test` to `formFields` so individual fields can be optimized.

## Always validate on the server

Client-side validation, `required`, `minlength`, `maxlength`, `pattern` and other built-in form input parameters drive the HTML validation UX only. Re-check every required field in the API route.

## Keep track of the form submit state

Track `idle | submitting | success | error`. Disable the submit button while submitting and render the result in the page with `aria-live`. Never use `alert()` or `confirm()`.

## Build order

1. **Model the components** in Uniform — `form` first, then fields, then `formButton`, then `formSelectOption`. See [modeling.md](references/modeling.md).
2. **Build a single API route** to receive submissions according to the payload contract. See [submission.md](references/submission.md).
3. **Build the form submission logic** to send submissions according to the payload contract.
5. **Build all components** in the current tech stack and ensure the `<form>` submit event triggers the form submission logic.
6. **Assemble a form in Uniform's visual editor** and submit it to confirm the payload keys match the authored field names.

## Payload contract

The container POSTs this to `/api/forms/submit` which expects the payload contract defined in [submission.md](references/submission.md).
The generic nature of the payload means that it is important to have some mitigation for potential spam or malicious requests.

## References

- [Modeling](references/modeling.md) — component definitions for the form with parameter tables and slot restrictions
- [Submission](references/submission.md) — the API route, payload contract and server-side validation
