## Component set

| Public ID           | Name                 | Purpose                                                     |
|---------------------|----------------------|-------------------------------------------------------------|
| `form`              | Form                 | Container. Renders `<form>`, submits                        |
| `formTextField`     | Form Text Field      | Single-line input (text, email, tel, url, number, password) |
| `formTextAreaField` | Form Text Area Field | Multi-line input                                            |
| `formSelectField`   | Form Select Field    | `<select>`, options in a slot                               |
| `formSelectOption`  | Form Select Option   | One option, used by select                                  |
| `formRadioField`    | Form Radio Field     | Radio group, options in a slot                              |
| `formRadioOption`   | Form Radio Option    | One option, used by radio                                   |
| `formCheckboxField` | Form Checkbox Field  | Single boolean checkbox                                     |
| `formButton`        | Form Button          | Submit / reset / plain button                               |

Start with `form`, `formTextField`, `formTextAreaField`, and
`formButton`. Add select, radio, and checkbox only when an author
actually needs them. Every extra component is another thing to
maintain and another choice in the add-component dialog.

## The `name` parameter is the contract

Every field component has a **required** `name` text parameter. It is
slugified into the field's identifier, which becomes:

- the HTML `name` and `id` attributes,
- the key in form state,
- the key in the submission payload.

## Use an optional `label` parameter for `<label>` content

Include an optional `label` parameter to allow the editor to display a
more user-friendly label to the reader for a field.

## Uniform's visual editor title parameter

Set `titleParameter: name` on every field so Uniform's visual editor
shows the field name in the component tree rather than "Form Text
Field" repeated five times.

Give the component definition a `guidance` property so authors and AI
pick sensible values.

Duplicate names within one form collide and overwrite each other in
state. The container should warn in development when it detects a
duplicate registration.

## `form`

```json
{
  "id": "form",
  "name": "Form",
  "icon": "format-separator",
  "titleParameter": "formName",
  "canBeComposition": false,
  "parameters": [
    {
      "id": "formName",
      "name": "Form Name",
      "type": "text",
      "guidance": "Heading shown above the form."
    },
    {
      "id": "formIdentifier",
      "name": "Form Identifier",
      "type": "text",
      "typeConfig": {
        "required": true
      },
      "guidance": "Stable slug identifying this form to the backend, e.g. contact-us. Do not change once submissions exist."
    },
    {
      "id": "successMessage",
      "name": "Success Message",
      "type": "text",
      "guidance": "Shown in place of the form after a successful submission."
    }
  ],
  "slots": [
    {
      "id": "formFields",
      "name": "Form Fields",
      "minComponents": 1,
      "allowAllComponents": false,
      "patternsInAllowedComponents": false,
      "allowedComponents": [
        "formTextField",
        "formTextAreaField",
        "formSelectField",
        "formRadioField",
        "formCheckboxField",
        "$personalization",
        "$test"
      ]
    },
    {
      "id": "formButtons",
      "name": "Form Buttons",
      "minComponents": 1,
      "maxComponents": 2,
      "allowAllComponents": false,
      "patternsInAllowedComponents": false,
      "allowedComponents": [
        "formButton"
      ]
    }
  ]
}
```

Notes:

- **Two slots, not one.** Fields and buttons render in fixed, distinct
  positions and allow different components, which is exactly the
  reason for separate slots.
- **`$personalization` and `$test` in `formFields`** let a single
  field be personalized or A/B tested.
- **`formIdentifier` is required** and should not change after launch;
  it is how the backend routes submissions.
- **No endpoint parameter.** The submit URL is a code convention, not
  author content.

## Field components

All fields share this base:

| Parameter  | Type       | Notes                                                                     |
|------------|------------|---------------------------------------------------------------------------|
| `name`     | `text`     | Required. The identifier contract above                                   |
| `label`    | `text`     | Visible label. Required in practice — an unlabelled input is inaccessible |
| `required` | `checkbox` | Drives the HTML `required` attribute; re-checked server-side              |
| `helpText` | `text`     | Optional hint rendered under the input                                    |

### `formTextField`

Adds:

| Parameter     | Type     | Notes                                                               |
|---------------|----------|---------------------------------------------------------------------|
| `placeholder` | `text`   |                                                                     |
| `inputType`   | `select` | `text`, `email`, `tel`, `url`, `number`, `password`. Default `text` |

Do not offer `password` unless the form genuinely collects one — a
password in a marketing form submission is a liability.

### `formTextAreaField`

Adds `placeholder` (text) and `rows` (number, default 4).

### `formSelectField`

Adds:

| Parameter           | Type   | Notes                                                |
|---------------------|--------|------------------------------------------------------|
| `placeholderOption` | `text` | A "Choose one..." label rendered as the first option |

Plus an `options` slot which allows the `formSelectOption`,
`$personalization` and `$test` components.

**Do not model options as a `$block` parameter.** Block parameters
cannot be created or edited via MCP/AI, cannot be overridden per
pattern instance, cannot be personalized, and require custom rendering
code.

### `formRadioField`

Base parameters only, plus an `options` slot which allows the
`formRadioOption`, `$personalization` and `$test` components. There
should be a minimum of one component to be valid.

**Do not model options as a `$block` parameter.** Block parameters
cannot be created or edited via MCP/AI, cannot be overridden per
pattern instance, cannot be personalized, and require custom rendering
code.

### `formCheckboxField`

Base parameters only. `required` on a checkbox means "must be ticked",
which is the correct semantic for consent checkboxes.

## Button `formButton`

| Parameter    | Type     | Notes                                              |
|--------------|----------|----------------------------------------------------|
| `label`      | `text`   | required, shows the text in the button             |
| `buttonType` | `select` | options: `submit` or `reset`. Defaults to `submit` |

Set the `titleParameter` of this component to `label` so that the
component tree shows a useful label.

## Patterns

Once the set exists, create **component patterns** for the forms the
site actually uses. A "Contact Form" pattern with its fields, labels,
and identifier preconfigured. Authors then drop in a working form
rather than assembling one from parts, and the pattern's overrides
control what they may change.

## Checklist

- [ ] Every field has a required `name` parameter with
  `titleParameter: name`
- [ ] No slot has `allowAllComponents: true`
- [ ] `formFields` allows `$personalization` and `$test`
- [ ] `formButtons` has `minComponents: 1`
- [ ] Options are a slot, not a `$block` parameter
- [ ] `form.formIdentifier` is required
