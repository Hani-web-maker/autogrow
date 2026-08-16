# GrowMark — SEO Agency Project Management, by Growistan

A complete, static project-management web app purpose-built for SEO agencies —
Asana/Monday.com-style workflows plus the SEO-specific tooling agencies
actually need (keyword tracking, content calendar, backlink tracker,
technical audit checklists, site issue logs, and branded automated client
reporting).

GrowMark is a Growistan product. The brand palette (`assets/logo.svg`,
`assets/favicon.svg`, and the CSS custom properties at the top of
`css/styles.css`) is Growistan gold (`#FABD12`) and navy (`#052E4A`).

**Pure HTML5 + CSS3 + vanilla JavaScript (ES6+). No frameworks, no build
step, no backend.** All data is persisted client-side in `localStorage`
through a small data-access layer (`js/db.js`), so the whole thing runs
entirely in the browser and deploys as-is to GitHub Pages or any static
host.

## Folder structure

```
.
├── index.html                 # single HTML shell; all views render into #app-root
├── assets/
│   ├── logo.svg                # full GrowMark / "by Growistan" lockup
│   └── favicon.svg              # cropped "G" mark, used as the browser tab icon
├── css/
│   ├── styles.css              # design tokens (brand palette) + full design system
│   └── print.css                # branded print/PDF stylesheet — logo header/footer,
│                                   page numbers, brand-colored dividers — used only
│                                   for the Reports view
├── js/
│   ├── utils.js                 # date/formatting/DOM helpers, badges, avatars
│   ├── db.js                    # localStorage data-access layer, migration, backup/restore
│   ├── brand.js                  # single source of truth for brand name/logo markup
│   ├── auth.js                   # optional local login gate (username + PIN)
│   ├── csv.js                    # CSV parse/export used by Settings import/export
│   ├── toast.js                   # toast notifications
│   ├── modal.js                   # modal + confirm-dialog manager
│   ├── router.js                  # tiny hash-based router (#/clients, #/projects/:id, ...)
│   ├── app.js                     # app shell: sidebar, topbar, search, notifications, boot sequence
│   ├── components/
│   │   ├── taskModal.js           # shared task detail/edit modal (used everywhere)
│   │   ├── charts.js              # dependency-free canvas charts (rank line, bar)
│   │   └── dnd.js                  # drag-and-drop wiring for the Kanban board
│   └── views/
│       ├── onboarding.js           # first-run setup wizard (no fake data)
│       ├── dashboard.js             # agency-wide overview
│       ├── clients.js                # client list + detail + Site Access tab
│       ├── projects.js               # cross-client project list + New SEO Project wizard
│       ├── projectDetail.js           # single project: tasks, keywords, content,
│       │                                backlinks, audit checklist, issue log, SEO snapshot,
│       │                                files/notes
│       ├── myTasks.js                 # per-user tasks + Today/Overdue/Upcoming filters
│       ├── keywords.js                # Keyword Tracker (standalone + reusable section)
│       ├── contentCalendar.js         # Content Calendar (standalone + reusable section)
│       ├── backlinks.js               # Backlink Tracker (standalone + reusable section)
│       ├── reports.js                 # Report Builder, scheduling, branded cover page, print/export
│       ├── team.js                    # team members + workload view
│       └── settings.js                # agency profile, security, sample data, backup/restore, CSV import/export
└── README.md
```

Every `views/*.js` file self-registers its route(s) with `Router` on load,
and the Keyword Tracker / Content Calendar / Backlinks modules each export a
reusable `renderSection()` function so the same UI can be embedded both as
its own sidebar page (all clients) and as a scoped tab inside a project
(`projectDetail.js`).

## Data layer & swapping to a real backend later

Every read/write goes through `js/db.js` (`DB.all()`, `DB.get()`,
`DB.insert()`, `DB.update()`, `DB.remove()`). Nothing else in the codebase
touches `localStorage` directly. `db.js` also maintains an in-memory
`id → record` index per collection so lookups stay O(1) as an agency's data
grows into the hundreds of tasks/keywords, rather than repeatedly scanning
arrays with `.find()`.

To move to a real API later, you'd only need to rewrite the internals of
`db.js` to call `fetch()` instead of `localStorage` — every view already
treats it as an async-agnostic data source.

## First run: onboarding, not fake data

GrowMark **does not** seed itself with placeholder clients on first load.
The very first time you open it with an empty workspace, you get a short
onboarding wizard: your agency name, your own name (you become the first
team member), your first real client, and your first real project. Nothing
in that flow is fictional.

If you want to explore the app or demo it to a prospect, use **Settings →
Sample data & reset → Load Sample Data**. It fills the workspace with
fictional clients/projects/keywords/reports, always behind a confirm
dialog, and never runs automatically. **Clear All Data** is the matching
counterpart (also confirm-gated) for wiping everything back to empty
without touching your agency name or login.

## Security note — the login gate (§3, Option A vs Option B)

The task brief asked for a basic client-side login gate, which is
implemented in `js/auth.js`: a username + PIN, hashed with **PBKDF2-SHA256
(100,000 iterations)** and a random per-install salt via the Web Crypto
API, stored in `DB.settings().auth`. The raw PIN is never persisted. It has
a configurable idle session timeout and a "remember this device" option.
**This is a local device lock, not account security** — there is no
server, so anyone with direct access to this browser's storage can bypass
it. The UI says this explicitly; it exists only to stop a shared machine or
screen-share from exposing client data at a glance.

For **Site Access** (per-client CMS/GSC/GA4/hosting inventory, on the
client detail page), the brief offered two options for handling
credentials:

- **Option A**: encrypt actual passwords client-side with `crypto.subtle`
  (AES-GCM) behind a per-session master passphrase.
- **Option B**: store only *references* to where credentials live (a
  password manager), never the secrets themselves.

**This build implements Option B.** The Site Access tab captures site URL,
CMS/host, GSC/GA4 property, hosting/domain registrar, a "credentials
location" text field (e.g. *"in 1Password — Client Vault"*), and an
optional link-out field — never a password. Rationale: it needs zero
crypto code to maintain, has no risk of a browser-storage leak exposing
real client passwords, and most agencies already trust a real password
manager for the actual secrets — they need the *inventory* (what exists,
where to find it) far more than in-app password storage. A future
developer who wants Option A should treat it as a genuinely separate
threat model (client-side AES-GCM, unrecoverable-on-lost-passphrase UX,
etc.), not a small addition to this one.

## Recurring tasks & recurring reports

- **Recurring tasks**: a task can be marked daily/weekly/monthly. On every
  app load, `DB.processRecurringTasks()` checks whether a new occurrence is
  due for the current period and materializes a real task instance (linked
  back to its recurring template via `recurrenceParentId`), so "every
  Friday" tasks actually reappear on your board.
- **Recurring reports**: set a client's report schedule (weekly / monthly)
  on the client detail page, or let the **New SEO Project** wizard wire it
  up for you. On every app load, `DB.processScheduledReports()` checks
  whether the current period already has a report draft for that client
  and, if not, generates one from live data (tasks completed, keyword
  movement, new backlinks, content published, issues opened/resolved) and
  surfaces a reminder banner at the top of the app.

This client-side "check on load" approach is what makes recurrence work
without a server. For true unattended delivery (e.g. actually emailing a
report every Friday morning whether or not anyone opens the app), you'd
need a small backend/cron job — the UI and data model here are already
shaped for that (`reportSchedule` on each client, a `reports` collection
with `status: draft | final`), so swapping in a real scheduler later is a
matter of wiring a server-side job to the same `buildReportDraft()` logic.

## Import, export & backup

Everything lives only in this browser's `localStorage`, so **Settings →
Backup & restore** matters more here than in a server-backed product:

- **Export Full Backup** downloads the entire workspace as one JSON file.
- **Restore from Backup** replaces the current workspace with a previously
  exported file (confirm-gated, since it's destructive).
- **CSV export** is available per collection (clients, projects, keywords,
  backlinks, tasks, reports) for spreadsheet backup or feeding Google
  Sheets.
- **CSV import** bulk-adds rows for **keywords**, **backlinks**, and the
  **content calendar** — the way agencies actually load rank-tracking data
  from a spreadsheet export. Each importer validates required columns,
  previews how many rows are valid vs. skipped (with reasons), and only
  writes to the database after you confirm.

## New SEO Project wizard

`Projects → + New SEO Project` (also available from a client's detail
page) is a dedicated flow for SEO engagements, beyond the generic project
form: bulk-paste target keywords (one per line, with an optional starting
rank), 2–5 primary competitor domains, a multi-select scope (Technical
SEO / On-Page / Off-Page / Content / Local SEO), a deliverables checklist
that auto-attaches as the project's technical audit checklist, reporting
cadence (wired into the client's existing `reportSchedule`), and baseline
metrics (starting traffic, starting keyword rankings, starting DA/DR) so
later reports can show real before/after deltas instead of just
current-state numbers. The project's Overview tab shows an "SEO Snapshot"
panel with baseline vs. current rank for each target keyword.

## Deploying to GitHub Pages

1. Push this repository to GitHub (if it isn't already).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a
   branch**.
4. Pick your branch (e.g. `main`) and set the folder to **`/ (root)`**.
5. Save. GitHub will publish the app at
   `https://<your-username>.github.io/<repo-name>/`.

No build step, no environment variables, no server — the repo is served
as-is. Because the app uses relative paths throughout (`css/styles.css`,
`js/db.js`, `assets/logo.svg`, hash-based routing), it works correctly
whether it's served from a repo subpath (`/repo-name/`) or a custom domain
root.

## Running locally

Any static file server works, e.g.:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Migrating from SEOFlow

If you have an existing SEOFlow workspace in this browser (`seoflow.db.v1`
in `localStorage`), GrowMark migrates it automatically and silently on
first load — your clients, projects, tasks, and reports carry over. The
legacy key is removed only after a successful copy to the new
`growmark.db.v1` key, so nothing is dropped in the process.

## Resetting your workspace

To start over completely (drops everything, including your agency name and
login), open your browser's dev tools console on the app and run:

```js
localStorage.removeItem('growmark.db.v1');
localStorage.removeItem('growmark.currentUser');
location.reload();
```

You'll land back on the onboarding wizard. For a *non-destructive* reset
that keeps your agency identity and login, use **Settings → Clear All
Data** instead.

## Feature checklist

- **Onboarding**: real agency name, real first client/project — no
  placeholder data ships to new users. Sample data is opt-in only.
- **Login gate**: optional username + PIN (salted PBKDF2 hash), session
  timeout, "remember this device," logout. Explicitly not billed as
  account-grade security.
- **Clients**: add/edit/delete, contact info, contract type, status,
  duplicate-name warning, per-client **Site Access** inventory.
- **Projects**: per-client, deliverable type, start date, status, team,
  files & notes, plus a dedicated **New SEO Project** wizard.
- **Tasks**: title, description, assignees, due date, priority, status,
  tags, subtasks/checklists, comments with `@mentions`, file attachments
  (stored as base64 data URLs), dependencies ("blocked by").
- **Views**: List, Kanban (drag-and-drop), Calendar, Timeline/Gantt.
- **Recurring tasks**: daily/weekly/monthly auto-regeneration.
- **My Tasks**: per-user, with Today/Overdue/Upcoming smart filters, plus
  global search and filter/sort by client, assignee, status, priority, tag,
  due date.
- **Keyword Tracker**: rank history with a canvas line chart, rank-change
  indicators, CSV bulk import.
- **Content Calendar**: Idea → Outline → Draft → Review → Published
  pipeline, calendar + list views, CSV bulk import.
- **Backlink Tracker**: source domain, DA/DR, anchor text, status, date
  acquired, CSV bulk import.
- **Technical SEO Audit Checklist**: reusable templates, attach to a
  project, pass/fail/N/A + notes per item.
- **Site Audit Issue Log**: per-client/project issues with severity and
  resolution status.
- **Report Builder**: branded cover page (GrowMark/Growistan logo, client,
  period, prepared-by), auto-generated executive summary from real deltas
  plus an editable agency-notes paragraph, honest empty states when data
  hasn't started tracking yet, recurring scheduling, "Copy as Text" for
  quick client emailing, "Export as PDF" via a branded print stylesheet
  with a repeating logo header/footer and page numbers on every page.
- **Dashboard**: tasks due this week, overdue-by-member, active projects,
  reports due, team workload chart.
- **Team**: members with avatar initials/colors, workload view.
- **Settings**: agency profile, security, sample data load/clear, full
  backup export/restore, per-collection CSV export, CSV import.
- **Activity/notification feed**, toasts, empty states throughout.
- **Responsive**: sidebar collapses to a hamburger menu under 900px;
  tables scroll horizontally instead of breaking layout.
- **Accessibility**: keyboard-navigable modals/router, visible focus
  states, `aria-label`s on icon-only buttons.
