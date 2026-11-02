// ===== Dark mode toggle =====
const themeToggle = document.getElementById('themeToggle');
const MOON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg>';
const SUN =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>';
const root = document.documentElement; // the theme class is set in <head>
function updateThemeButton() {
  const dark = root.classList.contains('dark');
  themeToggle.innerHTML = dark ? SUN : MOON;
  themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
}
updateThemeButton();
themeToggle.addEventListener('click', () => {
  root.classList.toggle('dark');
  try {
    localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
  } catch (e) {}
  updateThemeButton();
});

// ===== Admin mode =====
let adminToken = null;
const adminDialog = document.getElementById('adminDialog');
const adminForm = document.getElementById('adminForm');
const adminInput = document.getElementById('admin-token');
const adminStatus = document.getElementById('admin-status');

function setAdminStatus(text, isError) {
  adminStatus.textContent = text;
  adminStatus.classList.toggle('error', !!isError);
}

function enableAdmin() {
  adminInput.value = '';
  adminDialog.showModal();
}
document.getElementById('adminButton').addEventListener('click', enableAdmin);
document.getElementById('adminCancel').addEventListener('click', () => adminDialog.close());

adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = adminInput.value;
  if (!token) return;
  let res;
  try {
    res = await fetch('/admin-verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    adminDialog.close();
    setAdminStatus('No connection. Try again.', true);
    return;
  }
  adminDialog.close();
  if (res.ok) {
    adminToken = token;
    document.body.classList.add('admin-mode');
    setAdminStatus('Admin mode on');
    refreshComments();
  } else if (res.status === 429) {
    setAdminStatus('Too many attempts. Try again in a minute.', true);
  } else {
    setAdminStatus('Wrong admin token.', true);
  }
});

// ===== Own comments (marked "You") =====
// Kept in this browser only; the wall itself stays anonymous.
let myIds = [];
try {
  myIds = JSON.parse(localStorage.getItem('myComments') || '[]');
} catch (e) {}
function rememberMine(id) {
  myIds = myIds.concat(id).slice(-200);
  try {
    localStorage.setItem('myComments', JSON.stringify(myIds));
  } catch (e) {}
}

// ===== Posting comments =====
const form = document.getElementById('commentForm');
const errorDiv = document.getElementById('form-error');
const commentsDiv = document.getElementById('comments');
const charCount = document.getElementById('char-count');
const submitBtn = form.querySelector('button[type="submit"]');
const MAX_LENGTH = 500;

function updateCharCount() {
  charCount.textContent = `${form.text.value.length} / ${MAX_LENGTH}`;
}
form.text.addEventListener('input', updateCharCount);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorDiv.textContent = '';
  const text = form.text.value.trim();
  if (!text) {
    errorDiv.textContent = 'Comment text is required.';
    return;
  }
  // Block a second click while this request is on its way
  submitBtn.disabled = true;
  let res;
  try {
    res = await fetch('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    // The text stays in the field, so nothing is lost
    errorDiv.textContent = "No connection. Your comment wasn't sent. Try again.";
    return;
  } finally {
    submitBtn.disabled = false;
  }
  if (res.ok) {
    const created = await res.json();
    rememberMine(created.id);
    form.text.value = '';
    updateCharCount();
    refreshComments(); // show the new comment now, not on the next poll
  } else if (res.status === 429) {
    errorDiv.textContent = "You're posting too fast. Try again in a few seconds.";
  } else {
    const data = await res.json().catch(() => ({}));
    errorDiv.textContent = data.error || 'Failed to post comment.';
  }
});

// ===== Deleting comments =====
async function deleteComment(id) {
  errorDiv.textContent = '';
  if (!adminToken) {
    errorDiv.textContent = 'Unauthorized to delete.';
    return;
  }
  let res;
  try {
    res = await fetch(`/comments/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  } catch (err) {
    errorDiv.textContent = "No connection. The comment wasn't deleted.";
    return;
  }
  if (res.ok) {
    older = older.filter((c) => c.id !== id);
    refreshComments();
  } else {
    const data = await res.json().catch(() => ({}));
    errorDiv.textContent = data.error || 'Failed to delete.';
  }
}

// One listener for every Delete button, including the server-rendered ones
commentsDiv.addEventListener('click', (e) => {
  const btn = e.target.closest('.delete-btn');
  if (btn) deleteComment(Number(btn.closest('.comment').dataset.id));
});

// ===== Showing comments =====
const PAGE_SIZE = 50;
const loadOlderBtn = document.getElementById('loadOlder');
const liveDot = document.getElementById('live-dot');
const liveStatus = document.getElementById('live-status');
let newest = []; // the latest page, refreshed by polling
let older = []; // pages added with "Load older comments"
let moreOnServer = false;
let lastUpdate = null;

function formatAgo(ms) {
  const seconds = ms / 1000;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return null;
}

function formatTime(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  return formatAgo(ms) || new Date(iso).toLocaleDateString();
}

function setLive(state) {
  liveDot.classList.toggle('paused', state !== 'ok');
  if (state === 'limited') {
    liveStatus.textContent = 'Live updates paused: too many requests';
  } else if (state === 'offline') {
    liveStatus.textContent = 'Offline · retrying';
  } else {
    liveStatus.textContent = `Live · updated ${formatAgo(Date.now() - lastUpdate) || 'a while ago'}`;
  }
}

function renderComments() {
  const oldestNewId = newest.length ? newest[newest.length - 1].id : Infinity;
  const list = newest.concat(older.filter((c) => c.id < oldestNewId));
  commentsDiv.innerHTML = '';
  list.forEach((c) => {
    const mine = myIds.includes(c.id);
    const el = document.createElement('article');
    el.className = mine ? 'comment mine' : 'comment';
    el.dataset.id = c.id;

    // Build nodes instead of innerHTML string — comment text is set via
    // textContent, so markup in a comment is shown as text, not executed.
    const meta = document.createElement('div');
    meta.className = 'comment-meta';
    const author = document.createElement('span');
    author.className = 'comment-author';
    author.textContent = mine ? 'You' : 'Anonymous';
    meta.appendChild(author);
    if (c.created_at) {
      const sep = document.createElement('span');
      sep.textContent = '·';
      const timeEl = document.createElement('time');
      timeEl.dateTime = c.created_at;
      timeEl.title = new Date(c.created_at).toLocaleString();
      timeEl.textContent = formatTime(c.created_at);
      meta.append(sep, timeEl);
    }
    if (adminToken) {
      const btn = document.createElement('button');
      btn.className = 'delete-btn';
      btn.type = 'button';
      btn.textContent = 'Delete';
      meta.appendChild(btn);
    }

    const textEl = document.createElement('p');
    textEl.className = 'comment-text';
    textEl.textContent = c.text;

    el.append(meta, textEl);
    commentsDiv.appendChild(el);
  });
  loadOlderBtn.hidden = !moreOnServer;
}

// ===== Polling for updates =====
async function refreshComments() {
  let res;
  try {
    res = await fetch(`/comments?limit=${PAGE_SIZE}`);
  } catch (err) {
    setLive('offline'); // the next poll tries again
    return;
  }
  if (res.status === 429) {
    setLive('limited');
    return;
  }
  if (!res.ok) return;
  newest = await res.json();
  lastUpdate = Date.now();
  setLive('ok');
  if (!older.length) moreOnServer = newest.length === PAGE_SIZE;
  renderComments();
}

loadOlderBtn.addEventListener('click', async () => {
  const all = newest.concat(older);
  if (!all.length) return;
  const oldestId = Math.min(...all.map((c) => c.id));
  let res;
  try {
    res = await fetch(`/comments?limit=${PAGE_SIZE}&before=${oldestId}`);
  } catch (err) {
    errorDiv.textContent = "No connection. Couldn't load older comments.";
    return;
  }
  if (!res.ok) return;
  const page = await res.json();
  older = older.concat(page);
  moreOnServer = page.length === PAGE_SIZE;
  renderComments();
});

refreshComments();
setInterval(refreshComments, 5000);

// ===== Cat chaos (toggle on the 🐱 Cat button): spinning cats + music =====
let chaosOn = false;
// references we must keep so we can tear everything down later
let catTimer = null;
let catAudio = null;

function startCatChaos() {
  chaosOn = true;

  // music — plays now because the click is the user gesture browsers require
  catAudio = document.createElement('audio');
  catAudio.src = '/static/cat.mp3';
  catAudio.loop = true;
  catAudio.volume = 0.25; // 25% volume
  document.body.appendChild(catAudio);
  catAudio.play().catch(() => {});

  // with "reduce motion" set on the device, the cats still appear but don't spin
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // spawn a spinning cat every 500ms; class 'cat-gif' lets us remove them all later
  catTimer = setInterval(() => {
    const gif = document.createElement('img');
    gif.className = 'cat-gif';
    gif.src = '/static/cat.gif';
    Object.assign(gif.style, {
      position: 'fixed',
      zIndex: 9999,
      width: '150px',
      animation: calm ? 'none' : 'spin 2s linear infinite',
      top: Math.random() * window.innerHeight + 'px',
      left: Math.random() * window.innerWidth + 'px',
      pointerEvents: 'none',
    });
    document.body.appendChild(gif);
    setTimeout(() => gif.remove(), 10000);
  }, 500);
}

function stopCatChaos() {
  chaosOn = false;

  // stop the spawn timer
  clearInterval(catTimer);

  // stop the music
  if (catAudio) {
    catAudio.pause();
    catAudio.remove();
    catAudio = null;
  }

  // remove the cats
  document.querySelectorAll('.cat-gif').forEach((el) => el.remove());
}

document.getElementById('catJam').addEventListener('click', () => {
  chaosOn ? stopCatChaos() : startCatChaos();
});
