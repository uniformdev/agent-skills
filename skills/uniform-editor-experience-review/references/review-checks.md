# Review checks

The catalog the review runs. Every check has an ID, the **fix type** its findings are offered under
when the user chooses what to apply (see [review-and-selection.md](review-and-selection.md)), and
the reference with the fix.

The greps find **candidates**. Record a finding only after you have read the code and can say
what the author experiences: the same code shape is right in one component and a gap in the next.

Run them from the directory that holds the app. The helper searches components and stylesheets
and excludes build output:

```bash
g() { grep -rnE --include='*.ts' --include='*.tsx' --include='*.css' --include='*.scss' --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist "$@" . ; }
```

JSX props often span lines, which a line-based `grep` cannot see across. Where that matters the
recipe uses `perl -0777` to read each file whole.

## Fix types

Findings are grouped into four categories of up to four fix types each. The fix type is the unit
the user selects. **Foundations** are not offered: they are applied when a selected fix needs them.

| Category | Fix type | Checks | Default |
|---|---|---|---|
| Empty states | Keep empty components visible | E1 | Recommended |
| | Media placeholders | E2 | Recommended |
| | Text and rich-text placeholders | E3, E4, E5 | Recommended |
| Slots | Sized slot placeholders | S1, S2, S3 | Recommended |
| | Placeholder-aware slot logic | S4, S5 | Recommended |
| | Slot markup and spacing | S6, S7 | Recommended |
| Interactive | Keep hidden items mounted | I1 | Recommended |
| | Stop motion in the Edit tab | I2, I3 | Recommended |
| | Reach every item | I4, I5, I6, F2 | Recommended |
| | Live-site leaks | E6, I7 | Recommended — changes the live site |
| Playground | Pattern frame | P1 | Recommended when the project has patterns |

| Foundation | Applied when |
|---|---|
| Gate helpers (`isInCanvas`, `isEditTab`, or the project's own) | Any fix that gates on the editor |
| The App Router empty-placeholder resolver | "Sized slot placeholders" on the App Router |
| The App Router selection hook | "Reach every item" chooses follow-selection on the App Router |

## F — Scope and foundations

**F1 · Which SDK, and what already exists.**

```bash
grep -E '"@uniformdev/(next-app-router|canvas-react|canvas-next)"' package.json
g 'isContextualEditing|previewMode|useUniformContextualEditingState|resolveEmptyPlaceholder|emptyPlaceholder'
```

The first line decides which column of the SKILL.md signal table applies. The second shows what the
project already does — reuse its helpers and conventions instead of adding a second set.

**F2 · App Router project importing the Page Router hook.** It is silently inert there. Fix type:
*Reach every item*.

```bash
g "useUniformContextualEditingState|from ['\"]@uniformdev/canvas-react['\"]"
```

**F3 · Look-changing behaviour gated on "in Canvas" instead of "Edit tab".** A placeholder,
force-open or stopped autoplay behind `isContextualEditing` alone also shows in the Preview tab.
Record it under the fix type of the behaviour it gates.

```bash
g 'isContextualEditing'
```

## E — Empty states · [empty-states.md](empty-states.md)

**E1 · Components that return `null` with no editor gate anywhere in the file** ("drops in and
vanishes"):

```bash
for f in $(g -l 'return null'); do grep -qE 'isContextualEditing|previewMode|isEditTab' "$f" || echo "$f"; done
```

**E2 · Media with no editor placeholder.** Read what each asset-rendering component does when the
asset is empty:

```bash
g 'imageFrom|AssetParamValue|fields\.url|<img|<video|next/image'
```

**E3 · `UniformText` without a `placeholder`:**

```bash
perl -0777 -ne 'while(/<UniformText\b.*?\/>/gs){ my $l = substr($_,0,$-[0]) =~ tr/\n//; print "$ARGV:",$l+1,"\n" unless $& =~ /placeholder/ }' $(g -l '<UniformText')
```

**E4 · `UniformText` rendered only when it already has a value**: `x && <UniformText` or
`x ? <UniformText`. Fine when the condition includes the Edit tab; a gap when it tests the value
alone:

```bash
perl -0777 -ne 'while(/(&&|\?)\s*\(?\s*<UniformText\b/gs){ my $l = substr($_,0,$-[0]) =~ tr/\n//; print "$ARGV:",$l+1,"\n" }' $(g -l '<UniformText')
```

**E5 · App Router `UniformRichText`.** Its placeholder never shows, so each needs its own Edit-tab
hint for the empty case:

```bash
g '<UniformRichText'
```

**E6 · Visually hidden `UniformText`.** It reads raw values to screen readers on the live site.
Live-site bug.

```bash
perl -0777 -ne 'while(/<UniformText\b.*?\/>/gs){ my $l = substr($_,0,$-[0]) =~ tr/\n//; print "$ARGV:",$l+1,"\n" if $& =~ /sr-only|visually-hidden/ }' $(g -l '<UniformText')
```

**E7 · A "component not found" fallback that renders on the live site.** Read the resolver's
fallback component. Hiding it changes what visitors see, so report it under *Needs a manual check*
and leave it unchanged, also when told to apply everything.

```bash
g 'NotFound|NotImplemented|not found|not implemented'
```

## S — Slots · [slot-placeholders.md](slot-placeholders.md)

**S1 · App Router: `resolveEmptyPlaceholder` missing on a composition or playground page.** Without
it, empty slots render whatever the resolver returns for the placeholder item.

```bash
g '<UniformComposition|<UniformPlayground|resolveEmptyPlaceholder'
```

**S2 · Page Router: slots without an `emptyPlaceholder`:**

```bash
perl -0777 -ne 'while(/<UniformSlot\b.*?\/>/gs){ my $l = substr($_,0,$-[0]) =~ tr/\n//; print "$ARGV:",$l+1,"\n" unless $& =~ /emptyPlaceholder/ }' $(g -l '<UniformSlot')
```

**S3 · App Router: an `emptyPlaceholder` prop.** It does not exist there; every hit is a bug.

```bash
g 'emptyPlaceholder='
```

**S4 · Counting slot items, or hand-rolling the placeholder test:**

```bash
g '\.items\??\.length|startsWith\(.placeholder|includes\(.placeholder'
```

**S5 · A region hidden while its slot is empty** (an aside, an actions bar): no drop target in the
editor. Read the S4 hits and any `hasX &&` guard around a `UniformSlot`.

**S6 · Spacing that the editor's marker elements disturb.** Review the hits that style a slot's
container — utility classes in TSX and sibling selectors in CSS:

```bash
g 'space-[xy]-|divide-[xy]|first:|last:|:first-child|:last-child|nth-child|>[[:space:]]*\*[[:space:]]*\+[[:space:]]*\*'
```

**S7 · Page Router: a `wrapperComponent` defined inside a component body.** It remounts its subtree
on every editor update ([why](slot-placeholders.md#wrapping-slot-items)):

```bash
g '^[[:space:]]+(const|function)[[:space:]]+[[:alnum:]_]+[[:space:]]*=?[[:space:]]*\([[:space:]]*\{[[:space:]]*items\b'
```

## I — Interactive components · [interactive-components.md](interactive-components.md)

**I1 · Content unmounted when closed or inactive:**

```bash
g '(isOpen|isOpened|open|expanded|isActive|active)\s*&&|<Fragment key=\{key\} />'
g '\{[[:space:]]*(slides|panels|items)[[:space:]]*\[[[:space:]]*[[:alnum:]_]+[[:space:]]*\][[:space:]]*\}'
```

**I2 · Motion that needs stopping in the Edit tab:**

```bash
g 'autoplay|autoPlay|setInterval|requestAnimationFrame'
```

**I3 · Dismissed state that survives into Canvas:**

```bash
g 'localStorage|sessionStorage|document\.cookie|cookies\('
```

**I4 · Items behind interaction with no editor path in.** Components holding an open flag or an
active index and reading no editor signal at all: nothing forces them open, follows the
selection, or offers editor controls. Fix them with the
[pattern table](../SKILL.md#decision-rules).

```bash
for f in $(g -l 'useState(<[^>]*>)?\((0|false)\)'); do grep -qE 'previewMode|isEditTab|isContextualEditing|selectedComponentReference|forceOpen' "$f" || echo "$f"; done
```

**I5 · Editor-only controls that cannot be clicked.** Files that render buttons and read the Edit-tab
signal but never set `IS_RENDERED_BY_UNIFORM_ATTRIBUTE`. Read whether the buttons are editor-only.
Ordinary arrows next to an autoplay gate are not a finding; an editor-only picker without the
attribute is:

```bash
for f in $(g -l '<button'); do grep -qE 'previewMode|isEditTab' "$f" && ! grep -qE 'IS_RENDERED_BY_UNIFORM_ATTRIBUTE|data-is-rendered-by-uniform' "$f" && echo "$f"; done
```

**I6 · Things that block selection in the editor:**

```bash
g 'inert|pointer-events-none|pointer-events:[[:space:]]*none|pointerEvents'
```

**I7 · A hand-built editing marker.** Every hit that constructs one is a live-site bug:

```bash
g '_contextualEditing'
```

## P — Playground · [playground-tools.md](playground-tools.md)

**P1 · Patterns shown with no frame, or a frame that does not work.** Find the playground page and
read what wraps `UniformPlayground`: no wrapper or decorator is a finding; so are frame controls
without `IS_RENDERED_BY_UNIFORM_ATTRIBUTE`, and a Page Router decorator that reads `data.type`
into state without keying on it.

```bash
g '<UniformPlayground|decorators=|UniformPlaygroundDecorator|IS_RENDERED_BY_UNIFORM_ATTRIBUTE|data-is-rendered-by-uniform'
```

**P2 · Preview viewports that do not match the design system's breakpoints.** Compare the
project's viewports with the breakpoints in the design tokens or CSS framework config:

```bash
npx uniform canvas preview-viewport list --format yaml   # needs the project's API credentials
```

Report a mismatch, or a CLI that cannot reach the project, under *Needs a manual check*. The
viewports are a project setting the user changes; do not push them.

## The live site looks the same

If the app can render a published page, save its HTML before the fixes (workflow step 1) and
compare it afterwards:

```bash
curl -s http://localhost:3000/some-page > before.html   # before the fixes
curl -s http://localhost:3000/some-page > after.html    # after the fixes
diff before.html after.html
```

Expected differences: hidden items that are now mounted, empty wrappers that no longer render,
and removed leaks such as a `contentEditable` label or an `sr-only` raw value. Nothing else: no
placeholder text, no editor controls, no `data-uniform-placeholder`. If the app cannot render a
published page, for example without credentials, say so in the closing report.

## Check in Canvas

Open a composition that uses each changed component, and a pattern in the playground.

**Edit tab:**

- [ ] Drop each component into a slot. It is visible and selectable before anything is filled in
- [ ] Empty text shows its placeholder; empty media shows a placeholder the size of the media
- [ ] Empty slots show drop targets you can hit, including horizontal rows and table bodies
- [ ] Every accordion panel, tab, slide and tooltip can be reached and edited
- [ ] Selecting a slide, tab or panel — or something inside one — in the component tree shows it
- [ ] Editor-only controls respond to clicks
- [ ] Nothing moves on its own

**Preview tab:**

- [ ] No placeholders or editor controls you added, panels in their normal state, autoplay running

**Playground:**

- [ ] The frame shows the pattern's type and opens at the width set for it
- [ ] Its width buttons respond, and the pattern inside stays selectable

If you cannot open Canvas yourself, say so, and give whoever can this checklist with the
components it applies to.
