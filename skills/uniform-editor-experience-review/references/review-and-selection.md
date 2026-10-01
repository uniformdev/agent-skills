# Reporting findings and choosing what to fix

The report and the question that follows it use the same grouping, **category → fix type →
findings**, defined in [review-checks.md](review-checks.md#fix-types).

## The report

In chat by default. Write it to a file when the user asks for one, or offer to when it runs long.

```markdown
# Editor experience review

App Router (`@uniformdev/next-app-router` 20.80) · 11 components reviewed · 14 findings, 1 of them a live-site bug

## Empty states

### Keep empty components visible — recommended
- **Button** · `components/Button.tsx:21` · E1 — a button with no label renders nothing in every
  mode, so a freshly dropped button vanishes and cannot be selected.
  Fix: render it in the Edit tab with its label placeholder; the live site keeps rendering nothing.

### Text and rich-text placeholders — recommended
- **RichText** · `components/RichText.tsx:14` · E5 — an empty body shows nothing in Canvas; this
  SDK never renders `UniformRichText`'s placeholder. Fix: an Edit-tab hint when the value is empty.

## Interactive

### Live-site leaks — recommended · changes the live site
- **Tabs** · `components/TabsClient.tsx:31` · I7 — the tab labels are built with a hand-made
  editing marker, so they are `contentEditable` for every visitor. Fix: drop the marker and keep
  the labels as plain text edited from the component tree, or render them through the slot.

## No findings
Hero, Page — reviewed; nothing to change.

## Needs a manual check
- **DefaultNotFound** · `components/DefaultNotFound.tsx:4` · E7 — unmapped component types print
  "Not Found" on the live site. Your call: show it in the Edit tab only, or leave it.
- **Preview viewports** · P2 — the CLI could not reach the project; compare its viewports with the
  design system's breakpoints (Mobile 360, Tablet 768, Desktop 1280 today).
```

Rules for the report:

- **One bullet per component per check.** Component, `file:line`, check ID.
- **Symptom first, in the author's terms**: what they see or cannot do in Canvas. Then the fix in
  one sentence. The code-level cause belongs in the fix, not the headline.
- **Mark live-site bugs** in the fix-type heading.
- **List the components with no findings.**
- **Omit empty categories and fix types.** No "Slots: nothing found" sections.
- Findings the agent should not decide or cannot confirm from code alone (E7, a hide-when-empty
  guard that also hides visible content, preview viewport settings, anything that needs a running
  Canvas) go under *Needs a manual check*, not into a fix type.

## Asking which fixes to apply

### With a multi-select question tool

Where the agent has a structured question tool with multi-select (Claude Code's `AskUserQuestion`),
ask in one call:

- **One question per category** that has findings, in the order Empty states, Slots, Interactive,
  Playground — at most four, which is the tool's per-call limit.
- **One option per fix type** with findings, at most four per question. If a category ever has
  more, merge the two smallest.
- **Label**: the fix type, with "(Recommended)" appended when its default is recommended. **Description**:
  the components it touches and what changes for the author.
- **Name what a fix depends on** in its description, so the user decides with it in view: on the
  App Router, following the selection relies on an internal Canvas message; on the Page Router,
  the pattern frame relies on the experimental `decorators` prop.
- **Header**: the category name, 12 characters or fewer.
- A question needs at least two options. When a category has a single fix type, add `Not now`.

```json
{
  "questions": [
    {
      "question": "Which empty-state fixes should I apply?",
      "header": "Empty states",
      "multiSelect": true,
      "options": [
        { "label": "Keep empty components visible (Recommended)", "description": "Button, Hero CTA — shown with placeholders in the Edit tab; unchanged on the live site" },
        { "label": "Media placeholders (Recommended)", "description": "Image, Video — a placeholder the size of the media when no asset is set" },
        { "label": "Text and rich-text placeholders (Recommended)", "description": "RichText, Card — hints for empty text the editor otherwise hides" }
      ]
    },
    {
      "question": "Which interactive-component fixes should I apply?",
      "header": "Interactive",
      "multiSelect": true,
      "options": [
        { "label": "Keep hidden items mounted (Recommended)", "description": "Carousel, Tabs, Accordion — inactive items stay in the page so they can be selected" },
        { "label": "Stop motion in the Edit tab (Recommended)", "description": "Carousel — no autoplay in the Edit tab; Preview keeps it" },
        { "label": "Reach every item (Recommended)", "description": "Carousel, Tabs follow the Canvas selection through an internal Canvas message that can change without an SDK release; Accordion opens in the Edit tab" },
        { "label": "Live-site leaks (Recommended)", "description": "Tabs — labels are contentEditable on the live site today" }
      ]
    }
  ]
}
```

An answer may include free text under "Other". Read it as instructions ("only the carousel",
"skip Tabs for now") and adjust the selection before applying.

### Without one

Agents with no structured question tool, or a user who prefers typing, get a numbered list after the
report. `[x]` marks the recommended defaults:

```markdown
Reply with the numbers to apply, `recommended`, or `all`:

1. [x] Keep empty components visible — Button, Hero CTA
2. [x] Media placeholders — Image, Video
3. [x] Text and rich-text placeholders — RichText, Card
4. [x] Keep hidden items mounted — Carousel, Tabs, Accordion
5. [x] Stop motion in the Edit tab — Carousel
6. [x] Reach every item — Carousel, Tabs, Accordion (follow-selection uses an internal Canvas message)
7. [x] Live-site leaks — Tabs (changes the live site)
```

### When not to ask

| The user said | Do |
|---|---|
| Fix it / apply everything / don't stop to ask | Skip the question. Apply every fix type whose default is recommended, then report what you applied and what you left out |
| Review only / don't change code / I want to decide | Write the report, end it with the numbered list, and stop. Change no code |
| Fix one named thing ("make the carousel editable") | Scope the review to that component, and apply without asking unless the fix reaches beyond it |

## Applying the selection

1. **Foundations the selection needs, first**: the gate helpers, the App Router empty-placeholder
   resolver, the App Router selection hook, per the table in
   [review-checks.md](review-checks.md#fix-types). Reuse the project's own if it has them.
2. **Each selected fix type**, across all the components it lists, with the fix in the linked
   reference.
3. **Nothing else.** Unselected findings stay in the report as open items; do not fix them in
   passing, even when you are in the same file.

## The closing report

- **Applied**: fix type, components, files.
- **Left open**: the fix types not selected, still listed so they are not lost, and the manual
  checks.
- **Verify**: the result of the [live-site comparison](review-checks.md#the-live-site-looks-the-same),
  or why it could not run, and the Canvas checklist items that still need a human in Canvas
  ([review-checks.md](review-checks.md#check-in-canvas)).
