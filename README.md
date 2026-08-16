# SEOFlow — SEO Agency Project Management

A complete, static project-management web app purpose-built for SEO agencies —
Asana/Monday.com-style workflows plus the SEO-specific tooling agencies
actually need (keyword tracking, content calendar, backlink tracker,
technical audit checklists, site issue logs, and automated client
reporting).

**Pure HTML5 + CSS3 + vanilla JavaScript (ES6+). No frameworks, no build
step, no backend.** All data is persisted client-side in `localStorage`
through a small data-access layer (`js/db.js`), so the whole thing runs
entirely in the browser and deploys as-is to GitHub Pages.

## Folder structure

```
.
├── index.html                 # single HTML shell; all views render into #app-root
├── css/
│   ├── styles.css             # full design system (layout, components, all views)
│   └── print.css              # print/PDF stylesheet used only for the Reports view
├── js/
│   ├── utils.js                # date/formatting/DOM helpers, badges, avatars
│   ├── db.js                   # localStorage data-access layer + demo seed data
│   ├── toast.js                 # toast notifications
│   ├── modal.js                 # modal + confirm-dialog manager
│   ├── router.js                # tiny hash-based router (#/clients, #/projects/:id, ...)
│   ├── app.js                   # app shell: sidebar, topbar, global search, notifications
│   ├── components/
│   │   ├── taskModal.js         # shared task detail/edit modal (used everywhere)
│   │   ├── charts.js            # dependency-free canvas charts (rank line, bar)
│   │   └── dnd.js                # drag-and-drop wiring for the Kanban board
│   └── views/
│       ├── dashboard.js          # agency-wide overview
│       ├── clients.js             # client list + detail
│       ├── projects.js            # cross-client project list
│       ├── projectDetail.js       # single project: tasks, keywords, content,
│       │                            backlinks, audit checklist, issue log, files/notes
│       ├── myTasks.js             # per-user tasks + Today/Overdue/Upcoming filters
│       ├── keywords.js            # Keyword Tracker (standalone + reusable section)
│       ├── contentCalendar.js     # Content Calendar (standalone + reusable section)
│       ├── backlinks.js           # Backlink Tracker (standalone + reusable section)
│       ├── reports.js             # Report Builder, scheduling, print/export
│       └── team.js                # team members + workload view
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
touches `localStorage` directly. To move to a real API later, you'd only
need to rewrite the internals of `db.js` to call `fetch()` instead of
`localStorage` — every view already treats it as an async-agnostic data
source.

On first load (or when the browser's `localStorage` is empty), the app
seeds itself with realistic demo data: 5 clients, 6 SEO projects, 15+
tasks, keyword rank histories, content calendar items, backlinks, an
attached technical SEO audit checklist, and site issue log entries.

## Recurring tasks & recurring reports

- **Recurring tasks**: a task can be marked daily/weekly/monthly. On every
  app load, `DB.processRecurringTasks()` checks whether a new occurrence is
  due for the current period and materializes a real task instance (linked
  back to its recurring template via `recurrenceParentId`), so "every
  Friday" tasks actually reappear on your board.
- **Recurring reports**: set a client's report schedule (weekly / monthly)
  on the client detail page. On every app load,
  `DB.processScheduledReports()` checks whether the current period already
  has a report draft for that client and, if not, generates one from live
  data (tasks completed, keyword movement, new backlinks, content
  published, open issues) and surfaces a reminder banner at the top of the
  app.

This client-side "check on load" approach is what makes recurrence work
without a server. For true unattended delivery (e.g. actually emailing a
report every Friday morning whether or not anyone opens the app), you'd
need a small backend/cron job — the UI and data model here are already
shaped for that (`reportSchedule` on each client, a `reports` collection
with `status: draft | final`), so swapping in a real scheduler later is a
matter of wiring a server-side job to the same `buildReportDraft()` logic.

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
`js/db.js`, hash-based routing), it works correctly whether it's served
from a repo subpath (`/repo-name/`) or a custom domain root.

## Running locally

Any static file server works, e.g.:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Resetting demo data

The seeded demo data lives entirely in `localStorage` under the key
`seoflow.db.v1`. To reset it, open your browser's dev tools console on the
app and run:

```js
localStorage.removeItem('seoflow.db.v1');
location.reload();
```

## Feature checklist

- **Clients**: add/edit/delete, contact info, contract type, status.
- **Projects**: per-client, deliverable type, start date, status, team,
  files & notes.
- **Tasks**: title, description, assignees, due date, priority, status,
  tags, subtasks/checklists, comments with `@mentions`, file attachments
  (stored as base64 data URLs), dependencies ("blocked by").
- **Views**: List, Kanban (drag-and-drop), Calendar, Timeline/Gantt.
- **Recurring tasks**: daily/weekly/monthly auto-regeneration.
- **My Tasks**: per-user, with Today/Overdue/Upcoming smart filters, plus
  global search and filter/sort by client, assignee, status, priority, tag,
  due date.
- **Keyword Tracker**: rank history with a canvas line chart, rank-change
  indicators.
- **Content Calendar**: Idea → Outline → Draft → Review → Published
  pipeline, calendar + list views.
- **Backlink Tracker**: source domain, DA/DR, anchor text, status, date
  acquired.
- **Technical SEO Audit Checklist**: reusable templates, attach to a
  project, pass/fail/N/A + notes per item.
- **Site Audit Issue Log**: per-client/project issues with severity and
  resolution status.
- **Report Builder**: auto-pulls completed tasks, keyword changes, new
  backlinks, published content, and open issues into a printable report;
  recurring scheduling; "Copy as Text" for quick client emailing;
  print-optimized layout for PDF export via the browser's print dialog.
- **Dashboard**: tasks due this week, overdue-by-member, active projects,
  reports due, team workload chart.
- **Team**: members with avatar initials/colors, workload view.
- **Activity/notification feed**, toasts, empty states throughout.
