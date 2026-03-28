(() => {
  let data = { settings: { theme: 'dark' }, projects: [] };
  let activeProjectId = null;

  // DOM refs
  const $ = (sel) => document.querySelector(sel);
  const projectListEl = $('#project-list');
  const emptyStateEl = $('#empty-state');
  const activeChatEl = $('#active-chat');
  const chatTitleEl = $('#chat-title');
  const chatAvatarEl = $('#chat-avatar');
  const chatCountEl = $('#chat-count');
  const messagesEl = $('#messages-container');
  const messageInput = $('#message-input');
  const sendBtn = $('#send-btn');
  const searchInput = $('#search-input');
  const themeToggle = $('#theme-toggle');
  const newProjectBtn = $('#new-project-btn');
  const starredBtn = $('#starred-btn');
  let showingStarred = false;

  // ===== Data helpers =====
  function genId() {
    return crypto.randomUUID();
  }

  async function save() {
    await window.api.saveData(data);
  }

  function getProject(id) {
    return data.projects.find((p) => p.id === id);
  }

  function formatTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function formatMessageTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDateLabel(iso) {
    const d = new Date(iso);
    const now = new Date();
    const strip = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    const diff = strip(now) - strip(d);
    const oneDay = 86400000;

    if (diff === 0) return 'TODAY';
    if (diff === oneDay) return 'YESTERDAY';
    return d.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
  }

  function getDateKey(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function getInitial(name) {
    return name.charAt(0).toUpperCase();
  }

  // ===== Rendering =====
  function renderSidebar() {
    const query = searchInput.value.toLowerCase().trim();
    const sorted = [...data.projects].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    const filtered = query
      ? sorted.filter((p) => p.name.toLowerCase().includes(query))
      : sorted;

    projectListEl.innerHTML = '';

    for (const project of filtered) {
      const lastMsg = project.messages[project.messages.length - 1];
      const unchecked = project.messages.filter((m) => !m.checked && !containsUrl(m.text)).length;

      const el = document.createElement('div');
      el.className = 'project-item' + (project.id === activeProjectId ? ' selected' : '');
      el.dataset.id = project.id;

      const avatarContent = project.avatar
        ? `<img class="project-avatar-img" src="${project.avatar}" alt="">`
        : getInitial(project.name);

      el.innerHTML = `
        <div class="project-avatar">${avatarContent}</div>
        <div class="project-info">
          <div class="project-name">${escapeHtml(project.name)}</div>
          <div class="project-preview">${lastMsg ? escapeHtml(lastMsg.text) : 'No tasks yet'}</div>
        </div>
        <div class="project-meta">
          <div class="project-time-row">${project.pinned ? '<svg class="pin-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>' : ''}<span class="project-time">${formatTime(project.updatedAt)}</span></div>
          ${unchecked > 0 ? `<div class="project-badge">${unchecked}</div>` : ''}
        </div>
      `;

      const avatarEl = el.querySelector('.project-avatar');
      avatarEl.classList.add('clickable');
      avatarEl.addEventListener('click', (e) => {
        e.stopPropagation();
        showInfoPanel(project.id);
      });

      el.addEventListener('click', () => selectProject(project.id));
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleProjectContextMenu(project.id);
      });
      el.addEventListener('dblclick', () => startInlineRename(project.id));

      projectListEl.appendChild(el);
    }
  }

  function renderChat() {
    const project = getProject(activeProjectId);
    if (!project) {
      emptyStateEl.classList.remove('hidden');
      activeChatEl.classList.add('hidden');
      return;
    }

    emptyStateEl.classList.add('hidden');
    activeChatEl.classList.remove('hidden');
    $('#input-bar').classList.remove('hidden');
    chatTitleEl.textContent = project.name;

    if (project.avatar) {
      chatAvatarEl.innerHTML = `<img class="project-avatar-img" src="${project.avatar}" alt="">`;
    } else {
      chatAvatarEl.textContent = getInitial(project.name);
    }

    const headerLeft = chatAvatarEl.parentElement;
    headerLeft.className = 'chat-header-left clickable';
    headerLeft.onclick = () => showInfoPanel(project.id);

    const total = project.messages.length;
    const done = project.messages.filter((m) => m.checked).length;
    chatCountEl.textContent = total > 0 ? `${done}/${total} done` : '';

    messagesEl.innerHTML = '';
    let lastDateKey = null;

    for (const msg of project.messages) {
      const dateKey = getDateKey(msg.createdAt);
      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        separator.innerHTML = `<span>${formatDateLabel(msg.createdAt)}</span>`;
        messagesEl.appendChild(separator);
      }

      const bubble = document.createElement('div');
      const isLink = containsUrl(msg.text);
      bubble.className = 'message-bubble' + (isLink ? ' link-bubble' : '') + (msg.starred ? ' starred' : '');
      bubble.dataset.id = msg.id;

      if (isLink) {
        bubble.innerHTML = `
          <svg class="link-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
          <span class="message-text">${linkify(msg.text)}</span>
          <span class="message-meta">${msg.starred ? '<svg class="star-icon" viewBox="0 0 24 24" width="12" height="12" fill="#FFD700" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>' : ''}<span class="message-time">${formatMessageTime(msg.createdAt)}</span></span>
        `;

        bubble.querySelectorAll('.message-link').forEach((a) => {
          a.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.api.openExternal(decodeURI(a.dataset.url));
          });
        });
      } else {
        bubble.innerHTML = `
          <label class="checkbox-wrapper">
            <input type="checkbox" ${msg.checked ? 'checked' : ''}>
            <span class="custom-checkbox">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
          </label>
          <span class="message-text ${msg.checked ? 'checked' : ''}">${escapeHtml(msg.text)}</span>
          <span class="message-meta">${msg.starred ? '<svg class="star-icon" viewBox="0 0 24 24" width="12" height="12" fill="#FFD700" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>' : ''}<span class="message-time">${formatMessageTime(msg.createdAt)}</span></span>
        `;

        bubble.addEventListener('click', (e) => {
          if (e.button === 0) toggleMessage(project.id, msg.id);
        });
      }

      bubble.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleMessageContextMenu(project.id, msg.id);
      });

      messagesEl.appendChild(bubble);
    }

    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  // ===== Actions =====
  function selectProject(id) {
    activeProjectId = id;
    showingStarred = false;
    starredBtn.classList.remove('active');
    renderSidebar();
    renderChat();
    messageInput.focus();
  }

  async function addMessage(text) {
    const project = getProject(activeProjectId);
    if (!project || !text.trim()) return;

    project.messages.push({
      id: genId(),
      text: text.trim(),
      checked: false,
      createdAt: new Date().toISOString(),
    });
    project.updatedAt = new Date().toISOString();

    await save();
    renderSidebar();
    renderChat();
  }

  async function toggleMessage(projectId, messageId) {
    const project = getProject(projectId);
    if (!project) return;

    const msg = project.messages.find((m) => m.id === messageId);
    if (!msg) return;

    msg.checked = !msg.checked;
    project.updatedAt = new Date().toISOString();

    await save();
    renderSidebar();
    renderChat();
  }

  async function deleteMessage(projectId, messageId) {
    const project = getProject(projectId);
    if (!project) return;

    project.messages = project.messages.filter((m) => m.id !== messageId);
    project.updatedAt = new Date().toISOString();

    await save();
    renderSidebar();
    renderChat();
  }

  async function createProject() {
    const project = {
      id: genId(),
      name: 'New Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    data.projects.push(project);
    await save();
    selectProject(project.id);
    startInlineRename(project.id);
  }

  async function renameProject(projectId, newName) {
    const project = getProject(projectId);
    if (!project || !newName.trim()) return;

    project.name = newName.trim();
    project.updatedAt = new Date().toISOString();

    await save();
    renderSidebar();
    renderChat();
  }

  async function setProjectAvatar(projectId, filePath) {
    const project = getProject(projectId);
    if (!project) return;

    project.avatar = filePath;
    project.updatedAt = new Date().toISOString();

    await save();
    renderSidebar();
    renderChat();
  }

  async function togglePin(projectId) {
    const project = getProject(projectId);
    if (!project) return;

    project.pinned = !project.pinned;
    await save();
    renderSidebar();
  }

  async function deleteProject(projectId) {
    data.projects = data.projects.filter((p) => p.id !== projectId);
    if (activeProjectId === projectId) activeProjectId = null;

    await save();
    renderSidebar();
    renderChat();
  }

  function startInlineRename(projectId) {
    const el = projectListEl.querySelector(`[data-id="${projectId}"] .project-name`);
    if (!el) return;

    const project = getProject(projectId);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'project-rename-input';
    input.value = project.name;

    el.replaceWith(input);
    input.focus();
    input.select();

    function finish() {
      const val = input.value.trim() || project.name;
      renameProject(projectId, val);
    }

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') {
        input.value = project.name;
        input.blur();
      }
    });
  }

  // ===== Context Menus =====
  async function handleMessageContextMenu(projectId, messageId) {
    const project = getProject(projectId);
    const msg = project && project.messages.find((m) => m.id === messageId);
    const links = msg ? (msg.text.match(/https?:\/\/[^\s]+/g) || []) : [];
    const starred = msg ? !!msg.starred : false;
    const result = await window.api.showMessageMenu({ projectId, messageId, links, starred });
    if (!result) return;

    if (result.action === 'delete') {
      await deleteMessage(projectId, messageId);
    } else if (result.action === 'star') {
      await toggleStar(projectId, messageId);
    }
  }

  async function toggleStar(projectId, messageId) {
    const project = getProject(projectId);
    if (!project) return;
    const msg = project.messages.find((m) => m.id === messageId);
    if (!msg) return;

    msg.starred = !msg.starred;
    await save();
    renderSidebar();
    if (showingStarred) {
      renderStarredView();
    } else {
      renderChat();
    }
  }

  async function handleProjectContextMenu(projectId) {
    const project = getProject(projectId);
    const pinned = project ? !!project.pinned : false;
    const result = await window.api.showProjectMenu({ projectId, pinned });
    if (!result) return;

    if (result.action === 'pin') {
      await togglePin(projectId);
    } else if (result.action === 'avatar') {
      const filePath = await window.api.pickImage();
      if (filePath) await setProjectAvatar(projectId, filePath);
    } else if (result.action === 'rename') {
      selectProject(projectId);
      requestAnimationFrame(() => startInlineRename(projectId));
    } else if (result.action === 'delete') {
      const confirmed = await showConfirm(
        'Delete this project?',
        'All tasks and messages will be permanently deleted.'
      );
      if (confirmed) await deleteProject(projectId);
    }
  }

  // ===== Theme =====
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    data.settings.theme = theme;
    save();
  }

  function toggleTheme() {
    const current = data.settings.theme;
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  // ===== Info Panel =====
  const infoOverlay = $('#info-overlay');
  const infoBackdrop = $('#info-backdrop');
  const infoCloseBtn = $('#info-close-btn');
  const infoAvatar = $('#info-avatar');
  const infoName = $('#info-name');
  const infoDescription = $('#info-description');
  const infoTotal = $('#info-total');
  const infoDone = $('#info-done');
  const infoCreated = $('#info-created');
  let infoPanelProjectId = null;

  function showInfoPanel(projectId) {
    const project = getProject(projectId);
    if (!project) return;
    infoPanelProjectId = projectId;

    // Avatar
    if (project.avatar) {
      infoAvatar.innerHTML = `<img src="${project.avatar}" alt=""><div class="info-avatar-overlay"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg><span>CHANGE<br>PHOTO</span></div>`;
    } else {
      infoAvatar.innerHTML = `${getInitial(project.name)}<div class="info-avatar-overlay"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg><span>ADD<br>PHOTO</span></div>`;
    }

    infoName.textContent = project.name;
    infoDescription.value = project.description || '';

    // Stats
    const total = project.messages.length;
    const done = project.messages.filter((m) => m.checked).length;
    infoTotal.textContent = total;
    infoDone.textContent = done;
    infoCreated.textContent = new Date(project.createdAt).toLocaleDateString([], {
      year: 'numeric', month: 'short', day: 'numeric',
    });

    infoOverlay.classList.remove('hidden');
  }

  function hideInfoPanel() {
    infoOverlay.classList.add('hidden');
    infoPanelProjectId = null;
  }

  infoCloseBtn.addEventListener('click', hideInfoPanel);
  infoBackdrop.addEventListener('click', hideInfoPanel);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !infoOverlay.classList.contains('hidden')) {
      hideInfoPanel();
    }
  });

  // Click avatar in panel → pick new image
  infoAvatar.addEventListener('click', async () => {
    if (!infoPanelProjectId) return;
    const filePath = await window.api.pickImage();
    if (filePath) {
      await setProjectAvatar(infoPanelProjectId, filePath);
      showInfoPanel(infoPanelProjectId);
    }
  });

  // Description auto-save on blur
  infoDescription.addEventListener('blur', async () => {
    if (!infoPanelProjectId) return;
    const project = getProject(infoPanelProjectId);
    if (!project) return;
    project.description = infoDescription.value.trim();
    await save();
  });

  // ===== Confirm Dialog =====
  const confirmOverlay = $('#confirm-overlay');
  const confirmBackdrop = $('#confirm-backdrop');
  const confirmMessage = $('#confirm-message');
  const confirmDetail = $('#confirm-detail');
  const confirmCancel = $('#confirm-cancel');
  const confirmOk = $('#confirm-ok');
  let confirmResolver = null;

  function showConfirm(message, detail, okLabel = 'Delete') {
    confirmMessage.textContent = message;
    confirmDetail.textContent = detail || '';
    confirmDetail.style.display = detail ? 'block' : 'none';
    confirmOk.textContent = okLabel;
    confirmOverlay.classList.remove('hidden');
    return new Promise((resolve) => { confirmResolver = resolve; });
  }

  function closeConfirm(result) {
    confirmOverlay.classList.add('hidden');
    if (confirmResolver) { confirmResolver(result); confirmResolver = null; }
  }

  confirmCancel.addEventListener('click', () => closeConfirm(false));
  confirmBackdrop.addEventListener('click', () => closeConfirm(false));
  confirmOk.addEventListener('click', () => closeConfirm(true));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !confirmOverlay.classList.contains('hidden')) {
      closeConfirm(false);
    }
  });

  // ===== Utils =====
  function containsUrl(text) {
    return /https?:\/\/[^\s]+/.test(text);
  }

  function linkify(rawText) {
    const parts = [];
    let lastIndex = 0;
    const regex = /https?:\/\/[^\s]+/g;
    let match;

    while ((match = regex.exec(rawText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(escapeHtml(rawText.slice(lastIndex, match.index)));
      }
      const url = match[0];
      parts.push(`<a class="message-link" data-url="${encodeURI(url)}">${escapeHtml(url)}</a>`);
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < rawText.length) {
      parts.push(escapeHtml(rawText.slice(lastIndex)));
    }

    return parts.join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== Event Listeners =====
  sendBtn.addEventListener('click', () => {
    addMessage(messageInput.value);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.focus();
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addMessage(messageInput.value);
      messageInput.value = '';
      messageInput.style.height = 'auto';
    }
  });

  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
  });

  document.querySelectorAll('.footer-link').forEach((link) => {
    link.addEventListener('click', () => window.api.openExternal(link.dataset.url));
  });

  searchInput.addEventListener('input', renderSidebar);
  themeToggle.addEventListener('click', toggleTheme);
  newProjectBtn.addEventListener('click', createProject);

  $('#export-btn').addEventListener('click', async () => {
    await window.api.exportData();
  });

  $('#import-btn').addEventListener('click', async () => {
    const confirmed = await showConfirm(
      'Import data?',
      'This will replace all your current projects and tasks.',
      'Import'
    );
    if (!confirmed) return;

    const imported = await window.api.importData();
    if (imported) {
      data = imported;
      activeProjectId = null;
      renderSidebar();
      renderChat();
    }
  });

  starredBtn.addEventListener('click', () => {
    showingStarred = !showingStarred;
    starredBtn.classList.toggle('active', showingStarred);
    if (showingStarred) {
      activeProjectId = null;
      renderSidebar();
      renderStarredView();
    } else {
      renderSidebar();
      renderChat();
    }
  });

  function renderStarredView() {
    emptyStateEl.classList.add('hidden');
    activeChatEl.classList.remove('hidden');
    $('#input-bar').classList.add('hidden');
    chatTitleEl.textContent = 'Starred Messages';
    chatAvatarEl.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="#FFD700" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>';
    const headerLeft = chatAvatarEl.parentElement;
    headerLeft.className = 'chat-header-left';
    headerLeft.onclick = null;

    const allStarred = [];
    for (const project of data.projects) {
      for (const msg of project.messages) {
        if (msg.starred) {
          allStarred.push({ msg, projectName: project.name, projectId: project.id });
        }
      }
    }

    chatCountEl.textContent = allStarred.length + ' starred';
    messagesEl.innerHTML = '';

    if (allStarred.length === 0) {
      messagesEl.innerHTML = '<div class="starred-empty">No starred messages yet.<br>Right-click a message to star it.</div>';
      return;
    }

    for (const { msg, projectName, projectId } of allStarred) {
      const isLink = containsUrl(msg.text);
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble starred-view' + (isLink ? ' link-bubble' : '');
      bubble.dataset.id = msg.id;

      const projectLabel = `<span class="starred-project-label">${escapeHtml(projectName)}</span>`;

      if (isLink) {
        bubble.innerHTML = `
          ${projectLabel}
          <svg class="link-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
          <span class="message-text">${linkify(msg.text)}</span>
          <span class="message-meta"><svg class="star-icon" viewBox="0 0 24 24" width="12" height="12" fill="#FFD700" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg><span class="message-time">${formatMessageTime(msg.createdAt)}</span></span>
        `;
        bubble.querySelectorAll('.message-link').forEach((a) => {
          a.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.api.openExternal(decodeURI(a.dataset.url));
          });
        });
      } else {
        bubble.innerHTML = `
          ${projectLabel}
          <span class="message-text">${escapeHtml(msg.text)}</span>
          <span class="message-meta"><svg class="star-icon" viewBox="0 0 24 24" width="12" height="12" fill="#FFD700" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg><span class="message-time">${formatMessageTime(msg.createdAt)}</span></span>
        `;
      }

      bubble.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleMessageContextMenu(projectId, msg.id);
      });

      messagesEl.appendChild(bubble);
    }
  }

  // ===== Init =====
  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  async function init() {
    data = await window.api.loadData();
    const theme = data.settings.theme || getSystemTheme();
    document.documentElement.setAttribute('data-theme', theme);
    data.settings.theme = theme;
    renderSidebar();
    renderChat();
  }

  init();
})();
