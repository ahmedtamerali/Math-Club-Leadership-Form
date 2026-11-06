// ========================================================
// MATH & MECHANICS CLUB — LEADER REVIEW & REVISION SCRIPT
// ========================================================

let submissions = [];
let activeSubmission = null;
let currentPasscode = '';

document.addEventListener('DOMContentLoaded', () => {
  const authOverlay = document.getElementById('authOverlay');
  const authForm = document.getElementById('authForm');
  const passcodeInput = document.getElementById('passcodeInput');
  const authError = document.getElementById('authError');
  const adminContent = document.getElementById('adminContent');

  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const sortBy = document.getElementById('sortBy');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const copyStudentLinkBtn = document.getElementById('copyStudentLinkBtn');

  // Modal elements
  const detailModal = document.getElementById('detailModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const evaluationForm = document.getElementById('evaluationForm');
  const evalRating = document.getElementById('evalRating');
  const ratingDisplay = document.getElementById('ratingDisplay');
  const deleteCandidateBtn = document.getElementById('deleteCandidateBtn');

  // Lightbox elements
  const lightboxModal = document.getElementById('lightboxModal');
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');

  // 1. Passcode & Auth Handling
  const urlParams = new URLSearchParams(window.location.search);
  const keyFromUrl = urlParams.get('key');
  const storedPasscode = localStorage.getItem('mmc_leader_passcode');

  if (keyFromUrl) {
    verifyPasscode(keyFromUrl);
  } else if (storedPasscode) {
    verifyPasscode(storedPasscode);
  } else {
    showAuthOverlay();
  }

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const entered = passcodeInput.value.trim();
    if (entered) {
      verifyPasscode(entered);
    }
  });

  async function verifyPasscode(key) {
    try {
      const res = await fetch('/api/verify-leader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });

      if (res.ok) {
        currentPasscode = key;
        localStorage.setItem('mmc_leader_passcode', key);
        authOverlay.style.display = 'none';
        adminContent.style.display = 'block';
        loadSubmissions();
      } else {
        showAuthOverlay('Invalid Leader Passcode. Please try again.');
      }
    } catch (err) {
      showAuthOverlay('Connection error. Could not verify passcode.');
    }
  }

  function showAuthOverlay(msg = '') {
    authOverlay.style.display = 'flex';
    adminContent.style.display = 'none';
    if (msg) {
      authError.textContent = msg;
      authError.classList.add('visible');
    } else {
      authError.textContent = '';
      authError.classList.remove('visible');
    }
  }

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('mmc_leader_passcode');
    currentPasscode = '';
    window.location.href = '/leaders';
  });

  // 2. Load Submissions from Backend
  async function loadSubmissions() {
    try {
      const res = await fetch('/api/submissions', {
        headers: { 'x-leader-key': currentPasscode }
      });

      if (!res.ok) {
        if (res.status === 401) {
          showAuthOverlay('Session expired. Please enter passcode again.');
          return;
        }
        throw new Error('Failed to load data');
      }

      const data = await res.json();
      submissions = data.submissions || [];
      renderStats();
      renderTable();
    } catch (err) {
      console.error(err);
      showToast('Error fetching applications.', 'error');
    }
  }

  // 3. Render Stats Ribbon
  function renderStats() {
    const total = submissions.length;
    const pending = submissions.filter(s => s.review.status === 'Pending Review').length;
    const shortlisted = submissions.filter(s => s.review.status === 'Shortlisted').length;
    const selected = submissions.filter(s => s.review.status === 'Selected Leader').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statShortlisted').textContent = shortlisted;
    document.getElementById('statSelected').textContent = selected;
  }

  // 4. Render Table with Filters & Sorting
  function renderTable() {
    const tbody = document.getElementById('submissionsTableBody');
    const emptyState = document.getElementById('emptyState');
    tbody.innerHTML = '';

    const query = searchInput.value.toLowerCase().trim();
    const statusVal = statusFilter.value;
    const sortVal = sortBy.value;

    let filtered = submissions.filter(s => {
      const matchesSearch =
        s.student.name.toLowerCase().includes(query) ||
        s.student.email.toLowerCase().includes(query) ||
        s.student.phone.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query);

      const matchesStatus = statusVal === 'all' || s.review.status === statusVal;
      return matchesSearch && matchesStatus;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortVal === 'newest') return new Date(b.submittedAt) - new Date(a.submittedAt);
      if (sortVal === 'oldest') return new Date(a.submittedAt) - new Date(b.submittedAt);
      if (sortVal === 'rating') return (b.review.rating || 0) - (a.review.rating || 0);
      if (sortVal === 'name') return a.student.name.localeCompare(b.student.name);
      return 0;
    });

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }

    filtered.forEach(sub => {
      const tr = document.createElement('tr');

      const dateStr = new Date(sub.submittedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const statusBadgeClass = getStatusClass(sub.review.status);

      tr.innerHTML = `
        <td>
          <span class="candidate-cell-name">${escapeHtml(sub.student.name)}</span>
          <span class="candidate-cell-id">${sub.id}</span>
        </td>
        <td>
          <div><i class="fa-solid fa-phone" style="font-size:0.75rem; color:#64748b;"></i> ${escapeHtml(sub.student.phone)}</div>
          <div style="font-size:0.8rem; color:#94a3b8;"><i class="fa-regular fa-envelope" style="font-size:0.75rem;"></i> ${escapeHtml(sub.student.email)}</div>
        </td>
        <td>
          <div class="proof-thumbnails">
            <img src="${sub.grades.term1PhotoUrl}" alt="Term 1" class="proof-mini-thumb" title="Term 1 Grade Photo" onclick="openPhotoViewer('${sub.grades.term1PhotoUrl}', 'Term 1 Grade - ${escapeHtml(sub.student.name)}')">
            <img src="${sub.grades.term2PhotoUrl}" alt="Term 2" class="proof-mini-thumb" title="Term 2 Grade Photo" onclick="openPhotoViewer('${sub.grades.term2PhotoUrl}', 'Term 2 Grade - ${escapeHtml(sub.student.name)}')">
          </div>
        </td>
        <td>
          <span class="badge-status ${statusBadgeClass}">
            ${escapeHtml(sub.review.status)}
          </span>
        </td>
        <td>
          <span class="rating-badge">
            <i class="fa-solid fa-star" style="font-size:0.8rem;"></i> ${sub.review.rating || 0}/10
          </span>
        </td>
        <td style="font-size: 0.82rem; color: #94a3b8;">
          ${dateStr}
        </td>
        <td class="text-right" style="white-space: nowrap;">
          <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.82rem;" onclick="openDetailModal('${sub.id}')">
            <i class="fa-regular fa-eye"></i> Review
          </button>
          <button class="btn btn-outline-danger" style="padding: 6px 12px; font-size: 0.82rem; margin-left: 6px;" onclick="confirmDeleteSubmission('${sub.id}', '${escapeHtml(sub.student.name)}')">
            <i class="fa-solid fa-trash-can"></i> Delete
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  // 5. Open Detail Modal for Review
  window.openDetailModal = function(id) {
    const sub = submissions.find(s => s.id === id);
    if (!sub) return;
    activeSubmission = sub;

    document.getElementById('modalId').textContent = sub.id;
    document.getElementById('modalName').textContent = sub.student.name;
    document.getElementById('modalDate').textContent = 'Submitted on ' + new Date(sub.submittedAt).toLocaleString();

    document.getElementById('modalPhone').textContent = sub.student.phone;
    document.getElementById('modalPhoneLink').href = `tel:${sub.student.phone}`;
    document.getElementById('modalEmail').textContent = sub.student.email;
    document.getElementById('modalEmailLink').href = `mailto:${sub.student.email}`;

    // Photos
    const term1Img = document.getElementById('modalTerm1Img');
    term1Img.src = sub.grades.term1PhotoUrl;
    document.getElementById('term1FullBtn').href = sub.grades.term1PhotoUrl;

    const term2Img = document.getElementById('modalTerm2Img');
    term2Img.src = sub.grades.term2PhotoUrl;
    document.getElementById('term2FullBtn').href = sub.grades.term2PhotoUrl;

    // Responses
    document.getElementById('modalAbout').textContent = sub.responses.about;
    document.getElementById('modalPassion').textContent = sub.responses.passion;
    document.getElementById('modalPlans').textContent = sub.responses.plans;

    // Evaluation Controls
    document.getElementById('evalStatus').value = sub.review.status || 'Pending Review';
    evalRating.value = sub.review.rating || 0;
    ratingDisplay.textContent = `${evalRating.value}/10`;
    document.getElementById('evalNotes').value = sub.review.notes || '';

    detailModal.classList.remove('hidden');
  };

  closeModalBtn.addEventListener('click', () => {
    detailModal.classList.add('hidden');
    activeSubmission = null;
  });

  // Score slider update
  evalRating.addEventListener('input', () => {
    ratingDisplay.textContent = `${evalRating.value}/10`;
  });

  // Save Evaluation (PATCH API)
  evaluationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeSubmission) return;

    const newStatus = document.getElementById('evalStatus').value;
    const newRating = evalRating.value;
    const newNotes = document.getElementById('evalNotes').value;

    const saveBtn = document.getElementById('saveEvalBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
      const res = await fetch(`/api/submissions/${activeSubmission.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-leader-key': currentPasscode
        },
        body: JSON.stringify({
          status: newStatus,
          rating: newRating,
          notes: newNotes
        })
      });

      const result = await res.json();
      if (res.ok) {
        // Update local object
        activeSubmission.review.status = newStatus;
        activeSubmission.review.rating = Number(newRating);
        activeSubmission.review.notes = newNotes;

        showToast('Evaluation saved successfully!', 'success');
        renderStats();
        renderTable();
        detailModal.classList.add('hidden');
      } else {
        showToast(result.error || 'Failed to save evaluation.', 'error');
      }
    } catch (err) {
      showToast('Network error while saving review.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Evaluation';
    }
  });

  // Delete Submission with Ensuring Confirmation Message
  window.confirmDeleteSubmission = async function(id, name) {
    const isSure = confirm(
      `⚠️ ENSURE DELETION\n\nAre you sure you want to permanently delete the application of "${name}"?\n\nThis will remove their contact info, responses, and uploaded grade photos from MongoDB Atlas.\n\nThis action CANNOT be undone.`
    );
    if (!isSure) return;

    try {
      const res = await fetch(`/api/submissions/${id}`, {
        method: 'DELETE',
        headers: { 'x-leader-key': currentPasscode }
      });

      if (res.ok) {
        submissions = submissions.filter(s => s.id !== id);
        showToast(`Application of ${name} was permanently removed.`, 'success');
        renderStats();
        renderTable();
        if (activeSubmission && activeSubmission.id === id) {
          detailModal.classList.add('hidden');
          activeSubmission = null;
        }
      } else {
        showToast('Failed to delete application from database.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error while deleting application.', 'error');
    }
  };

  deleteCandidateBtn.addEventListener('click', () => {
    if (!activeSubmission) return;
    window.confirmDeleteSubmission(activeSubmission.id, activeSubmission.student.name);
  });

  // 6. Photo Lightbox Modal
  window.openPhotoViewer = function(imgSrc, title) {
    document.getElementById('lightboxImg').src = imgSrc;
    document.getElementById('lightboxTitle').textContent = title;
    lightboxModal.classList.remove('hidden');
  };

  closeLightboxBtn.addEventListener('click', () => {
    lightboxModal.classList.add('hidden');
    document.getElementById('lightboxImg').src = '';
  });

  lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal || e.target.classList.contains('lightbox-body')) {
      lightboxModal.classList.add('hidden');
    }
  });

  // 7. Search & Filter Listeners
  searchInput.addEventListener('input', renderTable);
  statusFilter.addEventListener('change', renderTable);
  sortBy.addEventListener('change', renderTable);
  refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.add('fa-spin');
    loadSubmissions().then(() => {
      refreshBtn.classList.remove('fa-spin');
      showToast('Submissions refreshed.', 'info');
    });
  });

  // 8. Export CSV
  exportCsvBtn.addEventListener('click', () => {
    window.location.href = `/api/export-csv?key=${encodeURIComponent(currentPasscode)}`;
  });

  // Copy Student Link
  if (copyStudentLinkBtn) {
    copyStudentLinkBtn.addEventListener('click', () => {
      const studentUrl = window.location.origin + '/apply';
      navigator.clipboard.writeText(studentUrl).then(() => {
        showToast('Student Form Link copied to clipboard!', 'success');
      });
    });
  }

  // Helpers
  function getStatusClass(status) {
    switch (status) {
      case 'Shortlisted': return 'status-shortlisted';
      case 'Interview Scheduled': return 'status-interview';
      case 'Selected Leader': return 'status-selected';
      case 'Rejected': return 'status-rejected';
      case 'Under Review': return 'status-under-review';
      default: return 'status-pending';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});

// Toast Notifications System
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info');
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
