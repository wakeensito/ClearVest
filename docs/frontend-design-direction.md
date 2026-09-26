# ClearVest: account desk

The September 26 redesign replaces the editorial report with a light brokerage workspace.

## Compact design plan

- Palette: canvas `#F5F7FA`, paper `#FFFFFF`, ink `#172B46`, action blue `#2457C5`, rule `#DDE3EB`, secondary ink `#536176`. Gain and loss remain semantic.
- Type: SamsungOne for interface, headings, and tabular figures. Resolve installed SamsungOne through local font faces; use the existing self-hosted IBM Plex Sans where it is unavailable. A licensed SamsungOne webfont is needed for identical rendering across devices.
- Layout: left aligned account heading and actions; full-width account summary; a broad research/holdings column and narrower allocation/risk column. White work surfaces sit on a cool grey canvas. Controls have small radii, with no decorative gradients or card shadows.
- Signature: the security research chart is integrated into an account workspace, with an explicit security label and data dates. It never masquerades as portfolio performance.

```text
ClearVest       Portfolio  Markets  Advisor  Learn       Research / Profile
Your portfolio                                      Edit profile
Account value          Holdings        Largest holding        Bonds + cash
----------------------------------------------------------------------
Security research / price history                  | Portfolio mix
Symbol + latest close     1Y 5Y 10Y                 | Allocation + legend
Interactive TradingView chart                     | Risk summary
----------------------------------------------------------------------
Holdings                     Search                | Ask about holdings
Symbol / shares / price / value / weight           | Economy
```

## Alternatives and critique

A permanent left sidebar would consume space needed for readable holdings. The existing annual-report direction overuses serif headlines, repeated eyebrows, strong section rules and square controls. Keep the recognizable brokerage navigation, soften controls, remove repeated labels, and give charts and tables the room they need. The large account figure is justified here because the account balance is the primary task.

## Investing experience backlog

1. Now: inspect ownership, filter holdings, research security history, inspect exact chart values and ask contextual questions.
2. Next: benchmark comparison using normalized returns, distinguishing price returns from total returns; show overlapping observation dates.
3. With backend support: account grouping, actual portfolio return history, contributions versus investment gains, cost basis and fees.
4. Later: goal progress with editable assumptions and transparent calculations. No urgency prompts, speculative trade suggestions or manufactured performance.

## Review criteria

Light mode remains light even with a stored dark preference. No invented data. Chart failures stay local. Keyboard and touch controls work; numeric data has a table alternative. Mobile has no page-level horizontal overflow. Existing profile, linking, chat and data-error behavior remain usable.

## Inclusive experience refinement

Keep the same six-color light palette and SamsungOne throughout. Add one split welcome panel: left-aligned greeting and task links on white, coastal photography on the right. Learn uses a matching valley photograph. Keep data surfaces free of background photography so labels stay readable.

```text
Local-time greeting                 | Coastal landscape
Understand holdings | Research | Learn |
Your portfolio                         Hide/show values
Account summary, chart and holdings remain below
```

The initial idea of a full-bleed photo with overlaid text would compete with balances and reduce contrast. Use a separate image panel instead. Show morning, afternoon or evening according to the device’s local time, updating automatically every minute and on returning to the tab. No rotating welcome phrases, animation or pause control. No assumptions about name, wealth, gender, family structure or investing experience.

Ship practical inclusion: optional portfolio value privacy (real text replacement, not blur), a searchable plain-language glossary, three learning paths with cited sources, and access to Markets/Learn before creating a profile. Familiar Lucide icons support text labels; avoid unexplained icon-only entry points.

## Branded footer

Use existing navy ink #172B46, white #FFFFFF, muted rule #DDE3EB and the app’s existing blue,
canvas and secondary ink elsewhere. Set a full-width navy sign-off with ClearVest left and
“Clarity for every investor.” right, using SamsungOne. Keep required disclosures below a quiet
rule. The supplied reference calls for restraint: no invented social links, extra navigation columns
or trademark symbols. Stack left on mobile, with enough clearance for fixed navigation.

## Advisor context refinement

Use the existing six-color palette: canvas #F5F7FA, white #FFFFFF, navy #172B46,
cobalt #2457C5, border #DDE3EB and secondary text #536176. SamsungOne uses 18px
for the panel heading, 14px for facts, 12px for source metadata and 26px for the
portfolio value. Keep all content left aligned except paired profile values.

```text
[context icon] Your investing context       [disclosure]
               What informs your answers
Your profile                               Edit
Age                                         24
Investment horizon                   Long term
Risk tolerance                          Medium
Goals: [Retire early] [Buy a house]
-------------------------------------------------------
Portfolio                         3 holdings
$10,000.00
Risk score                  Moderate   58 / 100
[neutral scale with position marker]
-------------------------------------------------------
Economic context / FRED / As of date
```

A stack of separate metric cards would exaggerate the importance of every fact.
Use one contained white summary with two purposeful sections and a quieter source
footer. The neutral risk scale is a reference, not a progress target. The profile
edit remains a text action. A native disclosure starts collapsed on smaller screens
so context does not push the conversation away; desktop starts expanded. Avoid
invented connection badges or freshness claims beyond the supplied data dates.

## Illustrated welcome panel

Keep SamsungOne and the established palette: navy #172B46, cobalt #2457C5,
pale blue #EDF3FF, white #FFFFFF, slate #536176 and rule #C3CDD9. Replace
01/02/03 with three original vector spot illustrations: a route to a goal,
a linked brokerage account and holdings sheet, and a conversation with data.
Use 72px artwork beside left-aligned titles and explanations; reduce to 56px
on phones. Remove the repeated ClearVest eyebrow above the headline.

```text
Understand what you own, and why it matters to you.
[goal route]       Tell us your situation / explanation
[linked account]   Link a brokerage account / explanation
[conversation]     Ask in plain language / explanation
Educational information, not financial advice.
```

A large decorative hero would compete with the profile form. Use distinct small
illustrations as the list markers, keeping the explanatory text and avoiding
stock circles, sparkles, or a false progress sequence. SVG keeps these crisp
across devices without image downloads from external services. These are
supporting illustrations with empty alt text; the text conveys each point.

## Profile form refinement

Retain SamsungOne and the existing white, pale-blue, navy, cobalt, border and secondary
text tokens. Make questions the field labels; time ranges are the actual choice labels.
Use native 18px radio indicators alongside selected-card outlines so selection is visible
without color. Reduce form gaps from 32px to 24px and the top inset from 48px to 32px.

```text
Edit your profile / brief explanation
Age [24]
When might you need this money?
(o) Under 3 years    (o) 3–10 years    (*) 10+ years
How comfortable are you with changes in value?
(o) Low             (*) Medium       (o) High
Goals (optional)
[Save profile] [Cancel]
```

Retain distinct cards for mutually exclusive choices; these encode the selection rather
than decorate unrelated content. Reduce redundant horizon descriptions instead of shrinking
text. Cancel is editing-only and discards unsaved values; Save retains the existing API enums.
