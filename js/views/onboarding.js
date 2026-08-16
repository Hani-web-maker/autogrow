// views/onboarding.js — first-run setup wizard. Shown instead of the normal
// app shell whenever DB.settings().onboarded is false, i.e. a brand new,
// empty workspace with no fake demo data. Real agencies enter their real
// first client/project here; "Load Sample Data" (for demos) lives in
// Settings and is never triggered automatically.
const Onboarding = (() => {
  function render(onComplete) {
    const root = document.getElementById('app-root');
    const deliverableTypes = window.ProjectsView?.DELIVERABLE_TYPES || ['Full SEO Retainer'];
    root.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card onboarding-card">
          <div class="auth-brand">${Brand.fullLogoImg('auth-logo')}</div>
          <h1>Set up your workspace</h1>
          <p class="auth-subtitle">A few real details to get started — no placeholder data, ever.</p>

          <form id="onboarding-form" novalidate>
            <fieldset class="onboarding-section">
              <legend>Your agency</legend>
              <div class="task-field">
                <label for="ob-agency">Agency name</label>
                <input type="text" id="ob-agency" required placeholder="e.g. Growistan Digital" />
                <div class="field-error" id="err-ob-agency" hidden></div>
              </div>
            </fieldset>

            <fieldset class="onboarding-section">
              <legend>You</legend>
              <div class="task-field-grid">
                <div class="task-field">
                  <label for="ob-name">Your name</label>
                  <input type="text" id="ob-name" required placeholder="e.g. Jamie Ortiz" />
                  <div class="field-error" id="err-ob-name" hidden></div>
                </div>
                <div class="task-field">
                  <label for="ob-role">Your role</label>
                  <input type="text" id="ob-role" value="Account Owner" />
                </div>
                <div class="task-field">
                  <label for="ob-email">Your email</label>
                  <input type="email" id="ob-email" placeholder="you@agency.com" />
                </div>
              </div>
            </fieldset>

            <fieldset class="onboarding-section">
              <legend>Your first client</legend>
              <div class="task-field-grid">
                <div class="task-field">
                  <label for="ob-client-name">Client / company name</label>
                  <input type="text" id="ob-client-name" required placeholder="e.g. Brightleaf Dental" />
                  <div class="field-error" id="err-ob-client-name" hidden></div>
                </div>
                <div class="task-field">
                  <label for="ob-client-website">Website</label>
                  <input type="text" id="ob-client-website" placeholder="https://client-site.com" />
                </div>
              </div>
            </fieldset>

            <fieldset class="onboarding-section">
              <legend>Your first project</legend>
              <div class="task-field-grid">
                <div class="task-field">
                  <label for="ob-project-name">Project name</label>
                  <input type="text" id="ob-project-name" required placeholder="e.g. Full SEO Retainer" />
                  <div class="field-error" id="err-ob-project-name" hidden></div>
                </div>
                <div class="task-field">
                  <label for="ob-project-type">Deliverable type</label>
                  <select id="ob-project-type">${deliverableTypes.map((t) => `<option>${t}</option>`).join('')}</select>
                </div>
              </div>
            </fieldset>

            <fieldset class="onboarding-section">
              <legend>
                <label class="auth-remember"><input type="checkbox" id="ob-enable-auth" /> Secure this workspace with a username + PIN</label>
              </legend>
              <div id="ob-auth-fields" class="task-field-grid" hidden>
                <div class="task-field">
                  <label for="ob-auth-username">Username</label>
                  <input type="text" id="ob-auth-username" autocomplete="username" />
                </div>
                <div class="task-field">
                  <label for="ob-auth-pin">PIN / password</label>
                  <input type="password" id="ob-auth-pin" autocomplete="new-password" minlength="4" placeholder="At least 4 characters" />
                </div>
              </div>
              <p class="hint-text">Optional. A local device lock only — not account security. You can turn this on later from Settings.</p>
            </fieldset>

            <div class="auth-error" id="ob-error" hidden></div>
            <button type="submit" class="btn btn-primary auth-submit" id="ob-submit">Create my workspace</button>
          </form>

          <button class="link-btn onboarding-sample-link" id="ob-sample-link" type="button">Just exploring? Load sample data instead →</button>
        </div>
      </div>`;

    const authCheck = document.getElementById('ob-enable-auth');
    const authFields = document.getElementById('ob-auth-fields');
    authCheck.addEventListener('change', () => { authFields.hidden = !authCheck.checked; });

    document.getElementById('ob-sample-link').addEventListener('click', async () => {
      const ok = await ModalManager.confirmDialog({
        title: 'Load sample data?',
        message: 'This fills your workspace with fictional demo clients, projects, keywords, and reports so you can explore GrowMark before entering real data. You can clear it any time from Settings.',
        confirmLabel: 'Load sample data',
      });
      if (ok) {
        DB.loadSampleData();
        onComplete();
      }
    });

    document.getElementById('onboarding-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      Utils.qsa('.field-error', root).forEach((el) => { el.hidden = true; });
      document.getElementById('ob-error').hidden = true;

      const agencyName = document.getElementById('ob-agency').value.trim();
      const yourName = document.getElementById('ob-name').value.trim();
      const clientName = document.getElementById('ob-client-name').value.trim();
      const projectName = document.getElementById('ob-project-name').value.trim();

      let hasError = false;
      const requireField = (value, errId) => {
        if (!value) { document.getElementById(errId).textContent = 'Required.'; document.getElementById(errId).hidden = false; hasError = true; }
      };
      requireField(agencyName, 'err-ob-agency');
      requireField(yourName, 'err-ob-name');
      requireField(clientName, 'err-ob-client-name');
      requireField(projectName, 'err-ob-project-name');
      if (hasError) return;

      if (authCheck.checked) {
        const username = document.getElementById('ob-auth-username').value.trim();
        const pin = document.getElementById('ob-auth-pin').value;
        if (!username || pin.length < 4) {
          const err = document.getElementById('ob-error');
          err.textContent = 'To secure your workspace, enter a username and a PIN of at least 4 characters.';
          err.hidden = false;
          return;
        }
      }

      const submitBtn = document.getElementById('ob-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Setting up…';

      try {
        const teamMember = {
          id: Utils.uid('u'),
          name: yourName,
          role: document.getElementById('ob-role').value.trim() || 'Account Owner',
          email: document.getElementById('ob-email').value.trim(),
          initials: Utils.initials(yourName),
          color: '#0C4A73',
        };
        DB.insert('team', teamMember);
        DB.setCurrentUser(teamMember.id);

        const client = {
          id: Utils.uid('c'),
          name: clientName,
          contactName: '',
          contactEmail: '',
          contactPhone: '',
          website: document.getElementById('ob-client-website').value.trim(),
          contractType: 'monthly retainer',
          status: 'active',
          reportSchedule: { frequency: 'none' },
          createdAt: new Date().toISOString(),
        };
        DB.insert('clients', client);

        const project = {
          id: Utils.uid('p'),
          clientId: client.id,
          name: projectName,
          deliverableType: document.getElementById('ob-project-type').value,
          startDate: Utils.todayISO(),
          status: 'active',
          teamIds: [teamMember.id],
          notes: [],
          files: [],
          createdAt: new Date().toISOString(),
        };
        DB.insert('projects', project);
        DB.logActivity('client', `New client added: ${client.name}`, {});
        DB.logActivity('project', `New project created: ${project.name}`, { projectId: project.id });

        if (authCheck.checked) {
          await Auth.setup(
            document.getElementById('ob-auth-username').value.trim(),
            document.getElementById('ob-auth-pin').value
          );
        }

        DB.updateSettings({ agencyName, onboarded: true });
        onComplete();
      } catch (err) {
        console.error('Onboarding failed', err);
        const errBox = document.getElementById('ob-error');
        errBox.textContent = 'Something went wrong setting up your workspace. Please try again.';
        errBox.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create my workspace';
      }
    });

    document.getElementById('ob-agency').focus();
  }

  return { render };
})();
