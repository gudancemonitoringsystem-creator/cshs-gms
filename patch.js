
(() => {
  const busyClass = 'spinner-border spinner-border-sm me-2';

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (button.dataset.originalHtml === undefined) {
        button.dataset.originalHtml = button.innerHTML;
      }
      button.disabled = true;
      button.dataset.busy = '1';
      if (label) {
        button.innerHTML = `<span class="${busyClass}" aria-hidden="true"></span>${label}`;
      }
    } else {
      button.disabled = false;
      button.dataset.busy = '0';
      if (button.dataset.originalHtml !== undefined) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    }
  }

  function statusLabel(status) {
    const map = {
      pending: 'Pending',
      under_review: 'Under Review',
      waiting: 'Waiting',
      ready: 'Ready',
      printed: 'Printed',
      completed: 'Completed',
      reviewed: 'Reviewed',
      noted: 'Noted',
      approved: 'Approved',
      rejected: 'Rejected',
      archived: 'Archived',
      resolved: 'Resolved'
    };
    return map[String(status || '').toLowerCase()] || String(status || '—').replaceAll('_', ' ');
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setSession(user) {
    if (!user?.username) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      username: user.username,
      loginAt: new Date().toISOString()
    }));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function resolveSession(session) {
    if (!session?.username) return null;
    const user = db.users.find(u => String(u.username).toLowerCase() === String(session.username).toLowerCase());
    if (!user || user.active === false) return null;
    return user;
  }

  function syncResponsiveState() {
    document.body.classList.add('gms-patched');
    document.documentElement.style.scrollBehavior = 'smooth';
  }

  function setAppVisibility(authed) {
    const loginView = document.getElementById('loginView');
    const appView = document.getElementById('appView');
    if (loginView) loginView.classList.toggle('hidden', authed);
    if (appView) appView.classList.toggle('hidden', !authed);
  }

  function refreshSessionState() {
    const resolved = resolveSession(getSession());
    if (resolved) {
      currentUser = resolved;
      setSession(resolved);
      setAppVisibility(true);
      const badge = document.getElementById('userBadge');
      if (badge) badge.textContent = `${resolved.name} · ${roleTitles[resolved.role]}`;
      if (typeof buildNav === 'function') buildNav();
      if (typeof showPage === 'function') showPage(landingPageForRole(resolved.role));
      if (typeof touchActivity === 'function') touchActivity();
      if (typeof startIdleTimer === 'function') startIdleTimer();
    } else {
      clearSession();
      currentUser = null;
      setAppVisibility(false);
    }
  }

  function openGoodMoralModal() {
    if (currentUser?.role !== 'student') {
      toast('Access denied', 'Only students can submit a Good Moral request.', 'warning');
      return;
    }
    const student = typeof currentStudent === 'function' ? currentStudent() : null;
    if (!student) {
      toast('Profile not found', 'Your student record is missing. Please contact the administrator.', 'danger');
      return;
    }
    if (typeof syncGoodMoralReadyState === 'function') syncGoodMoralReadyState();
    if (typeof applyStudentToFields === 'function') applyStudentToFields('gm', student);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('goodMoralModal')).show();
  }

  function openIncidentWizard() {
    if (currentUser?.role !== 'student') {
      toast('Access denied', 'Only students can submit an incident report.', 'warning');
      return;
    }
    const student = typeof currentStudent === 'function' ? currentStudent() : null;
    if (!student) {
      toast('Profile not found', 'Your student record is missing. Please contact the administrator.', 'danger');
      return;
    }
    currentStage = 1;
    selectedConduct = '';
    syncWizard();
    document.getElementById('selectedConduct').value = '';
    if (typeof applyStudentToFields === 'function') applyStudentToFields('intakeVictim', student);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('incidentWizard')).show();
  }

  function clearAccountEditMode() {
    editingAccountUsername = '';
    const editing = document.getElementById('accountEditingUsername');
    const title = document.getElementById('accountFormTitle');
    const submitBtn = document.getElementById('accountSubmitBtn');
    const passwordInput = document.getElementById('accountPassword');
    const usernameInput = document.getElementById('accountUsername');

    if (editing) editing.value = '';
    if (title) title.textContent = 'Create account';
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa-solid fa-user-plus me-2"></i>Create account';
      submitBtn.classList.remove('btn-warning');
      submitBtn.classList.add('btn-primary');
      setButtonBusy(submitBtn, false);
    }
    if (passwordInput) {
      passwordInput.required = true;
      passwordInput.placeholder = '';
    }
    if (usernameInput) usernameInput.readOnly = false;
  }

  function beginAccountEdit(username) {
    const user = db.users.find(u => u.username === username);
    if (!user) {
      toast('Not found', 'The selected account could not be found.', 'warning');
      return;
    }

    editingAccountUsername = user.username;
    document.getElementById('accountEditingUsername').value = user.username;
    document.getElementById('accountFormTitle').textContent = `Edit ${user.username}`;
    document.getElementById('accountRole').value = user.role;
    document.getElementById('accountUsername').value = user.username;
    document.getElementById('accountUsername').readOnly = true;
    document.getElementById('accountPassword').value = '';
    document.getElementById('accountPassword').required = false;
    document.getElementById('accountPassword').placeholder = 'Leave blank to keep the current password';
    document.getElementById('accountName').value = user.name || '';
    document.getElementById('accountEmail').value = user.email || '';
    document.getElementById('accountSection').value = user.section || '';
    document.getElementById('accountLrn').value = user.lrn || '';
    document.getElementById('accountAdviser').value = user.adviser || '';
    document.getElementById('accountDepartment').value = user.department || '';
    document.getElementById('accountPosition').value = user.position || '';
    document.getElementById('accountNote').value = '';
    syncAccountRoleFields();
    const submitBtn = document.getElementById('accountSubmitBtn');
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa-solid fa-pen-to-square me-2"></i>Update account';
      submitBtn.classList.remove('btn-primary');
      submitBtn.classList.add('btn-warning');
    }
    showPage('accountsPage');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function deleteAccount(username) {
    const user = db.users.find(u => u.username === username);
    if (!user) return;
    const action = user.active === false ? 'reactivate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${action} ${user.username}?`)) return;

    user.active = !user.active;
    user.updatedAt = new Date().toISOString();
    addAudit('Account status changed', `${user.username} ${user.active ? 'reactivated' : 'deactivated'} by admin.`);
    notify(user.username, 'Account status updated', `Your account has been ${user.active ? 'reactivated' : 'deactivated'}.`);
    saveDB();
    syncStudentDirectory();
    renderAccountsPage();
    renderAll();
    toast('Saved', `Account ${user.active ? 'reactivated' : 'deactivated'}.`, 'success');
  }

  function removeAccount(username) {
    const user = db.users.find(u => u.username === username);
    if (!user) return;
    if (!confirm(`Permanently remove ${user.username}? This cannot be undone.`)) return;

    db.users = db.users.filter(u => u.username !== username);
    db.notifications = db.notifications.filter(n => n.user !== username);
    db.goodMoralRequests = db.goodMoralRequests.filter(x => x.studentUser !== username);
    db.incidentReports = db.incidentReports.filter(x => x.reporterUser !== username);
    db.auditLogs = db.auditLogs.filter(x => x.user !== username);
    if (currentUser?.username === username) logout();
    syncStudentDirectory();
    saveDB();
    renderAccountsPage();
    renderAll();
    addAudit('Account removed', `${username} permanently removed.`);
    toast('Removed', `${username} was permanently removed.`, 'warning');
  }

  async function resetPassword(username) {
    const user = db.users.find(u => u.username === username);
    if (!user) return;
    if (!confirm(`Reset the password for ${user.username}?`)) return;

    const tempPassword = `${user.username.slice(0, 4) || 'GMS'}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    user.passwordHash = await hashPassword(tempPassword);
    user.updatedAt = new Date().toISOString();
    saveDB();
    notify(user.username, 'Password reset', `Your temporary password is ${tempPassword}.`);
    addAudit('Password reset', `${user.username} password reset by admin.`);
    renderAccountsPage();
    renderAll();
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast('Password reset', `Temporary password copied for ${user.username}.`, 'success');
    } catch {
      toast('Password reset', `Temporary password generated for ${user.username}.`, 'success');
    }
  }

  async function createAccountFromForm(e) {
    e.preventDefault();
    const form = e.target;
    if (form.dataset.submitting === '1') return;
    if (currentUser?.role !== 'admin') {
      toast('Access denied', 'Only the admin can create or edit accounts.', 'danger');
      return;
    }

    const submitBtn = document.getElementById('accountSubmitBtn');
    form.dataset.submitting = '1';
    setButtonBusy(submitBtn, true, editingAccountUsername ? 'Updating...' : 'Creating...');

    try {
      const editingUsername = String(editingAccountUsername || document.getElementById('accountEditingUsername')?.value || '').trim();
      const role = document.getElementById('accountRole').value;
      const username = document.getElementById('accountUsername').value.trim();
      const password = document.getElementById('accountPassword').value;
      const email = String(document.getElementById('accountEmail')?.value || '').trim();
      const name = document.getElementById('accountName').value.trim();
      const section = document.getElementById('accountSection').value.trim();
      const lrn = document.getElementById('accountLrn').value.trim();
      const adviser = document.getElementById('accountAdviser').value.trim();
      const department = document.getElementById('accountDepartment').value.trim();
      const position = document.getElementById('accountPosition').value.trim();
      const note = document.getElementById('accountNote').value.trim();

      if (!username || !name || (!editingUsername && !password)) {
        toast('Missing fields', 'Please complete the required fields.', 'warning');
        return;
      }

      const target = editingUsername ? db.users.find(u => u.username === editingUsername) : null;
      const usernameExists = db.users.some(u => u.username.toLowerCase() === username.toLowerCase() && u.username !== editingUsername);
      const emailExists = email && db.users.some(u => String(u.email || '').toLowerCase() === email.toLowerCase() && u.username !== editingUsername);
      const lrnExists = role === 'student' && lrn && db.users.some(u => u.role === 'student' && String(u.lrn || '').toLowerCase() === lrn.toLowerCase() && u.username !== editingUsername);

      if (usernameExists) return toast('Username exists', 'Choose a different username.', 'danger');
      if (emailExists) return toast('Email exists', 'Choose a different email.', 'danger');
      if (lrnExists) return toast('LRN exists', 'This LRN is already registered.', 'danger');

      const baseUser = {
        username,
        email,
        role,
        name,
        section: role === 'student' ? section : '',
        lrn: role === 'student' ? lrn : '',
        adviser: role === 'student' ? adviser : '',
        department: role === 'student' ? '' : department,
        position: role === 'student' ? '' : position,
        active: true
      };

      if (target) {
        Object.assign(target, baseUser);
        if (password.trim()) target.passwordHash = await hashPassword(password);
        target.updatedAt = new Date().toISOString();
        addAudit('Account updated', `${target.username} updated by admin.`);
        notify(target.username, 'Account updated', 'Your account details were updated by the administrator.');
        notifyAdmins('Account updated', `${target.username} was updated.`);
        toast('Saved', 'Account updated successfully.', 'success');
      } else {
        const user = {
          ...baseUser,
          passwordHash: await hashPassword(password),
          createdAt: new Date().toISOString()
        };
        db.users.unshift(user);
        if (role === 'student') {
          db.notifications.unshift({
            id: uid(),
            user: username,
            title: 'Welcome to the Guidance Management System',
            message: note || 'Your student account is ready. Use your credentials to sign in.',
            createdAt: new Date().toISOString(),
            read: false
          });
        }
        addAudit('Account created', `${username} (${role}) created by admin.`);
        notifyAdmins('Account created', `${username} (${role}) created.`);
        toast('Account created', `${username} added successfully.`, 'success');
      }

      syncStudentDirectory();
      saveDB();
      renderAccountsPage();
      renderAll();
      form.reset();
      clearAccountEditMode();
    } finally {
      setButtonBusy(submitBtn, false);
      form.dataset.submitting = '0';
    }
  }

  async function printCertificateById(id) {
    const printBtn = document.getElementById('printCertificateBtn');
    if (printBtn?.dataset.busy === '1') return;
    setButtonBusy(printBtn, true, 'Preparing...');
    try {
      const item = db.goodMoralRequests.find(x => x.id === id);
      if (!item || item.status !== 'ready') {
        toast('Unavailable', 'This certificate is not ready for printing yet.', 'warning');
        return;
      }
      currentPrintCertificateId = id;
      const preview = document.getElementById('certificatePreview');
      preview.innerHTML = buildCertificate(item);
      const previewQr = preview.querySelector('#certificateQr');
      if (previewQr) {
        previewQr.innerHTML = '';
        new QRCode(previewQr, {
          text: `${location.href.split('#')[0]}#archive=${encodeURIComponent(item.id)}`,
          width: 120,
          height: 120,
          correctLevel: QRCode.CorrectLevel.M
        });
      }
      openModal('certificateModal').show();
      printBtn.onclick = async () => {
        const printArea = prepareCertificatePrint(item);
        await waitForImages(printArea);
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready.catch(() => {});
        }
        setTimeout(() => window.print(), 40);
      };
    } finally {
      setButtonBusy(printBtn, false);
    }
  }

  async function submitGoodMoral(e) {
    e.preventDefault();
    const form = e.target;
    if (form.dataset.submitting === '1') return;
    const submitBtn = form.querySelector('button[type="submit"]');
    form.dataset.submitting = '1';
    setButtonBusy(submitBtn, true, 'Submitting...');
    try {
      const student = currentStudent() || findStudentByLrn(document.getElementById('gmLrn').value);
      if (!student) {
        toast('Missing profile', 'Your student profile could not be found.', 'danger');
        return;
      }

      const req = {
        id: uid(),
        studentUser: currentUser.username,
        studentName: document.getElementById('gmName').value.trim() || student.name || 'Anonymous',
        lrn: document.getElementById('gmLrn').value.trim() || student.lrn || '',
        section: document.getElementById('gmSection').value.trim() || student.section || '',
        purpose: document.getElementById('gmPurpose').value.trim(),
        notes: document.getElementById('gmNotes').value.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        readyAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        staffNotes: '',
        warningLevel: 'none'
      };

      db.goodMoralRequests.unshift(req);
      notify(currentUser.username, 'Good Moral request submitted', 'Your request was received. You will wait 2 days unless noted earlier.');
      notifyRole('teacher', 'New Good Moral request', `${req.studentName} submitted a Good Moral request.`);
      notifyRole('counselor', 'New Good Moral request', `${req.studentName} submitted a Good Moral request.`);
      notifyRole('principal', 'New Good Moral request', `${req.studentName} submitted a Good Moral request.`);
      notifyAdmins('New Good Moral request', `${req.studentName} submitted a Good Moral request.`);
      addAudit('Good Moral submitted', `${req.studentName} submitted a request.`);
      saveDB();
      bootstrap.Modal.getOrCreateInstance(document.getElementById('goodMoralModal')).hide();
      form.reset();
      syncGoodMoralReadyState();
      renderAll();
      toast('Request submitted', 'Please wait 2 days unless a department head notes it earlier.', 'success');
    } finally {
      setButtonBusy(submitBtn, false);
      form.dataset.submitting = '0';
    }
  }

  async function submitIncident(e) {
    e.preventDefault();
    const form = e.target;
    if (form.dataset.submitting === '1') return;
    const submitBtn = form.querySelector('button[type="submit"]');
    form.dataset.submitting = '1';
    setButtonBusy(submitBtn, true, 'Submitting...');
    try {
      const report = {
        id: uid(),
        reporterUser: currentUser.username,
        reporterName: document.getElementById('irReporter').value.trim(),
        reporterRole: document.getElementById('irReporterRole').value.trim(),
        date: document.getElementById('irDate').value,
        time: document.getElementById('irTime').value,
        location: document.getElementById('irLocation').value.trim(),
        section: document.getElementById('irSection').value.trim(),
        summary: document.getElementById('irSummary').value.trim(),
        conduct: selectedConduct,
        victimName: document.getElementById('intakeVictimName').value.trim(),
        victimLrn: document.getElementById('intakeVictimLrn').value.trim(),
        victimSection: document.getElementById('intakeVictimSection').value.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        staffNotes: '',
        warningLevel: 'none'
      };

      db.incidentReports.unshift(report);
      notify(currentUser.username, 'Incident report submitted', 'Your report has been received and will be reviewed.');
      notifyAdmins('Incident submitted', `Incident report ${report.id} submitted.`);
      notifyRole('counselor', 'Incident report submitted', `New report from ${report.reporterName}.`);
      notifyRole('principal', 'Incident report submitted', `New report from ${report.reporterName}.`);
      addAudit('Incident submitted', `${report.id} submitted for review.`);
      saveDB();
      bootstrap.Modal.getOrCreateInstance(document.getElementById('incidentWizard')).hide();
      form.reset();
      selectedConduct = '';
      renderAll();
      toast('Incident submitted', 'The report has been saved successfully.', 'success');
    } finally {
      setButtonBusy(submitBtn, false);
      form.dataset.submitting = '0';
    }
  }

  async function setReviewResult(mode) {
    if (!currentReview) return;
    const canDecide = ['admin', 'counselor'].includes(currentUser?.role);
    if (!canDecide) {
      toast('View only', 'This account can only review information.', 'warning');
      return;
    }

    const approveBtn = document.getElementById('approveBtn');
    const rejectBtn = document.getElementById('rejectBtn');
    const activeBtn = mode === 'reject' ? rejectBtn : approveBtn;
    if (activeBtn && activeBtn.dataset.busy === '1') return;
    setButtonBusy(activeBtn, true, mode === 'reject' ? 'Rejecting...' : 'Saving...');
    setButtonBusy(mode === 'reject' ? approveBtn : rejectBtn, true, 'Please wait...');

    try {
      const reviewLabel = currentReview.kindLabel;
      const arr = currentReview.kind === 'incident' ? db.incidentReports : db.goodMoralRequests;
      const item = arr.find(x => x.id === currentReview.id);
      if (!item) return;
      const notes = document.getElementById('reviewNotes').value.trim();
      const warning = document.getElementById('reviewWarning').value || 'none';
      item.staffNotes = notes;
      item.warningLevel = warning;

      if (mode === 'reject') {
        item.status = 'rejected';
        notify(item.studentUser, 'Submission rejected', `${reviewLabel} was rejected.`);
        notifyAdmins('Submission rejected', `${reviewLabel} ${item.id} rejected.`);
        addAudit('Rejected', `${reviewLabel} ${item.id} rejected.`);
      } else if (currentReview.kind === 'incident') {
        item.status = 'under_review';
        notify(item.studentUser, 'Incident noted', 'Your incident report is under review by staff.');
        notifyAdmins('Incident reviewed', `${item.id} reviewed.`);
        addAudit('Incident reviewed', `${item.id} reviewed with ${warning} warning.`);
      } else {
        const timing = document.querySelector('input[name="gmTiming"]:checked')?.value || '2';
        const custom = Number(document.getElementById('gmCustomDays').value || 2);
        const days = timing === 'custom' ? Math.max(0, custom) : Number(timing);
        item.status = 'noted';
        if (days === 0) {
          item.status = 'ready';
          item.readyAt = new Date().toISOString();
          notify(item.studentUser, 'Good Moral ready', 'Your certificate is ready for printing now.');
        } else {
          item.readyAt = new Date(Date.now() + days * 86400000).toISOString();
          notify(item.studentUser, 'Good Moral noted', `Your request was noted. Please wait ${days} day(s) before printing your certificate.`);
        }
        notifyAdmins('Good Moral updated', `${item.id} set to ${item.status} with ${warning} warning.`);
        addAudit('Good Moral updated', `${item.id} set to ${item.status} with ${warning} warning.`);
      }

      saveDB();
      openModal('reviewModal').hide();
      currentReview = null;
      renderAll();
      toast('Saved', `${reviewLabel} updated successfully.`, mode === 'reject' ? 'warning' : 'success');
    } finally {
      setButtonBusy(approveBtn, false);
      setButtonBusy(rejectBtn, false);
    }
  }

  document.addEventListener('submit', async (e) => {
    if (e.target?.id === 'accountForm') {
      e.preventDefault();
      e.stopImmediatePropagation();
      await createAccountFromForm(e);
    }
    if (e.target?.id === 'goodMoralForm') {
      e.preventDefault();
      e.stopImmediatePropagation();
      await submitGoodMoral(e);
    }
    if (e.target?.id === 'incidentForm') {
      e.preventDefault();
      e.stopImmediatePropagation();
      await submitIncident(e);
    }
  }, true);

  // Correct session state before the app finishes booting.
  syncResponsiveState();
  refreshSessionState();

  // Expose overrides for existing UI handlers.
  Object.assign(window, {
    statusLabel,
    getSession,
    setSession,
    clearSession,
    resolveSession,
    setButtonBusy,
    openGoodMoralModal,
    openIncidentWizard,
    clearAccountEditMode,
    beginAccountEdit,
    deleteAccount,
    removeAccount,
    resetPassword,
    createAccountFromForm,
    printCertificateById,
    submitGoodMoral,
    submitIncident,
    setReviewResult
  });

  if (typeof currentUser !== 'undefined' && currentUser && !resolveSession({ username: currentUser.username })) {
    clearSession();
    currentUser = null;
    currentUser = null;
    setAppVisibility(false);
  }
})();


// ===== Enhancements: Firebase Auth bridge, settings page, and runtime cleanup =====
(function(){
  const SETTINGS_PAGE_ID = 'settingsPage';
  const SETTINGS_FORM_ID = 'settingsForm';
  const ADMIN_ROLE = 'admin';

  function defaultSettings(){
    const year = new Date().getFullYear();
    return {
      schoolName: '',
      schoolCenter: '',
      region: '',
      division: '',
      schoolAddress: '',
      schoolId: '',
      telephone: '',
      email: '',
      principalName: '',
      principalTitle: '',
      guidanceCounselor: '',
      guidanceCounselorTitle: '',
      academicYear: `${year} - ${year + 1}`,
      requestWaitDays: 2,
      certificateLocation: '',
      certificateDisclaimer: 'This certification is not official unless the school seal is affixed.'
    };
  }

  function ensureSettings(){
    const fallback = defaultSettings();
    if(typeof db === 'undefined') return fallback;
    if(!db.settings || typeof db.settings !== 'object'){
      db.settings = { ...fallback };
    }else{
      db.settings = { ...fallback, ...db.settings };
    }
    return db.settings;
  }

  function syncSettingsPreview(){
    const s = ensureSettings();
    const map = {
      settingsPreviewSchool: s.schoolName,
      settingsPreviewPrincipal: `${s.principalName} — ${s.principalTitle}`,
      settingsPreviewCounselor: `${s.guidanceCounselor} — ${s.guidanceCounselorTitle}`,
      settingsPreviewYear: s.academicYear,
      settingsPreviewWait: String(s.requestWaitDays ?? 2),
      settingsPreviewId: s.schoolId,
      settingsPreviewPhone: s.telephone,
      settingsPreviewEmail: s.email
    };
    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if(el) el.textContent = value || '—';
    });
  }

  function renderSettingsPage(){
    const s = ensureSettings();
    const ids = {
      settingSchoolName: s.schoolName,
      settingSchoolCenter: s.schoolCenter,
      settingRegion: s.region,
      settingDivision: s.division,
      settingAddress: s.schoolAddress,
      settingSchoolId: s.schoolId,
      settingTelephone: s.telephone,
      settingEmail: s.email,
      settingPrincipal: s.principalName,
      settingPrincipalTitle: s.principalTitle,
      settingCounselor: s.guidanceCounselor,
      settingCounselorTitle: s.guidanceCounselorTitle,
      settingAcademicYear: s.academicYear,
      settingWaitDays: String(s.requestWaitDays ?? 2),
      settingLocation: s.certificateLocation,
      settingDisclaimer: s.certificateDisclaimer
    };
    Object.entries(ids).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if(el && el.value !== value) el.value = value;
    });

    const liveInputs = ['settingSchoolName','settingSchoolCenter','settingRegion','settingDivision','settingAddress','settingSchoolId','settingTelephone','settingEmail','settingPrincipal','settingPrincipalTitle','settingCounselor','settingCounselorTitle','settingAcademicYear','settingWaitDays','settingLocation','settingDisclaimer'];
    liveInputs.forEach(id => {
      const el = document.getElementById(id);
      if(!el || el.dataset.settingsLiveBound === '1') return;
      el.dataset.settingsLiveBound = '1';
      el.addEventListener('input', syncSettingsPreview, { passive: true });
      el.addEventListener('change', syncSettingsPreview);
    });

    syncSettingsPreview();
  }

  function persistSettingsFromForm(form){
    const s = ensureSettings();
    const next = {
      schoolName: String(document.getElementById('settingSchoolName')?.value || '').trim(),
      schoolCenter: String(document.getElementById('settingSchoolCenter')?.value || '').trim(),
      region: String(document.getElementById('settingRegion')?.value || '').trim(),
      division: String(document.getElementById('settingDivision')?.value || '').trim(),
      schoolAddress: String(document.getElementById('settingAddress')?.value || '').trim(),
      schoolId: String(document.getElementById('settingSchoolId')?.value || '').trim(),
      telephone: String(document.getElementById('settingTelephone')?.value || '').trim(),
      email: String(document.getElementById('settingEmail')?.value || '').trim(),
      principalName: String(document.getElementById('settingPrincipal')?.value || '').trim(),
      principalTitle: String(document.getElementById('settingPrincipalTitle')?.value || '').trim(),
      guidanceCounselor: String(document.getElementById('settingCounselor')?.value || '').trim(),
      guidanceCounselorTitle: String(document.getElementById('settingCounselorTitle')?.value || '').trim(),
      academicYear: String(document.getElementById('settingAcademicYear')?.value || '').trim(),
      requestWaitDays: Math.max(0, Number(document.getElementById('settingWaitDays')?.value || 0)),
      certificateLocation: String(document.getElementById('settingLocation')?.value || '').trim(),
      certificateDisclaimer: String(document.getElementById('settingDisclaimer')?.value || '').trim()
    };

    if(!next.schoolName || !next.schoolCenter || !next.region || !next.division || !next.schoolAddress || !next.principalName || !next.principalTitle || !next.guidanceCounselor || !next.guidanceCounselorTitle){
      toast('Missing fields', 'Please complete all required school settings.', 'warning');
      return false;
    }

    db.settings = { ...s, ...next, updatedAt: new Date().toISOString(), updatedBy: currentUser?.username || '' };
    if(typeof addAudit === 'function'){
      addAudit('Settings updated', `${currentUser?.username || 'System'} changed school and certificate settings.`);
    }
    if(typeof saveDB === 'function') saveDB();
    if(typeof renderAll === 'function') renderAll();
    toast('Settings saved', 'School and certificate settings updated successfully.', 'success');
    return true;
  }

  function enhanceAuthVerify(){
    const original = window.verifyPassword;
    window.verifyPassword = async function(storedPassword, inputPassword){
      const email = String(window.__loginCandidateEmail || '').trim();
      if(email && window.firebase && typeof firebase.auth === 'function'){
        try{
          const auth = firebase.auth();
          await auth.signInWithEmailAndPassword(email, String(inputPassword || ''));
          return true;
        }catch(err){
          // fall back to local verification below
        }
      }
      if(typeof original === 'function'){
        return original(storedPassword, inputPassword);
      }
      const stored = String(storedPassword ?? '');
      if(stored.startsWith('sha256:') && window.crypto?.subtle?.digest){
        const bytes = new TextEncoder().encode(String(inputPassword ?? ''));
        const hash = await crypto.subtle.digest('SHA-256', bytes);
        const computed = 'sha256:' + Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        return stored === computed;
      }
      return stored === String(inputPassword ?? '');
    };
  }

  function loadAuthHelpers(){
    const loginForm = document.getElementById('loginForm');
    loginForm?.addEventListener('submit', () => {
      const username = String(document.getElementById('loginUsername')?.value || '').trim();
      const candidate = (typeof db !== 'undefined' && Array.isArray(db.users) ? db.users : []).find(u => u.active !== false && String(u.username || '').toLowerCase() === username.toLowerCase());
      window.__loginCandidateEmail = candidate?.email || '';
    }, true);

    const accountForm = document.getElementById('accountForm');
    accountForm?.addEventListener('submit', () => {
      const snapshot = {
        role: String(document.getElementById('accountRole')?.value || '').trim(),
        username: String(document.getElementById('accountUsername')?.value || '').trim(),
        password: String(document.getElementById('accountPassword')?.value || '').trim(),
        email: String(document.getElementById('accountEmail')?.value || '').trim(),
        name: String(document.getElementById('accountName')?.value || '').trim()
      };
      window.__pendingAuthProvision = snapshot;
      setTimeout(async () => {
        const payload = window.__pendingAuthProvision;
        window.__pendingAuthProvision = null;
        if(!payload || !payload.username) return;
        if(window.firebase && typeof firebase.functions === 'function'){
          try{
            const callable = firebase.functions().httpsCallable('upsertManagedAccount');
            await callable({
              ...payload,
              role: payload.role,
              displayName: payload.name,
              password: payload.password || undefined
            });
            toast('Cloud sync', `Firebase Auth profile synced for ${payload.username}.`, 'success');
          }catch(err){
            console.warn('Cloud account provisioning skipped:', err);
          }
        }
      }, 0);
    }, true);

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', async () => {
      window.__loginCandidateEmail = '';
      try{
        if(window.firebase && typeof firebase.auth === 'function'){
          await firebase.auth().signOut();
        }
      }catch(err){
        console.warn('Firebase sign-out skipped:', err);
      }
    }, true);

    const settingsForm = document.getElementById(SETTINGS_FORM_ID);
    settingsForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      persistSettingsFromForm(settingsForm);
    }, true);

    document.getElementById('settingsResetBtn')?.addEventListener('click', () => {
      db.settings = { ...defaultSettings(), updatedAt: new Date().toISOString(), updatedBy: currentUser?.username || '' };
      if(typeof addAudit === 'function'){
        addAudit('Settings reset', `${currentUser?.username || 'System'} reset the system settings to blanks.`);
      }
      renderSettingsPage();
      if(typeof saveDB === 'function') saveDB();
      toast('Reset', 'Settings cleared back to editable defaults.', 'info');
    });
  }

  function removeLoadingScreen(){
    const loading = document.getElementById('loadingScreen');
    if(loading) loading.remove();
  }

  function patchNav(){
    if(typeof navItems !== 'undefined' && Array.isArray(navItems.admin) && !navItems.admin.some(item => item.page === SETTINGS_PAGE_ID)){
      navItems.admin.push({ page: SETTINGS_PAGE_ID, label: 'Settings' });
    }
  }

  const originalRenderAll = window.renderAll;
  window.renderAll = function(){
    if(typeof originalRenderAll === 'function') originalRenderAll();
    renderSettingsPage();
  };

  const originalRefreshCurrent = window.refreshCurrent;
  window.refreshCurrent = function(){
    if(typeof originalRefreshCurrent === 'function') originalRefreshCurrent();
    renderSettingsPage();
  };

  const originalBuildNav = window.buildNav;
  window.buildNav = function(){
    patchNav();
    if(typeof originalBuildNav === 'function') originalBuildNav();
  };

  enhanceAuthVerify();
  loadAuthHelpers();
  removeLoadingScreen();
  patchNav();
  ensureSettings();
  renderSettingsPage();
  syncSettingsPreview();
})();

// ===== Visual refresh + school settings sync =====
(() => {
  if (typeof document === 'undefined') return;

  const STYLE_ID = 'gms-visual-refresh';
  const BRAND_TAG = 'data-gms-school-tag';

  function getSettings() {
    try {
      return (typeof db !== 'undefined' && db && typeof db.settings === 'object') ? db.settings : {};
    } catch {
      return {};
    }
  }

  function getSchoolLabel() {
    const s = getSettings();
    const label = String(s.schoolName || s.schoolCenter || s.schoolAddress || '').trim();
    return label || '';
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root{
        --gms-ink:#0f172a;
        --gms-muted:#5b6476;
        --gms-line:rgba(15,23,42,.10);
        --gms-line-strong:rgba(37,99,235,.16);
        --gms-surface:rgba(255,255,255,.82);
        --gms-surface-strong:rgba(255,255,255,.94);
        --gms-shadow:0 18px 48px rgba(2,6,23,.12);
        --gms-shadow-strong:0 28px 72px rgba(2,6,23,.18);
        --gms-radius:24px;
        --gms-radius-sm:18px;
      }

      html{scroll-behavior:smooth}
      body.gms-visual-refresh{
        color: var(--gms-ink);
        background:
          radial-gradient(circle at 9% 16%, rgba(37,99,235,.16), transparent 22%),
          radial-gradient(circle at 91% 8%, rgba(14,165,233,.14), transparent 18%),
          radial-gradient(circle at 60% 92%, rgba(16,185,129,.10), transparent 22%),
          linear-gradient(180deg, #f5f8ff 0%, #eef3ff 44%, #f8fbff 100%);
        overflow-x: hidden;
      }

      body.gms-visual-refresh::before,
      body.gms-visual-refresh::after{
        content:'';
        position: fixed;
        inset: auto;
        width: 24rem;
        height: 24rem;
        border-radius: 50%;
        pointer-events: none;
        filter: blur(18px);
        opacity: .32;
        z-index: 0;
        animation: gmsFloatBlob 20s ease-in-out infinite;
      }
      body.gms-visual-refresh::before{
        top: -8rem;
        left: -6rem;
        background: radial-gradient(circle, rgba(37,99,235,.34), rgba(37,99,235,0) 68%);
      }
      body.gms-visual-refresh::after{
        right: -8rem;
        bottom: -10rem;
        background: radial-gradient(circle, rgba(14,165,233,.24), rgba(14,165,233,0) 68%);
        animation-duration: 24s;
        animation-direction: reverse;
      }

      @keyframes gmsFloatBlob{
        0%,100%{transform: translate3d(0,0,0) scale(1)}
        50%{transform: translate3d(2rem, -1rem, 0) scale(1.05)}
      }

      body.gms-visual-refresh > *{
        position: relative;
        z-index: 1;
      }

      /* Login */
      body.gms-visual-refresh #loginView{
        min-height: 100vh;
        padding: 1rem;
      }
      body.gms-visual-refresh .login-card{
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.28);
        border-radius: 30px;
        background: rgba(255,255,255,.70);
        backdrop-filter: blur(18px) saturate(160%);
        box-shadow: var(--gms-shadow-strong);
      }
      body.gms-visual-refresh .login-left{
        background:
          linear-gradient(180deg, rgba(12,28,52,.96), rgba(17,24,39,.90)),
          radial-gradient(circle at top right, rgba(59,130,246,.24), transparent 36%);
        color: #fff;
        padding: 2rem !important;
      }
      body.gms-visual-refresh .login-right{
        padding: 2rem !important;
        background: linear-gradient(180deg, rgba(255,255,255,.94), rgba(248,251,255,.88));
      }
      body.gms-visual-refresh .login-left .chip{
        background: rgba(255,255,255,.12);
        color: rgba(255,255,255,.92);
        border: 1px solid rgba(255,255,255,.14);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
      }
      body.gms-visual-refresh .login-left h1{
        letter-spacing: -.03em;
        font-size: clamp(2rem, 3vw, 3rem);
      }
      body.gms-visual-refresh .hero{
        border: 1px solid rgba(255,255,255,.18);
        background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.05));
        box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
        border-radius: 24px;
        padding: 1.25rem;
      }
      body.gms-visual-refresh .timeline{
        display: grid;
        gap: .85rem;
      }
      body.gms-visual-refresh .timeline-item{
        background: rgba(255,255,255,.08);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 18px;
        padding: .9rem 1rem;
      }
      body.gms-visual-refresh .timeline-item strong{display:block; margin-bottom: .15rem}
      body.gms-visual-refresh .timeline-item .small{color: rgba(255,255,255,.74) !important}
      body.gms-visual-refresh .small-stack span{
        display:block;
        padding: .75rem .9rem;
        margin-bottom: .65rem;
        border-radius: 16px;
        background: rgba(255,255,255,.08);
        border: 1px solid rgba(255,255,255,.10);
      }

      /* App shell */
      body.gms-visual-refresh .shell{
        position: relative;
        z-index: 1;
      }
      body.gms-visual-refresh .navbar{
        position: sticky;
        top: 0;
        z-index: 1035;
        margin: 0 0 1rem;
        padding-block: .75rem;
        background: linear-gradient(135deg, rgba(8,15,30,.94), rgba(13,25,45,.90));
        border-bottom: 1px solid rgba(255,255,255,.10);
        box-shadow: 0 18px 40px rgba(2,6,23,.18);
        backdrop-filter: blur(18px) saturate(160%);
      }
      body.gms-visual-refresh .navbar .navbar-brand{
        display: inline-flex;
        align-items: center;
        gap: .6rem;
        letter-spacing: .01em;
        white-space: nowrap;
      }
      body.gms-visual-refresh .navbar .navbar-brand i{
        filter: drop-shadow(0 8px 18px rgba(37,99,235,.22));
      }
      body.gms-visual-refresh .brand-school{
        display: inline-flex;
        align-items: center;
        max-width: 24rem;
        padding: .38rem .75rem;
        border-radius: 999px;
        font-size: .75rem;
        line-height: 1.15;
        font-weight: 700;
        color: rgba(255,255,255,.92);
        background: rgba(255,255,255,.10);
        border: 1px solid rgba(255,255,255,.10);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      body.gms-visual-refresh #navList .nav-link{
        margin-right: .35rem;
        padding: .6rem .95rem !important;
        border-radius: 999px;
        color: rgba(255,255,255,.82) !important;
        transition: transform .18s ease, background-color .18s ease, color .18s ease, box-shadow .18s ease;
      }
      body.gms-visual-refresh #navList .nav-link:hover{
        transform: translateY(-1px);
        color: #fff !important;
        background: rgba(255,255,255,.12);
      }
      body.gms-visual-refresh #navList .nav-link.active{
        color: #0f172a !important;
        background: linear-gradient(135deg, #ffffff, #dbeafe);
        box-shadow: 0 12px 30px rgba(255,255,255,.12);
      }

      body.gms-visual-refresh main.container{
        max-width: 1400px;
      }

      body.gms-visual-refresh .page{
        will-change: transform, opacity;
      }
      body.gms-visual-refresh .page.hidden{
        display: none !important;
      }
      body.gms-visual-refresh .page:not(.hidden),
      body.gms-visual-refresh .page.page-enter{
        animation: gmsPageEnter .38s ease both;
      }
      @keyframes gmsPageEnter{
        from{ opacity: 0; transform: translateY(14px) scale(.99); }
        to{ opacity: 1; transform: translateY(0) scale(1); }
      }

      body.gms-visual-refresh .page-card,
      body.gms-visual-refresh .panel,
      body.gms-visual-refresh .metric,
      body.gms-visual-refresh .glass,
      body.gms-visual-refresh .modal-content{
        border: 1px solid rgba(255,255,255,.58);
        background: var(--gms-surface);
        backdrop-filter: blur(16px) saturate(160%);
        border-radius: var(--gms-radius);
        box-shadow: var(--gms-shadow);
      }

      body.gms-visual-refresh .page-card,
      body.gms-visual-refresh .panel{
        overflow: hidden;
      }
      body.gms-visual-refresh .page-head{
        padding: 1rem 1.2rem;
        border-bottom: 1px solid var(--gms-line);
        background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(248,251,255,.82));
      }
      body.gms-visual-refresh .page-body{
        padding: 1.25rem;
      }
      body.gms-visual-refresh .section-title h5{
        margin: 0;
        font-size: 1.02rem;
        font-weight: 800;
        letter-spacing: -.015em;
      }
      body.gms-visual-refresh .mini-help{
        color: var(--gms-muted);
        font-size: .88rem;
        line-height: 1.45;
      }

      body.gms-visual-refresh .hero{
        position: relative;
        overflow: hidden;
      }
      body.gms-visual-refresh .hero::after{
        content:'';
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 84% 16%, rgba(255,255,255,.16), transparent 22%),
          radial-gradient(circle at 20% 90%, rgba(255,255,255,.08), transparent 20%);
        pointer-events: none;
      }

      body.gms-visual-refresh .chip{
        display: inline-flex;
        align-items: center;
        gap: .45rem;
        padding: .42rem .78rem;
        border-radius: 999px;
        font-weight: 700;
        background: rgba(37,99,235,.10);
        border: 1px solid rgba(37,99,235,.12);
        color: #1d4ed8;
      }
      body.gms-visual-refresh .glass{
        overflow: hidden;
      }

      body.gms-visual-refresh .btn,
      body.gms-visual-refresh .form-control,
      body.gms-visual-refresh .form-select,
      body.gms-visual-refresh .input-group-text,
      body.gms-visual-refresh .dropdown-menu,
      body.gms-visual-refresh .alert,
      body.gms-visual-refresh .badge,
      body.gms-visual-refresh .toast,
      body.gms-visual-refresh .table,
      body.gms-visual-refresh .modal-content{
        border-radius: 18px;
      }
      body.gms-visual-refresh .btn{
        min-height: 46px;
        border-width: 0;
        transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease, background-color .18s ease;
      }
      body.gms-visual-refresh .btn:hover{
        transform: translateY(-1px);
      }
      body.gms-visual-refresh .btn:active{
        transform: translateY(0);
      }
      body.gms-visual-refresh .btn-primary{
        background: linear-gradient(135deg, #2563eb, #0ea5e9);
        box-shadow: 0 12px 24px rgba(37,99,235,.18);
      }
      body.gms-visual-refresh .btn-success{
        background: linear-gradient(135deg, #16a34a, #14b8a6);
      }
      body.gms-visual-refresh .btn-outline-light{
        border-color: rgba(255,255,255,.22);
      }
      body.gms-visual-refresh .soft-btn{
        background: rgba(255,255,255,.82);
        border: 1px solid rgba(15,23,42,.08) !important;
        box-shadow: 0 10px 24px rgba(2,6,23,.06);
      }
      body.gms-visual-refresh .soft-btn:hover{
        background: rgba(255,255,255,.98);
      }

      body.gms-visual-refresh .form-control,
      body.gms-visual-refresh .form-select{
        min-height: 48px;
        padding: .8rem 1rem;
        border: 1px solid rgba(15,23,42,.10);
        background: rgba(255,255,255,.96);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.55);
      }
      body.gms-visual-refresh .form-control:focus,
      body.gms-visual-refresh .form-select:focus{
        border-color: rgba(37,99,235,.42);
        box-shadow: 0 0 0 .22rem rgba(37,99,235,.12);
      }
      body.gms-visual-refresh .form-label{
        font-weight: 700;
        color: #0f172a;
        margin-bottom: .45rem;
      }
      body.gms-visual-refresh .input-group-text{
        background: rgba(248,250,252,.96);
        border: 1px solid rgba(15,23,42,.10);
      }

      body.gms-visual-refresh .table{
        overflow: hidden;
        background: var(--gms-surface-strong);
      }
      body.gms-visual-refresh .table thead th{
        position: sticky;
        top: 0;
        z-index: 1;
        background: linear-gradient(180deg, rgba(15,23,42,.04), rgba(15,23,42,.02));
        color: #0f172a;
        border-bottom-color: rgba(15,23,42,.08);
      }
      body.gms-visual-refresh .table tbody tr{
        transition: background-color .16s ease, transform .16s ease;
      }
      body.gms-visual-refresh .table tbody tr:hover{
        background: rgba(37,99,235,.03);
      }

      body.gms-visual-refresh .metric{
        padding: 1rem;
        transition: transform .18s ease, box-shadow .18s ease;
      }
      body.gms-visual-refresh .metric:hover{
        transform: translateY(-2px);
        box-shadow: var(--gms-shadow-strong);
      }

      body.gms-visual-refresh .setting-preview{
        padding: 1rem;
        border-radius: 20px;
        background: linear-gradient(180deg, rgba(37,99,235,.07), rgba(14,165,233,.04));
        border: 1px solid rgba(37,99,235,.12);
      }
      body.gms-visual-refresh .setting-preview > div{
        display: flex;
        justify-content: space-between;
        gap: .75rem;
        padding: .55rem 0;
        border-bottom: 1px dashed rgba(15,23,42,.08);
      }
      body.gms-visual-refresh .setting-preview > div:last-child{
        border-bottom: 0;
      }
      body.gms-visual-refresh .setting-preview strong{
        color: #0f172a;
        min-width: 7rem;
      }

      body.gms-visual-refresh #settingsPage .page-body{
        padding: 1.4rem;
      }
      body.gms-visual-refresh #settingsPage .panel{
        background: rgba(255,255,255,.92);
      }

      body.gms-visual-refresh .certificate-card{
        box-shadow: 0 24px 74px rgba(2,6,23,.16);
      }

      body.gms-visual-refresh .modal-backdrop.show{
        opacity: .55;
      }
      body.gms-visual-refresh .modal-content{
        overflow: hidden;
      }

      body.gms-visual-refresh .navbar-toggler{
        border-color: rgba(255,255,255,.18);
      }

      body.gms-visual-refresh .toast-container,
      body.gms-visual-refresh .toast{
        z-index: 2000;
      }

      body.gms-visual-refresh .page-card,
      body.gms-visual-refresh .panel,
      body.gms-visual-refresh .metric,
      body.gms-visual-refresh .glass{
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
      }
      body.gms-visual-refresh .page-card:hover,
      body.gms-visual-refresh .panel:hover,
      body.gms-visual-refresh .glass:hover{
        box-shadow: var(--gms-shadow-strong);
      }

      @media (max-width: 991.98px){
        body.gms-visual-refresh .navbar .brand-school{
          display: none;
        }
        body.gms-visual-refresh .login-left,
        body.gms-visual-refresh .login-right{
          padding: 1.35rem !important;
        }
        body.gms-visual-refresh .page-body{
          padding: 1rem;
        }
      }

      @media (max-width: 767.98px){
        body.gms-visual-refresh #loginView{
          padding: .65rem;
        }
        body.gms-visual-refresh .page-head{
          padding: .9rem 1rem;
        }
        body.gms-visual-refresh .page-body{
          padding: .9rem;
        }
        body.gms-visual-refresh .btn{
          width: 100%;
        }
        body.gms-visual-refresh .setting-preview > div{
          flex-direction: column;
          align-items: flex-start;
        }
      }

      @media (prefers-reduced-motion: reduce){
        body.gms-visual-refresh::before,
        body.gms-visual-refresh::after,
        body.gms-visual-refresh .page,
        body.gms-visual-refresh .btn,
        body.gms-visual-refresh .panel,
        body.gms-visual-refresh .page-card,
        body.gms-visual-refresh .metric,
        body.gms-visual-refresh .glass{
          animation: none !important;
          transition-duration: .01ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function syncBranding() {
    const schoolLabel = getSchoolLabel();
    document.title = schoolLabel ? `${schoolLabel} • Guidance Management System` : 'Guidance Management System';

    const brand = document.querySelector('#appView .navbar-brand');
    if (brand) {
      let tag = brand.querySelector(`[${BRAND_TAG}]`);
      if (!tag) {
        tag = document.createElement('span');
        tag.setAttribute(BRAND_TAG, '1');
        tag.className = 'brand-school';
        brand.appendChild(tag);
      }
      tag.textContent = schoolLabel || 'School Portal';
      brand.title = schoolLabel ? `${schoolLabel} | Guidance Management System` : 'Guidance Management System';
    }

    const loginTitle = document.querySelector('#loginView h1');
    if (loginTitle) {
      loginTitle.textContent = 'Guidance Management System';
      let subtitle = document.querySelector('#loginView [data-gms-school-subtitle]');
      if (!subtitle && schoolLabel) {
        subtitle = document.createElement('div');
        subtitle.dataset.gmsSchoolSubtitle = '1';
        subtitle.className = 'mt-2 px-3 py-2 rounded-pill d-inline-flex align-items-center gap-2';
        subtitle.style.cssText = 'background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.90);font-size:.82rem;font-weight:700;max-width:100%;';
        loginTitle.insertAdjacentElement('afterend', subtitle);
      }
      if (subtitle) {
        subtitle.textContent = schoolLabel || 'School settings will appear here after you save them.';
      }
    }

    const chip = document.querySelector('#loginView .login-left .chip');
    if (chip) {
      const prefix = 'Guidance Management System';
      chip.textContent = schoolLabel ? `${prefix} • ${schoolLabel}` : prefix;
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-qrcode';
      chip.prepend(icon);
    }
  }

  function refreshSettingsSummary() {
    const s = getSettings();
    const map = [
      ['settingsPreviewSchool', s.schoolName || '—'],
      ['settingsPreviewCounselor', s.guidanceCounselor ? `${s.guidanceCounselor}${s.guidanceCounselorTitle ? ' — ' + s.guidanceCounselorTitle : ''}` : '—'],
      ['settingsPreviewYear', s.academicYear || '—'],
      ['settingsPreviewWait', String(s.requestWaitDays ?? 2)],
      ['settingsPreviewId', s.schoolId || '—'],
      ['settingsPreviewPhone', s.telephone || '—'],
      ['settingsPreviewEmail', s.email || '—']
    ];
    map.forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  }

  function enhanceSettingsPage() {
    const form = document.getElementById('settingsForm');
    if (!form) return;

    form.dataset.gmsEnhanced = '1';

    const fields = [
      'settingSchoolName','settingSchoolCenter','settingRegion','settingDivision','settingAddress',
      'settingSchoolId','settingTelephone','settingEmail','settingPrincipal','settingPrincipalTitle',
      'settingCounselor','settingCounselorTitle','settingAcademicYear','settingWaitDays','settingLocation',
      'settingDisclaimer'
    ];

    fields.forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.gmsBound === '1') return;
      el.dataset.gmsBound = '1';
      el.addEventListener('input', () => {
        refreshSettingsSummary();
        syncBranding();
      });
      el.addEventListener('change', () => {
        refreshSettingsSummary();
        syncBranding();
      });
    });

    const wait = document.getElementById('settingWaitDays');
    if (wait) {
      wait.min = '0';
      wait.max = '30';
      wait.step = '1';
      wait.placeholder = wait.placeholder || '2';
    }

    const schoolId = document.getElementById('settingSchoolId');
    if (schoolId) {
      schoolId.inputMode = 'numeric';
      schoolId.placeholder = schoolId.placeholder || 'School ID';
    }

    refreshSettingsSummary();
    syncBranding();
  }

  function wrapFunction(name, handler) {
    const original = window[name];
    if (typeof original !== 'function' || original.__gmsWrapped) return;
    const wrapped = function (...args) {
      return handler.call(this, original, args);
    };
    wrapped.__gmsWrapped = true;
    window[name] = wrapped;
  }

  function animateCurrentPage(pageId) {
    const page = document.getElementById(pageId);
    if (!page) return;
    page.classList.remove('page-enter');
    void page.offsetWidth;
    page.classList.add('page-enter');
    window.setTimeout(() => page.classList.remove('page-enter'), 420);
  }

  injectStyles();
  document.body.classList.add('gms-visual-refresh');

  wrapFunction('renderAll', function (original, args) {
    const out = original.apply(this, args);
    enhanceSettingsPage();
    syncBranding();
    return out;
  });

  wrapFunction('refreshCurrent', function (original, args) {
    const out = original.apply(this, args);
    enhanceSettingsPage();
    syncBranding();
    return out;
  });

  wrapFunction('saveDB', function (original, args) {
    const out = original.apply(this, args);
    syncBranding();
    refreshSettingsSummary();
    return out;
  });

  wrapFunction('showPage', function (original, args) {
    const out = original.apply(this, args);
    animateCurrentPage(args[0]);
    return out;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      enhanceSettingsPage();
      syncBranding();
    }, { once: true });
  } else {
    enhanceSettingsPage();
    syncBranding();
  }

  window.addEventListener('load', () => {
    enhanceSettingsPage();
    syncBranding();
  }, { once: true });

  window.addEventListener('hashchange', () => {
    syncBranding();
  });

})();


(() => {
  const style = document.createElement('style');
  style.id = 'gms-refresh-style';
  style.textContent = `
    :root {
      --primary: #7c3aed;
      --primary2: #14b8a6;
      --bg1: #08111f;
      --bg2: #0f172a;
      --bg3: #111827;
    }

    body {
      background:
        radial-gradient(circle at top left, rgba(124, 58, 237, .20), transparent 28%),
        radial-gradient(circle at top right, rgba(20, 184, 166, .16), transparent 26%),
        radial-gradient(circle at bottom center, rgba(255, 255, 255, .42), transparent 34%),
        linear-gradient(180deg, #f7f5ff 0%, #eef6ff 46%, #e8ecff 100%) !important;
    }

    .navbar {
      background: linear-gradient(135deg, #090d1a 0%, #24104a 48%, #0f766e 100%) !important;
      border-bottom: 1px solid rgba(148, 163, 184, .20);
    }

    .btn-primary,
    .badge-primary-soft,
    .soft-btn.btn-primary,
    .soft-btn.btn-outline-primary:hover,
    .soft-btn.btn-outline-primary:focus {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary2) 100%) !important;
      border-color: transparent !important;
      color: #fff !important;
    }

    .login-left {
      background:
        radial-gradient(circle at 24% 20%, rgba(255,255,255,.24), transparent 18%),
        radial-gradient(circle at 72% 18%, rgba(255,255,255,.12), transparent 22%),
        radial-gradient(circle at 55% 62%, rgba(96, 165, 250, .12), transparent 26%),
        linear-gradient(145deg, #120a2a 0%, #34135d 42%, #08111f 100%) !important;
      perspective: 1400px;
      transform-style: preserve-3d;
    }

    .login-left > *:not(.login-cosmos) {
      position: relative;
      z-index: 2;
    }

    .login-cosmos {
      position: absolute;
      inset: 0;
      overflow: hidden;
      z-index: 1;
      pointer-events: none;
      transform-style: preserve-3d;
    }

    .login-starfield,
    .login-starfield::before,
    .login-starfield::after {
      position: absolute;
      inset: 0;
      content: '';
      background-repeat: repeat;
      opacity: .95;
    }

    .login-starfield {
      background-image:
        radial-gradient(circle, rgba(255,255,255,.95) 0 1px, transparent 1.6px),
        radial-gradient(circle, rgba(255,255,255,.72) 0 1px, transparent 1.6px),
        radial-gradient(circle, rgba(129,140,248,.85) 0 1px, transparent 1.6px);
      background-size: 64px 64px, 96px 96px, 128px 128px;
      animation: gmsStarDrift 22s linear infinite;
      opacity: .55;
    }

    .login-starfield::before {
      background-image:
        radial-gradient(circle, rgba(255,255,255,.75) 0 1.4px, transparent 1.8px),
        radial-gradient(circle, rgba(99,102,241,.95) 0 1.2px, transparent 1.8px);
      background-size: 88px 88px, 140px 140px;
      animation: gmsStarDrift 40s linear reverse infinite;
      opacity: .35;
      mix-blend-mode: screen;
    }

    .login-starfield::after {
      background-image:
        radial-gradient(circle at 20% 30%, rgba(168, 85, 247, .45), transparent 16%),
        radial-gradient(circle at 70% 25%, rgba(45, 212, 191, .35), transparent 14%),
        radial-gradient(circle at 50% 70%, rgba(96, 165, 250, .36), transparent 18%);
      animation: gmsNebula 16s ease-in-out infinite alternate;
      opacity: .85;
      mix-blend-mode: screen;
    }

    .login-orbit {
      position: absolute;
      left: 50%;
      top: 50%;
      border: 1px solid rgba(255,255,255,.15);
      border-radius: 50%;
      transform-style: preserve-3d;
      box-shadow: inset 0 0 30px rgba(255,255,255,.05);
    }

    .login-orbit-a {
      width: 380px;
      height: 380px;
      margin-left: -190px;
      margin-top: -190px;
      border-color: rgba(255,255,255,.16);
      animation: gmsOrbitA 18s linear infinite;
    }

    .login-orbit-b {
      width: 280px;
      height: 280px;
      margin-left: -140px;
      margin-top: -140px;
      border-color: rgba(45,212,191,.18);
      transform: rotateX(68deg) rotateZ(18deg);
      animation: gmsOrbitB 13s linear infinite reverse;
    }

    .login-orbit-c {
      width: 190px;
      height: 190px;
      margin-left: -95px;
      margin-top: -95px;
      border-color: rgba(96,165,250,.20);
      transform: rotateY(72deg) rotateZ(9deg);
      animation: gmsOrbitC 9s linear infinite;
    }

    .login-shield-wrap {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) translateZ(60px) rotateX(12deg) rotateY(-10deg);
      width: 182px;
      height: 182px;
      display: grid;
      place-items: center;
      animation: gmsShieldFloat 6.5s ease-in-out infinite;
    }

    .login-shield-wrap::before,
    .login-shield-wrap::after {
      content: '';
      position: absolute;
      inset: 50% auto auto 50%;
      border-radius: 50%;
      transform: translate(-50%, -50%);
    }

    .login-shield-wrap::before {
      width: 238px;
      height: 238px;
      background: radial-gradient(circle, rgba(255,255,255,.22), transparent 70%);
      filter: blur(6px);
      animation: gmsGlow 4.8s ease-in-out infinite alternate;
    }

    .login-shield-wrap::after {
      width: 150px;
      height: 150px;
      border: 1px solid rgba(255,255,255,.18);
      box-shadow: 0 0 40px rgba(124,58,237,.22), inset 0 0 25px rgba(255,255,255,.05);
    }

    .login-shield-core {
      position: relative;
      width: 116px;
      height: 116px;
      display: grid;
      place-items: center;
      border-radius: 28px;
      color: #fff;
      font-size: 3rem;
      background: linear-gradient(145deg, rgba(255,255,255,.22), rgba(255,255,255,.06));
      border: 1px solid rgba(255,255,255,.20);
      backdrop-filter: blur(8px);
      box-shadow:
        0 18px 60px rgba(15, 23, 42, .35),
        inset 0 1px 0 rgba(255,255,255,.22),
        inset 0 -14px 26px rgba(2, 6, 23, .20);
      transform: translateZ(80px);
      animation: gmsShieldSpin 12s linear infinite;
    }

    .login-shield-core::before {
      content: '';
      position: absolute;
      inset: 11px;
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,0));
      opacity: .55;
    }

    .login-shield-core i {
      position: relative;
      z-index: 1;
      filter: drop-shadow(0 10px 18px rgba(2, 6, 23, .35));
    }

    .gm-cert-paper {
      background:
        radial-gradient(circle at top center, rgba(255,255,255,.98), #fff 58%);
      border: 0 !important;
      box-shadow: none !important;
    }

    .gm-cert-inner {
      padding: 14.5mm 11.2mm 0.4mm 11.2mm !important;
    }

    .gm-cert-meta {
      font-size: 8.8pt !important;
      letter-spacing: .03em !important;
    }

    .gm-cert-meta-right {
      white-space: nowrap;
      font-size: 12pt !important;
      color: #111827;
    }

    .gm-cert-header-stack {
      display: grid;
      justify-items: center;
      text-align: center;
      margin-top: 1mm;
    }

    .gm-cert-seal {
      width: 26mm;
      height: auto;
      display: block;
      margin: 0 auto 2.5mm;
      filter: drop-shadow(0 3px 10px rgba(15,23,42,.08));
    }

    .gm-cert-kicker {
      font-size: 11pt !important;
      letter-spacing: .01em !important;
      text-transform: none !important;
      font-family: 'Times New Roman', Times, serif !important;
      color: #1f2937;
    }

    .gm-cert-deped {
      font-size: 23px !important;
      line-height: 1.02 !important;
      font-weight: 700 !important;
      font-family: 'Times New Roman', Times, serif !important;
      letter-spacing: 0 !important;
      margin-top: .5mm !important;
    }

    .gm-cert-region,
    .gm-cert-division,
    .gm-cert-school,
    .gm-cert-center {
      font-family: 'Times New Roman', Times, serif !important;
      text-transform: uppercase !important;
      letter-spacing: .02em !important;
    }

    .gm-cert-region {
      font-size: 12pt !important;
      margin-top: .25mm !important;
    }

    .gm-cert-division {
      font-size: 11.3pt !important;
      margin-top: .35mm !important;
      line-height: 1.12;
    }

    .gm-cert-school {
      font-size: 14.5pt !important;
      margin-top: .35mm !important;
      font-weight: 700 !important;
      line-height: 1.08;
    }

    .gm-cert-center {
      font-size: 13pt !important;
      margin-top: .3mm !important;
      letter-spacing: .02em !important;
      font-weight: 700 !important;
    }

    .gm-cert-rule {
      border-top: 1.8pt solid #111827 !important;
      margin: 4.6mm 0 8.9mm !important;
    }

    .gm-cert-title-wrap {
      margin-bottom: 5.6mm !important;
    }

    .gm-cert-title {
      font-size: 27pt !important;
      letter-spacing: .46em !important;
      font-family: Arial, Helvetica, sans-serif !important;
      font-weight: 700 !important;
    }

    .gm-cert-subtitle {
      display: none !important;
    }

    .gm-cert-body {
      font-size: 13pt !important;
      line-height: 1.86 !important;
      padding: 0 !important;
      min-height: 127mm;
    }

    .gm-cert-body p {
      margin-bottom: 6.1mm !important;
    }

    .gm-cert-body p.gm-cert-intro {
      text-indent: 0 !important;
    }

    .gm-cert-body p.gm-cert-centerline {
      max-width: none !important;
      line-height: 1.8 !important;
    }

    .gm-cert-issue {
      margin-top: 3.2mm !important;
      text-align: center !important;
    }

    .gm-cert-signature {
      justify-self: end;
      width: min(78mm, 100%);
      margin-top: 5.2mm !important;
      margin-bottom: 3.8mm !important;
      padding-bottom: 0 !important;
      text-align: center;
    }

    .gm-cert-sign-line {
      margin: 0 9mm 8px !important;
      border-top-width: 1.2px !important;
    }

    .gm-cert-sign-name {
      font-size: 13pt !important;
      line-height: 1.16 !important;
    }

    .gm-cert-sign-role {
      font-size: 9.2pt !important;
      margin-top: 1mm !important;
    }

    .gm-cert-footer-note {
      margin-top: 0.6mm !important;
      font-size: 10pt !important;
      font-style: italic !important;
    }

    .gm-cert-footer {
      margin: 1.4mm -11.2mm 0 !important;
      width: calc(100% + 22.4mm) !important;
    }

    .gm-cert-footer img {
      width: 100% !important;
      display: block !important;
      height: auto !important;
    }

    .gm-cert-verify {
      display: none !important;
    }

    .gm-cert-bottom {
      display: none !important;
    }

    @keyframes gmsStarDrift {
      from { transform: translate3d(0, 0, 0); }
      to { transform: translate3d(-40px, 24px, 0); }
    }

    @keyframes gmsNebula {
      from { transform: scale(1) rotate(0deg); opacity: .55; }
      to { transform: scale(1.18) rotate(14deg); opacity: .9; }
    }

    @keyframes gmsOrbitA {
      from { transform: translateZ(0) rotateX(72deg) rotateZ(0deg); }
      to { transform: translateZ(0) rotateX(72deg) rotateZ(360deg); }
    }

    @keyframes gmsOrbitB {
      from { transform: rotateX(68deg) rotateZ(18deg) rotateY(0deg); }
      to { transform: rotateX(68deg) rotateZ(18deg) rotateY(360deg); }
    }

    @keyframes gmsOrbitC {
      from { transform: rotateY(72deg) rotateZ(9deg); }
      to { transform: rotateY(72deg) rotateZ(369deg); }
    }

    @keyframes gmsShieldFloat {
      0%, 100% { transform: translate(-50%, -50%) translateZ(60px) rotateX(12deg) rotateY(-10deg) translateY(0); }
      50% { transform: translate(-50%, -50%) translateZ(60px) rotateX(12deg) rotateY(-10deg) translateY(-12px); }
    }

    @keyframes gmsShieldSpin {
      from { transform: translateZ(80px) rotateY(0deg) rotateZ(0deg); }
      to { transform: translateZ(80px) rotateY(360deg) rotateZ(360deg); }
    }

    @keyframes gmsGlow {
      from { opacity: .45; transform: translate(-50%, -50%) scale(.92); }
      to { opacity: .95; transform: translate(-50%, -50%) scale(1.08); }
    }

    @media (max-width: 991.98px) {
      .login-shield-wrap {
        width: 160px;
        height: 160px;
      }

      .login-orbit-a { width: 320px; height: 320px; margin-left: -160px; margin-top: -160px; }
      .login-orbit-b { width: 240px; height: 240px; margin-left: -120px; margin-top: -120px; }
      .login-orbit-c { width: 170px; height: 170px; margin-left: -85px; margin-top: -85px; }
    }

    @media print {
      .gm-cert-footer {
        margin-inline: -11.2mm !important;
      }
    }
  `;
  document.head.appendChild(style);

  function injectLoginCosmos() {
    const left = document.querySelector('.login-left');
    if (!left || left.querySelector('.login-cosmos')) return;
    const cosmos = document.createElement('div');
    cosmos.className = 'login-cosmos';
    cosmos.setAttribute('aria-hidden', 'true');
    cosmos.innerHTML = `
      <div class="login-starfield"></div>
      <div class="login-orbit login-orbit-a"></div>
      <div class="login-orbit login-orbit-b"></div>
      <div class="login-orbit login-orbit-c"></div>
      <div class="login-shield-wrap">
        <div class="login-shield-core"><i class="fa-solid fa-shield-halved"></i></div>
      </div>
    `;
    left.prepend(cosmos);
  }

  function syncAccountActionLabels() {
    document.querySelectorAll('[data-reset-password]').forEach(btn => {
      btn.innerHTML = '<i class="fa-solid fa-key me-1"></i>Change password';
      btn.setAttribute('aria-label', 'Change password');
    });
    const help = document.querySelector('#accountsPage .mini-help');
    if (help) {
      help.textContent = 'Admin creates student, teacher, counselor, and principal accounts, changes passwords, and searches records by name or LRN.';
    }
  }

  function getSafeSettings() {
    return (typeof db !== 'undefined' && db && db.settings) ? db.settings : {};
  }

  window.buildCertificate = function(item) {
    const student = (db?.students || []).find(s => String(s.lrn || '') === String(item?.lrn || '')) || {};
    const settings = getSafeSettings();
    const year = new Date().getFullYear();
    const track = String(item?.track || student.track || 'ACADEMIC').trim();
    const strand = String(item?.strand || student.strand || 'STEM').trim();
    const schoolYear = String(item?.schoolYear || student.schoolYear || `${year} - ${year + 1}`).trim();
    const issueDate = typeof formatDate === 'function'
      ? formatDate(item?.readyAt || item?.createdAt)
      : new Date(item?.readyAt || item?.createdAt || Date.now()).toLocaleDateString();
    const approver = String(item?.approvedByName || settings.guidanceCounselor || 'Guidance Counselor').trim();
    const approverRole = String(item?.approvedByRole || settings.guidanceCounselorTitle || 'Guidance Counselor').trim();
    const schoolName = String(settings.schoolName || 'CAPAS SENIOR HIGH SCHOOL').trim();
    const schoolCenter = String(settings.schoolCenter || 'CARE CENTER').trim();
    const region = String(settings.region || 'REGION III – CENTRAL LUZON').trim();
    const division = String(settings.division || 'SCHOOLS DIVISION OFFICE OF TARLAC PROVINCE').trim();
    const schoolAddress = String(settings.schoolAddress || 'San Nicolas, Sto. Domingo I, Capas, Tarlac').trim();
    const certificateLocation = String(settings.certificateLocation || schoolAddress).trim();
    const purpose = String(item?.purpose || 'SCHOLARSHIP GRANT').trim().toUpperCase();
    const studentName = String(item?.studentName || student.name || '________________').trim();
    const lrn = String(item?.lrn || student.lrn || '________________').trim();
    const section = String(item?.section || student.section || '________________').trim();

    return `
      <div class="gm-cert-paper">
        <div class="gm-cert-inner">
          <div class="gm-cert-meta">
            <div></div>
            <div class="gm-cert-meta-right">Form No. GDO - 012</div>
          </div>

          <div class="gm-cert-header-stack">
            <img src="assets/deped_seal.png" alt="DepEd seal" class="gm-cert-seal">
            <div class="gm-cert-heading">
              <div class="gm-cert-kicker">Republic of the Philippines</div>
              <div class="gm-cert-deped">Department of Education</div>
              <div class="gm-cert-region">${escapeHtml(region)}</div>
              <div class="gm-cert-division">${escapeHtml(division)}</div>
              <div class="gm-cert-school">${escapeHtml(schoolName)}</div>
              <div class="gm-cert-center">${escapeHtml(schoolCenter)}</div>
            </div>
          </div>

          <div class="gm-cert-rule"></div>
          <div class="gm-cert-title-wrap">
            <div class="gm-cert-title">CERTIFICATION</div>
          </div>

          <div class="gm-cert-body">
            <p class="gm-cert-intro">This is to certify that <strong>${escapeHtml(studentName)}</strong> with LRN: <strong>${escapeHtml(lrn)}</strong>, graduated under the <strong>${escapeHtml(track)}</strong> Track, <strong>${escapeHtml(strand)}</strong> Strand, Section <strong>${escapeHtml(section)}</strong> of <strong>${escapeHtml(schoolName)}</strong>, S.Y. <strong>${escapeHtml(schoolYear)}</strong>. This further certifies that as per records kept in this office, no disciplinary remarks were noted on file regarding the student’s character.</p>
            <p class="gm-cert-centerline">This certification is being issued upon the request of the herein grantee as a documentary requirement for <strong>${escapeHtml(purpose)}</strong>.</p>
            <p class="gm-cert-issue">Given this <strong>${escapeHtml(issueDate)}</strong>, at <strong>${escapeHtml(certificateLocation)}</strong>.</p>
          </div>

          <div class="gm-cert-signature">
            <div class="gm-cert-sign-line"></div>
            <div class="gm-cert-sign-name">${escapeHtml(approver)}</div>
            <div class="gm-cert-sign-role">${escapeHtml(approverRole)}</div>
          </div>

          <div class="gm-cert-footer-note">This certification is not official unless school seal is affixed.</div>
          <div class="gm-cert-footer">
            <img src="assets/certificate_footer.png" alt="Official school footer">
          </div>
        </div>
      </div>
    `;
  };

  const originalResetPassword = window.resetPassword;
  window.resetPassword = async function(username) {
    const user = db?.users?.find(u => u.username === username);
    if (!user) return;
    const newPassword = prompt(`Enter a new password for ${user.username}:`);
    if (!newPassword) return;
    if (String(newPassword).trim().length < 8) {
      toast('Weak password', 'Use at least 8 characters.', 'warning');
      return;
    }
    user.passwordHash = await hashPassword(newPassword.trim());
    user.updatedAt = new Date().toISOString();
    saveDB();
    notify(user.username, 'Password changed', 'Your password was updated by the administrator.');
    addAudit('Password changed', `${user.username} password updated by admin.`);
    renderAccountsPage?.();
    renderAll?.();
    toast('Password updated', `The password for ${user.username} was changed successfully.`, 'success');
  };

  const originalRenderAccountsPage = window.renderAccountsPage;
  if (typeof originalRenderAccountsPage === 'function') {
    window.renderAccountsPage = function(...args) {
      const result = originalRenderAccountsPage.apply(this, args);
      syncAccountActionLabels();
      return result;
    };
  }

  const originalRenderAll = window.renderAll;
  if (typeof originalRenderAll === 'function') {
    window.renderAll = function(...args) {
      const result = originalRenderAll.apply(this, args);
      injectLoginCosmos();
      syncAccountActionLabels();
      return result;
    };
  }

  const originalShowPage = window.showPage;
  if (typeof originalShowPage === 'function') {
    window.showPage = function(...args) {
      const result = originalShowPage.apply(this, args);
      injectLoginCosmos();
      syncAccountActionLabels();
      return result;
    };
  }

  const originalLogin = window.login;
  if (typeof originalLogin === 'function') {
    window.login = function(...args) {
      const result = originalLogin.apply(this, args);
      injectLoginCosmos();
      syncAccountActionLabels();
      return result;
    };
  }

  const originalBuildNav = window.buildNav;
  if (typeof originalBuildNav === 'function') {
    window.buildNav = function(...args) {
      const result = originalBuildNav.apply(this, args);
      syncAccountActionLabels();
      return result;
    };
  }

  window.addEventListener('DOMContentLoaded', () => {
    injectLoginCosmos();
    syncAccountActionLabels();
  });
  window.addEventListener('load', () => {
    injectLoginCosmos();
    syncAccountActionLabels();
  });
})();
