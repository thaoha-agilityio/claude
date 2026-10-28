---
name: ui-development
description: Builds or changes UI in the expense tracker (a page, a component, a form or a restyle), from a screenshot or mockup when one is given and from the current light-blue theme otherwise. It maps the design to existing components, uses the colour tokens in src/index.css and a CSS module next to the component, writes semantic markup with the empty, saving and error states, adds Testing Library tests by role, checks the page in a browser at desktop and 360px, runs the CLAUDE.md checks and, once the user has seen and approved the diff, commits on a feat/ branch. Use when someone asks to add or change a screen, a component, the layout or the styling of this app, or run as /ui-development <what to build or change>. Not web-dev:ui-development, which targets shadcn/Tailwind boilerplate projects.
argument-hint: <what to build or change>
---

# ui-development

Build or change: $ARGUMENTS

If `$ARGUMENTS` is empty, ask what to build. Work through the sections in order. Run npm commands from
`expense-tracker/` and git commands from the repo root. Paths below are under `expense-tracker/`.

## 0. Inputs

- Read `CLAUDE.md` (domain rules, checks, git) and `SPEC.md`. Budgeting, Excel export and sharing are out of scope;
  say so instead of building them.
- A screenshot or mockup is a visual target: read each image with the Read tool and note its width. Build real markup,
  never embed the image. With no design, keep the current theme and record "no design given: current theme".
- List what the design leaves out (empty, saving and error states, the 360px layout, focus and disabled styles, long
  text) under **Design gaps**. Ask only when a gap changes structure, such as what a wide table becomes on a phone.

## 1. Map the parts

Split the screen into regions and write down what each one reuses before adding anything:

- Shell: `src/components/Layout.tsx` (header with the app's `h1`, `nav` "Main", `main`). Routes: `src/App.tsx`.
- Shared form styles: `src/components/forms.module.css` (`.row`, `.field`, `.fieldset`, `.error`, `.scroll`).
- Components: `AmountInput` (VND entry), `MonthPicker`, `ConfirmDialog` (destructive actions), `errors.ts`
  (`errorMessage()`), `ids.ts` (ids used to return focus).
- A new page is a component in `src/pages/`, a `<Route>` in `App.tsx` and an entry in `links` in `Layout.tsx`.

## 2. Tokens

- Colours come only from the `--color-*` tokens on `:root` in `src/index.css`. No raw hex or `rgb()` in modules.
- A colour role the theme lacks gets a new token with a contrast comment like the existing ones: text 4.5:1 on
  `--color-surface` and `--color-bg`, outlines and focus 3:1. Restyling screens the request doesn't cover needs the
  user's OK first.
- Spacing and type in `rem`, radius and shadow from `--radius` and `--shadow`, as the existing modules do.
- Dark mode is out of scope unless asked. A new runtime dependency (UI kit, chart or icon library) needs the user's OK.

## 3. Build

- Styles go in a CSS module next to the component (`Foo.tsx` + `Foo.module.css`). Flex and grid with `gap`.
- Semantic HTML inside the layout: one `h2` per page, ordered headings below it, `ul`/`li` and `table` with accessible
  names (`aria-label` or a caption), `button` for actions and `NavLink` for navigation.
- Mobile first: nothing may widen the page at 360px. Wide tables go inside `.scroll`; long notes wrap.
- Money and dates follow CLAUDE.md: `AmountInput`/`parseVnd` in, `formatVnd` out; `YYYY-MM-DD` strings shown with
  `formatDate`, "today" from `todayInHcm()`. Calculations belong in `src/domain/` with their own tests, not in components.
- States. `StoreProvider` already renders loading (`role="status"`) and load failure (`role="alert"` with "Try again").
  The component owns the rest:
  - empty: a short message that points at the next action (see `ExpenseList`'s `emptyMessage`);
  - saving: await the store action and disable the form's `fieldset` meanwhile (see `CategoryForm`);
  - errors: `errorMessage(err, field)` in a `role="alert"` paragraph, tied to the field with `aria-describedby`.
- Keep the visible focus ring (`--color-focus`), hover and disabled styles. After a dialog or an inline edit closes,
  return focus to the control that opened it.

## 4. Tests

- Next to the code (`Foo.test.tsx`). Render inside `<StoreProvider {...localStore()}>` from `src/test/store.ts`; no
  server, no mocked globals.
- Query by role and accessible name (`getByRole`, `getByLabelText`). Cover what the design shows (headings, lists,
  buttons, labels) and the empty, saving and error states. Assert behaviour, never class names or colours.
- A bug fix comes with a test that fails without the fix.
- Add a Playwright spec only for a new route or a flow across pages, using the helpers in `e2e/fixtures.ts`. A new
  route also goes into the path list in `e2e/responsive.spec.ts`.

## 5. Visual check

- Start `npm run server` and `npm run dev` in the background (the dev server proxies `/api` to port 3001).
- In the built-in browser, look at the page at desktop width and at 360px. With a design, compare region by region and
  fix the differences, at most 3 rounds. Try the states you can reach: empty list, a long note, a failed save.
- Stop both servers afterwards. Without a browser tool, record "visual check not done" under **Not done**.

## 6. Checks

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` and `npm run test:e2e`. Fix the cause until all
pass; never weaken a test, type or lint rule to get there (CLAUDE.md). If e2e says Chromium is missing, run
`npx playwright install chromium` once and rerun.

## 7. Commit

Branch off `feat/practice` as `feat/<slug>`, or `fix/<issue>-<slug>` for a bug, as CLAUDE.md's Git section says. Once
the checks pass, show the user the change (the changed files and `git diff`) with the commit message you plan to use,
and stop until they approve it. Passing checks are not approval. Then commit through the `git-committer` agent, one
logical change per commit. Don't push: hand the push and the PR/MR (filled from
`.gitlab/merge_request_templates/default.md`) to the user.

## Result

```
## Result
**Did:** files changed, tokens added, tests added, and each check's outcome
**Saw:** design frames read, components reused, visual-check findings, code/doc mismatches
**Not done:** anything skipped, including "visual check not done", and remaining visual differences
**Design gaps:** what the design didn't specify and what was assumed (states, 360px layout, values rounded)
**Next:** what the user should answer or do (push, PR/MR, open questions)
```
