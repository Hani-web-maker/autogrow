// db.js — localStorage data-access layer. Every read/write to persisted state
// goes through here, so swapping localStorage for a real API later only
// means rewriting this file's internals, not any view code.
const DB = (() => {
  const STORAGE_KEY = 'seoflow.db.v1';
  const CURRENT_USER_KEY = 'seoflow.currentUser';

  let cache = null;

  function load() {
    if (cache) return cache;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        cache = JSON.parse(raw);
        return cache;
      } catch (e) {
        console.error('Corrupt DB, reseeding', e);
      }
    }
    cache = seedData();
    persist();
    return cache;
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  }

  function save() {
    persist();
  }

  // ---------- generic collection helpers ----------
  function all(collection) {
    return load()[collection];
  }
  function get(collection, id) {
    return load()[collection].find((r) => r.id === id) || null;
  }
  function insert(collection, record) {
    const db = load();
    db[collection].push(record);
    persist();
    return record;
  }
  function update(collection, id, patch) {
    const db = load();
    const idx = db[collection].findIndex((r) => r.id === id);
    if (idx === -1) return null;
    db[collection][idx] = { ...db[collection][idx], ...patch };
    persist();
    return db[collection][idx];
  }
  function remove(collection, id) {
    const db = load();
    db[collection] = db[collection].filter((r) => r.id !== id);
    persist();
  }

  function currentUser() {
    const db = load();
    const savedId = localStorage.getItem(CURRENT_USER_KEY);
    return db.team.find((t) => t.id === savedId) || db.team[0];
  }
  function setCurrentUser(id) {
    localStorage.setItem(CURRENT_USER_KEY, id);
  }

  function logActivity(type, text, meta = {}) {
    insert('activity', {
      id: Utils.uid('act'),
      type,
      text,
      meta,
      createdAt: new Date().toISOString(),
      read: false,
    });
  }

  // ---------- recurring task engine ----------
  // Recurring "template" tasks carry a `recurrence` object and stay hidden
  // from normal views; each period we materialize a live instance task
  // linked back via recurrenceParentId, and record recurrence.lastGenerated
  // so we never double-generate within the same period.
  function periodKeyFor(freq, dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (freq === 'daily') return dateStr;
    if (freq === 'weekly') return Utils.weekRange(dateStr).start;
    if (freq === 'monthly') return Utils.monthRange(dateStr).start;
    return dateStr;
  }

  function nextDueDate(rec, fromDate) {
    if (rec.freq === 'daily') return fromDate;
    if (rec.freq === 'weekly') return Utils.nextWeekday(fromDate, rec.weekday);
    if (rec.freq === 'monthly') {
      const d = new Date(fromDate + 'T00:00:00');
      const day = Math.min(rec.dayOfMonth, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
      let candidate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (candidate < fromDate) {
        const nm = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const dayNext = Math.min(rec.dayOfMonth, new Date(nm.getFullYear(), nm.getMonth() + 1, 0).getDate());
        candidate = `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, '0')}-${String(dayNext).padStart(2, '0')}`;
      }
      return candidate;
    }
    return fromDate;
  }

  function processRecurringTasks() {
    const db = load();
    const today = Utils.todayISO();
    let changed = false;
    db.tasks
      .filter((t) => t.recurrence)
      .forEach((template) => {
        const rec = template.recurrence;
        const key = periodKeyFor(rec.freq, today);
        if (rec.lastGenerated === key) return; // already generated this period
        const due = nextDueDate(rec, today);
        // avoid duplicate instance for the same due date
        const exists = db.tasks.some((t) => t.recurrenceParentId === template.id && t.dueDate === due);
        if (!exists) {
          const instance = {
            id: Utils.uid('task'),
            title: template.title,
            description: template.description,
            projectId: template.projectId,
            clientId: template.clientId,
            assigneeIds: [...template.assigneeIds],
            dueDate: due,
            priority: template.priority,
            status: 'To Do',
            tags: [...template.tags],
            subtasks: template.subtasks.map((s) => ({ ...s, id: Utils.uid('sub'), done: false })),
            comments: [],
            attachments: [],
            dependsOn: [],
            recurrence: null,
            recurrenceParentId: template.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null,
          };
          db.tasks.push(instance);
          logActivity('recurring', `Recurring task generated: "${template.title}" (due ${Utils.formatDateShort(due)})`, { taskId: instance.id });
          changed = true;
        }
        template.recurrence.lastGenerated = key;
        changed = true;
      });
    if (changed) persist();
  }

  // ---------- recurring report scheduling ----------
  function processScheduledReports() {
    const db = load();
    const today = Utils.todayISO();
    let changed = false;
    db.clients.forEach((client) => {
      if (!client.reportSchedule || client.reportSchedule.frequency === 'none') return;
      const freq = client.reportSchedule.frequency; // weekly | monthly
      const range = freq === 'weekly' ? Utils.weekRange(today) : Utils.monthRange(today);
      const already = db.reports.some(
        (r) => r.clientId === client.id && r.period.start === range.start && r.period.end === range.end
      );
      if (already) return;
      // only generate once the period has actually started, and not before app has any history
      const report = buildReportDraft(client.id, range.start, range.end, freq);
      db.reports.push(report);
      logActivity('report', `New ${freq} report draft ready for ${client.name}`, { reportId: report.id, clientId: client.id });
      changed = true;
    });
    if (changed) persist();
  }

  function buildReportDraft(clientId, start, end, frequency) {
    const db = load();
    const client = db.clients.find((c) => c.id === clientId);
    const clientProjectIds = db.projects.filter((p) => p.clientId === clientId).map((p) => p.id);

    const tasksCompleted = db.tasks.filter(
      (t) => t.clientId === clientId && t.status === 'Done' && t.completedAt && t.completedAt.slice(0, 10) >= start && t.completedAt.slice(0, 10) <= end
    );
    const keywordChanges = db.keywords
      .filter((k) => k.clientId === clientId)
      .map((k) => {
        const inRange = k.history.filter((h) => h.date >= start && h.date <= end);
        if (inRange.length < 1) return null;
        const first = inRange[0].rank;
        const last = inRange[inRange.length - 1].rank;
        return { keyword: k.keyword, from: first, to: last, change: first - last };
      })
      .filter(Boolean);
    const newBacklinks = db.backlinks.filter((b) => b.clientId === clientId && b.dateAcquired >= start && b.dateAcquired <= end);
    const contentPublished = db.contentItems.filter(
      (c) => c.clientId === clientId && c.status === 'Published' && c.publishDate >= start && c.publishDate <= end
    );
    const openIssues = db.issues.filter((i) => i.clientId === clientId && i.status !== 'Resolved');

    return {
      id: Utils.uid('rpt'),
      clientId,
      period: { start, end },
      frequency,
      status: 'draft',
      content: {
        tasksCompleted: tasksCompleted.map((t) => t.id),
        keywordChanges,
        newBacklinks: newBacklinks.map((b) => b.id),
        contentPublished: contentPublished.map((c) => c.id),
        openIssues: openIssues.map((i) => i.id),
      },
      createdAt: new Date().toISOString(),
    };
  }

  function regenerateReportContent(reportId) {
    const db = load();
    const report = db.reports.find((r) => r.id === reportId);
    if (!report) return null;
    const fresh = buildReportDraft(report.clientId, report.period.start, report.period.end, report.frequency);
    report.content = fresh.content;
    persist();
    return report;
  }

  function init() {
    load();
    processRecurringTasks();
    processScheduledReports();
  }

  // ---------- seed data ----------
  function seedData() {
    const now = new Date();
    const iso = (d) => d.toISOString();
    const daysAgo = (n) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const daysFromNow = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };

    const team = [
      { id: 'u1', name: 'Alex Rivera', role: 'SEO Strategist', initials: 'AR', color: '#2563eb', email: 'alex@agency.com' },
      { id: 'u2', name: 'Priya Nair', role: 'Content Lead', initials: 'PN', color: '#0d9488', email: 'priya@agency.com' },
      { id: 'u3', name: 'Marcus Webb', role: 'Technical SEO', initials: 'MW', color: '#7c3aed', email: 'marcus@agency.com' },
      { id: 'u4', name: 'Dana Kim', role: 'Link Building Specialist', initials: 'DK', color: '#d97706', email: 'dana@agency.com' },
      { id: 'u5', name: 'Jordan Lee', role: 'Account Manager', initials: 'JL', color: '#dc2626', email: 'jordan@agency.com' },
    ];

    const clients = [
      {
        id: 'c1', name: 'Brightleaf Dental', contactName: 'Susan Ortiz', contactEmail: 'susan@brightleafdental.com',
        contactPhone: '555-201-3344', website: 'https://brightleafdental.com', contractType: 'monthly retainer',
        status: 'active', reportSchedule: { frequency: 'weekly', weekday: 5 }, createdAt: daysAgo(210),
      },
      {
        id: 'c2', name: 'Northgate Outdoor Gear', contactName: 'Tom Baxter', contactEmail: 'tom@northgateoutdoor.com',
        contactPhone: '555-478-9021', website: 'https://northgateoutdoor.com', contractType: 'monthly retainer',
        status: 'active', reportSchedule: { frequency: 'weekly', weekday: 5 }, createdAt: daysAgo(140),
      },
      {
        id: 'c3', name: 'Verity Law Partners', contactName: 'Elaine Cho', contactEmail: 'elaine@veritylaw.com',
        contactPhone: '555-662-1190', website: 'https://veritylaw.com', contractType: 'project-based',
        status: 'active', reportSchedule: { frequency: 'monthly', weekday: 1 }, createdAt: daysAgo(60),
      },
      {
        id: 'c4', name: 'Solace Home Spa', contactName: 'Renee Okafor', contactEmail: 'renee@solacehomespa.com',
        contactPhone: '555-330-7765', website: 'https://solacehomespa.com', contractType: 'monthly retainer',
        status: 'paused', reportSchedule: { frequency: 'none' }, createdAt: daysAgo(300),
      },
      {
        id: 'c5', name: 'Cascade Roofing Co.', contactName: 'Gary Holt', contactEmail: 'gary@cascaderoofing.com',
        contactPhone: '555-905-4432', website: 'https://cascaderoofing.com', contractType: 'monthly retainer',
        status: 'churned', reportSchedule: { frequency: 'none' }, createdAt: daysAgo(400),
      },
    ];

    const projects = [
      { id: 'p1', clientId: 'c1', name: 'Brightleaf Full SEO Retainer', deliverableType: 'Full SEO Retainer', startDate: daysAgo(200), status: 'active', teamIds: ['u1', 'u2', 'u3'], notes: [], files: [], createdAt: daysAgo(200) },
      { id: 'p2', clientId: 'c1', name: 'Brightleaf Local SEO Push', deliverableType: 'Local SEO', startDate: daysAgo(60), status: 'active', teamIds: ['u1', 'u4'], notes: [], files: [], createdAt: daysAgo(60) },
      { id: 'p3', clientId: 'c2', name: 'Northgate Technical Audit', deliverableType: 'Technical SEO Audit', startDate: daysAgo(30), status: 'active', teamIds: ['u3'], notes: [], files: [], createdAt: daysAgo(30) },
      { id: 'p4', clientId: 'c2', name: 'Northgate Link Building Campaign', deliverableType: 'Link Building Campaign', startDate: daysAgo(90), status: 'active', teamIds: ['u4', 'u1'], notes: [], files: [], createdAt: daysAgo(90) },
      { id: 'p5', clientId: 'c3', name: 'Verity Content Strategy', deliverableType: 'Content Strategy', startDate: daysAgo(45), status: 'active', teamIds: ['u2'], notes: [], files: [], createdAt: daysAgo(45) },
      { id: 'p6', clientId: 'c4', name: 'Solace Full SEO Retainer', deliverableType: 'Full SEO Retainer', startDate: daysAgo(280), status: 'on hold', teamIds: ['u1'], notes: [], files: [], createdAt: daysAgo(280) },
    ];

    let taskSeq = 1;
    const T = (overrides) => {
      const id = `t${taskSeq++}`;
      return {
        id,
        title: 'Untitled task',
        description: '',
        projectId: null,
        clientId: null,
        assigneeIds: [],
        dueDate: null,
        priority: 'Medium',
        status: 'To Do',
        tags: [],
        subtasks: [],
        comments: [],
        attachments: [],
        dependsOn: [],
        recurrence: null,
        recurrenceParentId: null,
        createdAt: daysAgo(20),
        updatedAt: daysAgo(20),
        completedAt: null,
        ...overrides,
      };
    };

    const tasks = [
      T({ title: 'Fix duplicate title tags on service pages', projectId: 'p1', clientId: 'c1', assigneeIds: ['u3'], dueDate: daysFromNow(2), priority: 'High', status: 'In Progress', tags: ['technical'], subtasks: [{ id: Utils.uid('sub'), title: 'Audit template pages', done: true }, { id: Utils.uid('sub'), title: 'Update title templates', done: false }] }),
      T({ title: 'Write "Best Family Dentist in Denver" blog post', projectId: 'p1', clientId: 'c1', assigneeIds: ['u2'], dueDate: daysFromNow(4), priority: 'Medium', status: 'In Progress', tags: ['content'] }),
      T({ title: 'Build 5 citations for GMB consistency', projectId: 'p2', clientId: 'c1', assigneeIds: ['u4'], dueDate: daysFromNow(-1), priority: 'High', status: 'Blocked', tags: ['local-seo'], dependsOn: [] }),
      T({ title: 'Weekly rank tracking update', projectId: 'p1', clientId: 'c1', assigneeIds: ['u1'], dueDate: Utils.nextWeekday(Utils.todayISO(), 5), priority: 'Medium', status: 'To Do', tags: ['reporting'], recurrence: { freq: 'weekly', weekday: 5, lastGenerated: null } }),
      T({ title: 'Submit updated sitemap to Search Console', projectId: 'p3', clientId: 'c2', assigneeIds: ['u3'], dueDate: daysFromNow(1), priority: 'Urgent', status: 'To Do', tags: ['technical'] }),
      T({ title: 'Resolve Core Web Vitals LCP issues', projectId: 'p3', clientId: 'c2', assigneeIds: ['u3'], dueDate: daysFromNow(6), priority: 'High', status: 'In Review', tags: ['technical', 'cwv'] }),
      T({ title: 'Outreach to 15 outdoor gear bloggers', projectId: 'p4', clientId: 'c2', assigneeIds: ['u4'], dueDate: daysFromNow(3), priority: 'Medium', status: 'In Progress', tags: ['link-building'] }),
      T({ title: 'Draft guest post pitch template', projectId: 'p4', clientId: 'c2', assigneeIds: ['u4', 'u2'], dueDate: daysAgo(2), priority: 'Low', status: 'Done', tags: ['link-building'], completedAt: daysAgo(1) }),
      T({ title: 'Keyword research for practice area pages', projectId: 'p5', clientId: 'c3', assigneeIds: ['u2'], dueDate: daysFromNow(5), priority: 'Medium', status: 'To Do', tags: ['content', 'keywords'] }),
      T({ title: 'Publish "Personal Injury FAQ" page', projectId: 'p5', clientId: 'c3', assigneeIds: ['u2'], dueDate: daysFromNow(8), priority: 'Medium', status: 'To Do', tags: ['content'] }),
      T({ title: 'Client kickoff call recap + action items', projectId: 'p5', clientId: 'c3', assigneeIds: ['u5'], dueDate: daysAgo(3), priority: 'Low', status: 'Done', tags: [], completedAt: daysAgo(3) }),
      T({ title: 'Monthly performance report — Verity', projectId: 'p5', clientId: 'c3', assigneeIds: ['u1'], dueDate: Utils.monthRange().end, priority: 'Medium', status: 'To Do', tags: ['reporting'], recurrence: { freq: 'monthly', dayOfMonth: 1, lastGenerated: null } }),
      T({ title: 'Review robots.txt for accidental disallow rules', projectId: 'p1', clientId: 'c1', assigneeIds: ['u3'], dueDate: daysFromNow(0), priority: 'High', status: 'To Do', tags: ['technical'] }),
      T({ title: 'Internal linking pass on blog archive', projectId: 'p1', clientId: 'c1', assigneeIds: ['u2'], dueDate: daysFromNow(10), priority: 'Low', status: 'To Do', tags: ['content'] }),
      T({ title: 'Competitor backlink gap analysis', projectId: 'p4', clientId: 'c2', assigneeIds: ['u1'], dueDate: daysFromNow(7), priority: 'Medium', status: 'To Do', tags: ['link-building'] }),
    ];
    // add a couple of comments/activity to make it feel lived-in
    tasks[0].comments.push({ id: Utils.uid('cmt'), authorId: 'u1', text: 'Prioritize the /services/ pages first — those are getting the most impressions in Search Console. @Marcus Webb', createdAt: daysAgo(1), mentions: ['u3'] });
    tasks[2].comments.push({ id: Utils.uid('cmt'), authorId: 'u4', text: 'Blocked — waiting on GMB access from client.', createdAt: daysAgo(2), mentions: [] });

    function rankHistory(startRank, weeks, volatility = 3) {
      const hist = [];
      let rank = startRank;
      for (let i = weeks; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i * 7);
        rank = Math.max(1, Math.round(rank + (Math.random() * volatility * 2 - volatility)));
        hist.push({ date: d.toISOString().slice(0, 10), rank });
      }
      return hist;
    }

    const keywords = [
      { id: 'k1', clientId: 'c1', projectId: 'p1', keyword: 'family dentist denver', targetUrl: '/services/family-dentistry', searchVolume: 880, history: rankHistory(14, 10) },
      { id: 'k2', clientId: 'c1', projectId: 'p1', keyword: 'emergency dentist near me', targetUrl: '/services/emergency', searchVolume: 2400, history: rankHistory(9, 10) },
      { id: 'k3', clientId: 'c1', projectId: 'p2', keyword: 'best dentist in capitol hill', targetUrl: '/', searchVolume: 320, history: rankHistory(22, 10) },
      { id: 'k4', clientId: 'c2', projectId: 'p3', keyword: 'best hiking backpacks 2026', targetUrl: '/guides/hiking-backpacks', searchVolume: 1900, history: rankHistory(6, 10) },
      { id: 'k5', clientId: 'c2', projectId: 'p4', keyword: 'waterproof tents for backpacking', targetUrl: '/collections/tents', searchVolume: 1100, history: rankHistory(11, 10) },
      { id: 'k6', clientId: 'c2', projectId: 'p3', keyword: 'northgate outdoor gear reviews', targetUrl: '/', searchVolume: 210, history: rankHistory(3, 10) },
      { id: 'k7', clientId: 'c3', projectId: 'p5', keyword: 'personal injury lawyer near me', targetUrl: '/practice-areas/personal-injury', searchVolume: 3600, history: rankHistory(18, 8) },
      { id: 'k8', clientId: 'c3', projectId: 'p5', keyword: 'car accident attorney fees', targetUrl: '/faq/fees', searchVolume: 720, history: rankHistory(25, 8) },
    ];

    const contentItems = [
      { id: 'ci1', clientId: 'c1', projectId: 'p1', title: 'Best Family Dentist in Denver', status: 'Draft', writerId: 'u2', targetKeyword: 'family dentist denver', publishDate: daysFromNow(4) },
      { id: 'ci2', clientId: 'c1', projectId: 'p1', title: 'What to Do in a Dental Emergency', status: 'Review', writerId: 'u2', targetKeyword: 'emergency dentist near me', publishDate: daysFromNow(9) },
      { id: 'ci3', clientId: 'c1', projectId: 'p2', title: 'Capitol Hill Dentist Neighborhood Guide', status: 'Idea', writerId: 'u2', targetKeyword: 'best dentist in capitol hill', publishDate: daysFromNow(20) },
      { id: 'ci4', clientId: 'c2', projectId: 'p3', title: 'Best Hiking Backpacks 2026', status: 'Published', writerId: 'u1', targetKeyword: 'best hiking backpacks 2026', publishDate: daysAgo(12) },
      { id: 'ci5', clientId: 'c2', projectId: 'p4', title: 'Waterproof Tent Buying Guide', status: 'Outline', writerId: 'u4', targetKeyword: 'waterproof tents for backpacking', publishDate: daysFromNow(14) },
      { id: 'ci6', clientId: 'c3', projectId: 'p5', title: 'Personal Injury FAQ', status: 'Draft', writerId: 'u2', targetKeyword: 'personal injury lawyer near me', publishDate: daysFromNow(8) },
      { id: 'ci7', clientId: 'c3', projectId: 'p5', title: 'What Are Typical Attorney Fees?', status: 'Idea', writerId: 'u2', targetKeyword: 'car accident attorney fees', publishDate: daysFromNow(30) },
    ];

    const backlinks = [
      { id: 'bl1', clientId: 'c1', sourceDomain: 'denverhealthblog.com', da: 52, dr: 48, anchorText: 'family dentist denver', status: 'Live', dateAcquired: daysAgo(18), targetUrl: '/services/family-dentistry' },
      { id: 'bl2', clientId: 'c1', sourceDomain: 'localbizdirectory.com', da: 38, dr: 35, anchorText: 'Brightleaf Dental', status: 'Live', dateAcquired: daysAgo(9), targetUrl: '/' },
      { id: 'bl3', clientId: 'c1', sourceDomain: 'parentingdenver.com', da: 44, dr: 41, anchorText: 'emergency dentist', status: 'Pending', dateAcquired: daysAgo(2), targetUrl: '/services/emergency' },
      { id: 'bl4', clientId: 'c2', sourceDomain: 'trailrunnermag.com', da: 61, dr: 58, anchorText: 'best hiking backpacks', status: 'Live', dateAcquired: daysAgo(25), targetUrl: '/guides/hiking-backpacks' },
      { id: 'bl5', clientId: 'c2', sourceDomain: 'outdoorgearlab-fan.com', da: 29, dr: 27, anchorText: 'northgate outdoor gear', status: 'Lost', dateAcquired: daysAgo(70), targetUrl: '/' },
      { id: 'bl6', clientId: 'c2', sourceDomain: 'campinginsider.net', da: 47, dr: 44, anchorText: 'waterproof tents', status: 'Pending', dateAcquired: daysAgo(4), targetUrl: '/collections/tents' },
      { id: 'bl7', clientId: 'c3', sourceDomain: 'legalinsightshub.com', da: 55, dr: 51, anchorText: 'personal injury lawyer', status: 'Live', dateAcquired: daysAgo(15), targetUrl: '/practice-areas/personal-injury' },
    ];

    const auditTemplates = [
      {
        id: 'at1', name: 'Standard Technical SEO Audit', items: [
          { id: Utils.uid('ati'), text: 'Core Web Vitals (LCP, CLS, INP) within thresholds' },
          { id: Utils.uid('ati'), text: 'Title tags unique and within length' },
          { id: Utils.uid('ati'), text: 'Meta descriptions present and unique' },
          { id: Utils.uid('ati'), text: 'XML sitemap present and submitted' },
          { id: Utils.uid('ati'), text: 'robots.txt free of unintended disallows' },
          { id: Utils.uid('ati'), text: 'Schema markup valid (Organization, Article, LocalBusiness)' },
          { id: Utils.uid('ati'), text: 'No orphaned or unindexed key pages' },
          { id: Utils.uid('ati'), text: 'HTTPS enforced site-wide, no mixed content' },
          { id: Utils.uid('ati'), text: 'Mobile usability issues resolved' },
          { id: Utils.uid('ati'), text: 'Canonical tags correctly implemented' },
        ],
      },
    ];

    const projectAudits = [
      {
        id: 'pa1', projectId: 'p3', templateId: 'at1', name: 'Standard Technical SEO Audit', createdAt: daysAgo(28),
        items: auditTemplates[0].items.map((it, i) => ({
          id: Utils.uid('pai'), text: it.text,
          status: i < 4 ? (i === 1 ? 'fail' : 'pass') : 'pending',
          notes: i === 1 ? 'Several product pages share the same title template.' : '',
        })),
      },
    ];

    const issues = [
      { id: 'is1', clientId: 'c2', projectId: 'p3', title: '404 errors from removed product category', description: '38 URLs returning 404, previously indexed. Needs 301 redirects.', severity: 'High', status: 'Open', foundDate: daysAgo(20), resolvedDate: null },
      { id: 'is2', clientId: 'c2', projectId: 'p3', title: 'Duplicate content across filter URL parameters', description: 'Faceted navigation generating duplicate/thin content pages.', severity: 'Medium', status: 'In Progress', foundDate: daysAgo(18), resolvedDate: null },
      { id: 'is3', clientId: 'c1', projectId: 'p1', title: 'Broken internal links in blog sidebar', description: '6 broken links pointing to an old blog category.', severity: 'Low', status: 'Resolved', foundDate: daysAgo(40), resolvedDate: daysAgo(35) },
      { id: 'is4', clientId: 'c1', projectId: 'p1', title: 'Missing alt text on service page images', description: 'Accessibility + image SEO gap across 12 pages.', severity: 'Low', status: 'Open', foundDate: daysAgo(6), resolvedDate: null },
    ];

    const reports = [];
    const activity = [
      { id: Utils.uid('act'), type: 'system', text: 'Welcome to SEOFlow — your demo workspace has been seeded with sample data.', meta: {}, createdAt: iso(now), read: false },
    ];

    return {
      meta: { version: 1, seededAt: iso(now) },
      team, clients, projects, tasks, keywords, contentItems, backlinks,
      auditTemplates, projectAudits, issues, reports, activity,
    };
  }

  function resetDemoData() {
    cache = seedData();
    persist();
  }

  return {
    load, save, all, get, insert, update, remove,
    currentUser, setCurrentUser, logActivity, init, resetDemoData,
    regenerateReportContent, buildReportDraft,
  };
})();
