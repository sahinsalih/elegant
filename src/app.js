const GROUPS = ['İş', 'Özel', 'Genel'];
const GROUP_KEYS = { 'İş': 'group.work', 'Özel': 'group.personal', 'Genel': 'group.general' };
const COLOR_IDS = ['slate', 'blue', 'teal', 'green', 'amber', 'red', 'purple'];
const STATUS_IDS = ['aktif', 'beklemede', 'tamamlandi'];

const prefs = {
  theme: 'system',
  locale: 'tr',
  version: '1.0.2',
};

function statusLabel(status) {
  return t(`status.${status}`);
}

function groupLabel(name) {
  return t(GROUP_KEYS[name] || 'group.general');
}

function projectColors() {
  return COLOR_IDS.map((id) => ({ id, label: t(`color.${id}`) }));
}

function loadPanels() {
  try {
    const saved = JSON.parse(localStorage.getItem('devdesk.panels') || '{}');
    return {
      notes: saved.notes !== false,
      tasks: saved.tasks !== false,
    };
  } catch {
    return { notes: true, tasks: true };
  }
}

const state = {
  data: { projects: [], notes: [], tasks: [] },
  selectedId: localStorage.getItem('devdesk.selected'),
  query: '',
  taskFilter: 'open',
  panels: loadPanels(),
};

let modalSubmit = null;
let toastTimer = 0;

const els = {
  list: document.getElementById('project-list'),
  empty: document.getElementById('empty'),
  workspace: document.getElementById('workspace'),
  head: document.getElementById('project-head'),
  boards: document.getElementById('boards'),
  notesPanel: document.getElementById('notes-panel'),
  tasksPanel: document.getElementById('tasks-panel'),
  notes: document.getElementById('notes-list'),
  tasks: document.getElementById('tasks-list'),
  notesCount: document.getElementById('notes-count'),
  tasksCount: document.getElementById('tasks-count'),
  progress: document.getElementById('task-progress'),
  filters: document.getElementById('task-filters'),
  search: document.getElementById('project-search'),
  modal: document.getElementById('modal'),
  modalForm: document.getElementById('modal-form'),
  modalTitle: document.getElementById('modal-title'),
  modalCopy: document.getElementById('modal-copy'),
  modalFields: document.getElementById('modal-fields'),
  modalSubmit: document.getElementById('modal-submit'),
  modalDelete: document.getElementById('modal-delete'),
  toast: document.getElementById('toast'),
  settings: document.getElementById('settings-modal'),
  settingsLocale: document.getElementById('setting-locale'),
  themeOptions: document.getElementById('theme-options'),
  appVersion: document.getElementById('app-version'),
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 3400);
}

function todayISO() {
  const date = new Date();
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatStamp(iso) {
  return new Intl.DateTimeFormat(getLocale() === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatDue(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

function selectedProject() {
  return state.data.projects.find((project) => project.id === state.selectedId) || null;
}

function ensureSelection() {
  const exists = state.data.projects.some((project) => project.id === state.selectedId);
  if (exists) return;
  state.selectedId = state.data.projects[0]?.id ?? null;
  if (state.selectedId) localStorage.setItem('devdesk.selected', state.selectedId);
  else localStorage.removeItem('devdesk.selected');
}

function selectProject(id) {
  state.selectedId = id;
  localStorage.setItem('devdesk.selected', id);
  render();
}

function projectCounts(projectId) {
  const notes = state.data.notes.filter((note) => note.projectId === projectId).length;
  const tasks = state.data.tasks.filter((task) => task.projectId === projectId);
  const open = tasks.filter((task) => !task.done).length;
  return { notes, total: tasks.length, open };
}

function errorMessage(error) {
  const raw = error?.message || t('error.generic');
  const match = raw.match(/Error invoking remote method '[^']+':\s*(?:Error:\s*)?([\s\S]*)$/);
  return match ? match[1] : raw;
}

async function run(action) {
  try {
    state.data = await action();
    ensureSelection();
    render();
    return true;
  } catch (error) {
    toast(errorMessage(error));
    render();
    return false;
  }
}

function initial(name) {
  const char = String(name || '').trim().charAt(0);
  return char ? char.toLocaleUpperCase('tr') : '·';
}

function setPanel(name, open) {
  state.panels[name] = open;
  localStorage.setItem('devdesk.panels', JSON.stringify(state.panels));
  applyPanels();
}

function applyPanels() {
  const notesOpen = state.panels.notes !== false;
  const tasksOpen = state.panels.tasks !== false;
  els.notesPanel.classList.toggle('is-collapsed', !notesOpen);
  els.tasksPanel.classList.toggle('is-collapsed', !tasksOpen);
  els.boards.classList.toggle('notes-collapsed', !notesOpen);
  els.boards.classList.toggle('tasks-collapsed', !tasksOpen);

  for (const [name, open] of [['notes', notesOpen], ['tasks', tasksOpen]]) {
    const button = document.querySelector(`[data-panel="${name}"]`);
    button.textContent = open ? t('panel.hide') : t('panel.show');
    button.setAttribute('aria-expanded', String(open));
  }
}

function render() {
  ensureSelection();
  renderProjects();
  applyPanels();
  const project = selectedProject();
  document.title = project ? `${project.name} — Elegant` : 'Elegant';
  els.empty.hidden = Boolean(project);
  els.workspace.hidden = !project;
  if (!project) return;
  renderHead(project);
  renderNotes(project);
  renderTasks(project);
}

function colorOf(project) {
  const palette = ['blue', 'teal', 'green', 'amber', 'red', 'purple'];
  if (palette.includes(project.color) || project.color === 'slate') return project.color;
  const seed = String(project.id || project.name);
  const index = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

function pinButton(project) {
  const on = Boolean(project.pinned);
  return `
    <button type="button" class="pin${on ? ' is-on' : ''}" data-action="pin" data-id="${esc(project.id)}" aria-pressed="${on}" aria-label="${on ? t('pin.on') : t('pin.off')}" title="${on ? t('pin.on') : t('pin.off')}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5"></path><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path></svg>
    </button>
  `;
}

function projectRow(project) {
  const counts = projectCounts(project.id);
  const active = project.id === state.selectedId ? ' is-active' : '';
  const count = counts.open
    ? `<span class="project-count"><span>${counts.open}</span></span>`
    : '';
  return `
    <div class="project-item${active}" data-id="${esc(project.id)}" role="listitem" tabindex="0">
      <span class="avatar color-${esc(colorOf(project))}"><span>${esc(initial(project.name))}</span></span>
      <span class="project-copy">
        <span class="project-name">${esc(project.name)}</span>
        <span class="project-meta">${esc(statusLabel(project.status))} · ${counts.notes} ${esc(t('meta.notes'))}</span>
      </span>
      ${count}
      ${pinButton(project)}
    </div>
  `;
}

function groupOf(project) {
  return GROUPS.includes(project.group) ? project.group : 'Genel';
}

function projectSections(projects) {
  const pinned = projects.filter((project) => project.pinned);
  const rest = projects.filter((project) => !project.pinned);
  return {
    pinned,
    named: GROUPS
      .map((name) => ({
        name,
        projects: rest.filter((project) => groupOf(project) === name),
      }))
      .filter((group) => group.projects.length),
  };
}

function renderProjects() {
  const query = state.query.trim().toLocaleLowerCase('tr');
  const projects = state.data.projects.filter((project) => (
    project.name.toLocaleLowerCase('tr').includes(query)
      || String(project.group || '').toLocaleLowerCase('tr').includes(query)
  ));

  if (!projects.length) {
    els.list.innerHTML = `<p class="blank">${state.data.projects.length ? esc(t('list.noMatch')) : esc(t('list.none'))}</p>`;
    return;
  }

  const sections = projectSections(projects);
  const parts = [];
  if (sections.pinned.length) {
    parts.push(`<section class="project-group"><h3 class="group-label">${esc(t('group.pinned'))}</h3>${sections.pinned.map(projectRow).join('')}</section>`);
  }
  sections.named.forEach((group) => {
    parts.push(`<section class="project-group"><h3 class="group-label">${esc(groupLabel(group.name))}</h3>${group.projects.map(projectRow).join('')}</section>`);
  });
  els.list.innerHTML = parts.join('');
}

function renderHead(project) {
  const description = project.description
    ? `<p class="description">${esc(project.description)}</p>`
    : '';
  els.head.dataset.color = colorOf(project);
  els.head.innerHTML = `
    <div class="head-copy">
      <div class="head-line">
        <h2>${esc(project.name)}</h2>
        <span class="badge">${esc(statusLabel(project.status))}</span>
      </div>
      ${description}
    </div>
    <button type="button" class="settings-button" data-action="project-settings" aria-label="${esc(t('project.settings'))}" title="${esc(t('project.settings'))}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
  `;
}

function renderNotes(project) {
  const notes = state.data.notes
    .filter((note) => note.projectId === project.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  els.notesCount.textContent = notes.length ? String(notes.length) : '';

  if (!notes.length) {
    els.notes.innerHTML = `<p class="blank">${esc(t('notes.empty'))}</p>`;
    return;
  }

  els.notes.innerHTML = notes.map((note) => `
    <article class="note">
      <div class="note-top">
        <h3>${esc(note.title)}</h3>
      </div>
      ${richHtml(note.body)}
      <time datetime="${esc(note.updatedAt)}">${esc(formatStamp(note.updatedAt))}</time>
      ${rowMenu('note', note.id)}
    </article>
  `).join('');
}

function renderTasks(project) {
  const all = state.data.tasks.filter((task) => task.projectId === project.id);
  const done = all.filter((task) => task.done).length;
  const open = all.length - done;
  const ratio = all.length ? Math.round((done / all.length) * 100) : 0;
  els.tasksCount.textContent = all.length ? `${open} açık` : '';
  els.progress.hidden = !all.length;
  els.progress.innerHTML = all.length ? `<span style="width:${ratio}%"></span>` : '';

  for (const button of els.filters.querySelectorAll('button')) {
    button.classList.toggle('is-on', button.dataset.filter === state.taskFilter);
  }

  const tasks = all
    .filter((task) => {
      if (state.taskFilter === 'open') return !task.done;
      if (state.taskFilter === 'done') return task.done;
      return true;
    })
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const aDue = a.dueDate || '9999-99-99';
      const bDue = b.dueDate || '9999-99-99';
      if (aDue !== bDue) return aDue.localeCompare(bDue);
      return b.createdAt.localeCompare(a.createdAt);
    });

  if (!tasks.length) {
    const message = state.taskFilter === 'open' && all.length
      ? t('tasks.emptyOpen')
      : t('tasks.empty');
    els.tasks.innerHTML = `<p class="blank">${message}</p>`;
    return;
  }

  const today = todayISO();
  els.tasks.innerHTML = tasks.map((task) => {
    const overdue = Boolean(task.dueDate && !task.done && task.dueDate < today);
    const classes = ['task', task.done ? 'is-done' : '', overdue ? 'is-overdue' : ''].filter(Boolean).join(' ');
    const due = task.dueDate
      ? `<span class="task-due">${overdue ? `${esc(t('tasks.overdue'))} · ` : ''}${esc(formatDue(task.dueDate))}</span>`
      : '';
    return `
      <div class="${classes}">
        <span class="tickbox">
          <input type="checkbox" data-action="toggle" data-id="${esc(task.id)}" ${task.done ? 'checked' : ''} aria-label="${esc(t('tasks.done', { title: task.title }))}" />
          <svg class="tick" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.25 6.4 11.15 12.5 5"></path></svg>
        </span>
        <div class="task-main">
          <span class="task-title">${esc(task.title)}</span>
          ${due}
          ${richHtml(task.body)}
        </div>
        ${rowMenu('task', task.id)}
      </div>
    `;
  }).join('');
}

function rowMenu(kind, id) {
  return `
    <div class="row-menu">
      <button type="button" class="more" data-action="menu" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t('menu.actions'))}" title="${esc(t('menu.actions'))}">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="3.25" r="1.15"></circle>
          <circle cx="8" cy="8" r="1.15"></circle>
          <circle cx="8" cy="12.75" r="1.15"></circle>
        </svg>
      </button>
      <div class="menu" role="menu" hidden>
        <button type="button" role="menuitem" data-action="edit-${kind}" data-id="${esc(id)}">${esc(t('menu.edit'))}</button>
        <button type="button" role="menuitem" data-action="delete-${kind}" data-id="${esc(id)}">${esc(t('menu.delete'))}</button>
      </div>
    </div>
  `;
}

function closeRowMenus() {
  document.querySelectorAll('.row-menu').forEach((wrap) => {
    const menu = wrap.querySelector('.menu');
    menu.hidden = true;
    menu.classList.remove('is-up');
    wrap.querySelector('[data-action="menu"]').setAttribute('aria-expanded', 'false');
  });
}

function toggleRowMenu(button) {
  const menu = button.parentElement.querySelector('.menu');
  const shouldOpen = menu.hidden;
  closeRowMenus();
  if (!shouldOpen) return;
  menu.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  const panel = button.closest('.panel-body').getBoundingClientRect();
  const box = menu.getBoundingClientRect();
  if (box.bottom > panel.bottom - 4) menu.classList.add('is-up');
}

function openModal({ title, copy, submitLabel, fields, danger, showDelete, onSubmit }) {
  modalSubmit = onSubmit;
  els.modalTitle.textContent = title;
  els.modalCopy.hidden = !copy;
  els.modalCopy.textContent = copy || '';
  els.modalSubmit.textContent = submitLabel;
  els.modalSubmit.classList.add('primary');
  els.modalSubmit.classList.toggle('danger', Boolean(danger));
  els.modalDelete.hidden = !showDelete;
  els.modalDelete.textContent = t('project.delete');
  els.modalForm.querySelector('[data-close]').textContent = t('cancel');
  els.modalFields.innerHTML = fields.map((field) => fieldHtml(field)).join('');
  els.modalForm.classList.toggle('is-wide', fields.some((field) => field.type === 'richtext'));
  mountEditors(fields);
  els.modal.hidden = false;
  const first = els.modalFields.querySelector('input, textarea, select');
  (first || els.modalSubmit).focus();
}

const RICH_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'H3', 'BLOCKQUOTE', 'A']);

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

function sanitizeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const clean = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        return;
      }
      clean(child);
      if (!RICH_TAGS.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        return;
      }
      [...child.attributes].forEach((attr) => {
        const keepLink = child.tagName === 'A' && attr.name === 'href' && /^(https?:|mailto:)/i.test(attr.value);
        if (!keepLink) child.removeAttribute(attr.name);
      });
      if (child.tagName === 'A') {
        child.setAttribute('rel', 'noreferrer noopener');
        child.setAttribute('target', '_blank');
      }
    });
  };
  clean(template.content);
  return template.innerHTML.trim();
}

function richHtml(value) {
  const raw = String(value || '');
  if (!raw.trim()) return '';
  const html = looksLikeHtml(raw) ? raw : esc(raw).replace(/\n/g, '<br>');
  return `<div class="rich">${sanitizeHtml(html)}</div>`;
}

function icon(path) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"></path></svg>`;
}

function editorField(name) {
  const tools = [
    ['bold', t('editor.bold'), 'M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8'],
    ['italic', t('editor.italic'), 'M19 4h-9M14 20H5M15 4 9 20'],
    ['underline', t('editor.underline'), 'M6 4v6a6 6 0 0 0 12 0V4M4 20h16'],
    ['formatBlock', t('editor.heading'), 'M4 12h8M4 18V6M12 18V6M17.5 10.5v7M17.5 10.5c0-1.5 1.2-2.5 2.7-2.5', 'h3'],
    ['insertUnorderedList', t('editor.bullets'), 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
    ['insertOrderedList', t('editor.numbers'), 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1'],
    ['formatBlock', t('editor.quote'), 'M7 17c1.5-1 2-2.2 2-4V7H5v6h3M17 17c1.5-1 2-2.2 2-4V7h-4v6h3', 'blockquote'],
    ['link', t('editor.link'), 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
    ['removeFormat', t('editor.clear'), 'M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12'],
  ].map(([command, label, path, value]) => (
    `<button type="button" data-cmd="${command}" ${value ? `data-value="${value}"` : ''} title="${label}" aria-label="${label}">${icon(path)}</button>`
  )).join('');

  return `
    <div class="editor" data-rich data-name="${esc(name)}">
      <div class="editor-bar" role="toolbar" aria-label="${esc(t('editor.toolbar'))}">${tools}</div>
      <div class="editor-link" hidden>
        <input type="url" placeholder="https://ornek.com" autocomplete="off" aria-label="${esc(t('editor.url'))}" />
        <button type="button" class="ghost" data-editor="apply-link">${esc(t('add'))}</button>
        <button type="button" class="ghost" data-editor="cancel-link">${esc(t('cancel'))}</button>
      </div>
      <div class="editor-surface is-empty" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="${esc(t('editor.placeholder'))}"></div>
    </div>
  `;
}

function fieldHtml(field) {
  const id = `field-${field.name}`;
  if (field.type === 'checkbox') {
    return `<label class="check-field"><input type="checkbox" name="${esc(field.name)}" value="1"${field.value ? ' checked' : ''} /><span>${esc(field.label)}</span></label>`;
  }
  if (field.type === 'colors') {
    const selected = field.value || 'slate';
    const options = projectColors().map((color) => `
      <label class="swatch-option" title="${esc(color.label)}">
        <input type="radio" name="color" value="${esc(color.id)}" ${color.id === selected ? 'checked' : ''} />
        <span class="swatch" data-color="${esc(color.id)}"></span>
        <span class="sr-only">${esc(color.label)}</span>
      </label>
    `).join('');
    return `<div class="editor-field"><span class="field-label">${esc(field.label)}</span><div class="swatches" role="radiogroup" aria-label="${esc(field.label)}">${options}</div></div>`;
  }
  if (field.type === 'richtext') {
    return `<div class="editor-field"><span class="field-label">${esc(field.label)}</span>${editorField(field.name)}</div>`;
  }
  if (field.type === 'textarea') {
    return `<label for="${id}">${esc(field.label)}<textarea id="${id}" name="${esc(field.name)}">${esc(field.value || '')}</textarea></label>`;
  }
  if (field.type === 'select') {
    const options = field.options.map((option) => (
      `<option value="${esc(option.value)}"${option.value === field.value ? ' selected' : ''}>${esc(option.label)}</option>`
    )).join('');
    return `<label for="${id}">${esc(field.label)}<select id="${id}" name="${esc(field.name)}">${options}</select></label>`;
  }
  const required = field.required ? ' required' : '';
  const placeholder = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : '';
  return `<label for="${id}">${esc(field.label)}<input id="${id}" name="${esc(field.name)}" type="${esc(field.type || 'text')}" value="${esc(field.value || '')}"${placeholder}${required} /></label>`;
}

let editorRange = null;

function mountEditors(fields) {
  const richFields = fields.filter((field) => field.type === 'richtext');
  els.modalFields.querySelectorAll('[data-rich]').forEach((editor, index) => {
    const surface = editor.querySelector('.editor-surface');
    const value = String(richFields[index]?.value || '');
    if (!value) surface.innerHTML = '';
    else if (looksLikeHtml(value)) surface.innerHTML = sanitizeHtml(value);
    else surface.innerHTML = esc(value).replace(/\n/g, '<br>');
    markEditorEmpty(surface);
  });
}

function markEditorEmpty(surface) {
  const empty = !surface.textContent.replace(/\u00a0/g, ' ').trim();
  surface.classList.toggle('is-empty', empty);
}

function readEditor(editor) {
  const surface = editor.querySelector('.editor-surface');
  if (!surface.textContent.replace(/\u00a0/g, ' ').trim()) return '';
  return sanitizeHtml(surface.innerHTML);
}

function saveEditorRange() {
  const selection = document.getSelection();
  if (selection && selection.rangeCount && selection.anchorNode?.parentElement?.closest('.editor-surface')) {
    editorRange = selection.getRangeAt(0).cloneRange();
  }
}

function restoreEditorRange(surface) {
  surface.focus();
  if (!editorRange) return;
  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(editorRange);
}

function applyEditorLink(editor) {
  const input = editor.querySelector('.editor-link input');
  let url = input.value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) url = `https://${url}`;
  const surface = editor.querySelector('.editor-surface');
  restoreEditorRange(surface);
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed) document.execCommand('insertText', false, url);
  document.execCommand('createLink', false, url);
  editor.querySelector('.editor-link').hidden = true;
  input.value = '';
  markEditorEmpty(surface);
}

function syncEditorTools(surface) {
  const bar = surface.closest('[data-rich]')?.querySelector('.editor-bar');
  if (!bar) return;
  bar.querySelectorAll('[data-cmd]').forEach((button) => {
    const command = button.dataset.cmd;
    let active = false;
    try {
      if (command === 'formatBlock') {
        active = document.queryCommandValue('formatBlock').toLowerCase() === button.dataset.value;
      } else if (command !== 'link' && command !== 'removeFormat') {
        active = document.queryCommandState(command);
      }
    } catch {
      active = false;
    }
    button.classList.toggle('is-on', active);
  });
}

function closeModal() {
  els.modal.hidden = true;
  modalSubmit = null;
  els.modalForm.classList.remove('is-wide');
  els.modalDelete.hidden = true;
  els.modalForm.reset();
  editorRange = null;
}

function projectFields(project) {
  return [
    { name: 'name', label: t('project.name'), type: 'text', value: project?.name || '', required: true },
    { name: 'description', label: t('project.description'), type: 'textarea', value: project?.description || '' },
    {
      name: 'status',
      label: t('project.status'),
      type: 'select',
      value: project?.status || 'aktif',
      options: STATUS_IDS.map((value) => ({ value, label: statusLabel(value) })),
    },
    { name: 'color', label: t('project.color'), type: 'colors', value: project ? colorOf(project) : 'blue' },
    {
      name: 'group',
      label: t('project.group'),
      type: 'select',
      value: project ? groupOf(project) : 'Genel',
      options: GROUPS.map((name) => ({ value: name, label: groupLabel(name) })),
    },
    { name: 'pinned', label: t('project.pin'), type: 'checkbox', value: Boolean(project?.pinned) },
  ];
}

function openProjectModal(project, options = {}) {
  openModal({
    title: options.settings ? t('project.settings') : t('project.new'),
    submitLabel: t('save'),
    showDelete: Boolean(options.settings),
    fields: projectFields(project),
    onSubmit: async (data) => {
      const known = new Set(state.data.projects.map((item) => item.id));
      const ok = await run(() => window.desk.saveProject({
        id: project?.id,
        name: data.get('name'),
        description: data.get('description'),
        status: data.get('status'),
        color: data.get('color'),
        group: data.get('group'),
        pinned: data.get('pinned') === '1',
      }));
      if (ok && !project) {
        const created = state.data.projects.find((item) => !known.has(item.id));
        if (created) selectProject(created.id);
      }
      return ok;
    },
  });
}

function openNoteModal(note) {
  const project = selectedProject();
  if (!project) return;
  if (!state.panels.notes) setPanel('notes', true);
  openModal({
    title: note ? t('notes.edit') : t('notes.new'),
    submitLabel: note ? t('update') : t('add'),
    fields: [
      { name: 'title', label: t('notes.fieldTitle'), type: 'text', value: note?.title || '', required: true },
      { name: 'body', label: t('notes.fieldBody'), type: 'richtext', value: note?.body || '' },
    ],
    onSubmit: (data) => run(() => window.desk.saveNote({
      id: note?.id,
      projectId: project.id,
      title: data.get('title'),
      body: data.get('body'),
    })),
  });
}

function openTaskModal(task) {
  const project = selectedProject();
  if (!project) return;
  if (!state.panels.tasks) setPanel('tasks', true);
  openModal({
    title: task ? t('tasks.edit') : t('tasks.new'),
    submitLabel: task ? t('update') : t('add'),
    fields: [
      { name: 'title', label: t('tasks.fieldTitle'), type: 'text', value: task?.title || '', required: true },
      { name: 'dueDate', label: t('tasks.due'), type: 'date', value: task?.dueDate || '' },
      { name: 'body', label: t('tasks.body'), type: 'richtext', value: task?.body || '' },
    ],
    onSubmit: (data) => run(() => window.desk.saveTask({
      id: task?.id,
      projectId: project.id,
      title: data.get('title'),
      done: Boolean(task?.done),
      dueDate: data.get('dueDate'),
      body: data.get('body'),
    })),
  });
}

function confirmDelete({ title, copy, onSubmit }) {
  openModal({
    title,
    copy,
    submitLabel: t('delete'),
    danger: true,
    fields: [],
    onSubmit,
  });
}

async function togglePin(id) {
  const project = state.data.projects.find((item) => item.id === id);
  if (!project) return;
  await run(() => window.desk.saveProject({
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    color: colorOf(project),
    group: groupOf(project),
    pinned: !project.pinned,
  }));
}

els.list.addEventListener('click', (event) => {
  const pin = event.target.closest('[data-action="pin"]');
  if (pin) {
    togglePin(pin.dataset.id);
    return;
  }
  const item = event.target.closest('.project-item');
  if (!item) return;
  selectProject(item.dataset.id);
});

els.list.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (event.target.closest('[data-action="pin"]')) return;
  const item = event.target.closest('.project-item');
  if (!item) return;
  event.preventDefault();
  selectProject(item.dataset.id);
});

els.search.addEventListener('input', () => {
  state.query = els.search.value;
  renderProjects();
});

document.getElementById('new-project').addEventListener('click', () => openProjectModal());
document.getElementById('empty-new-project').addEventListener('click', () => openProjectModal());

els.workspace.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const project = selectedProject();
  if (!project) return;
  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === 'toggle-panel') {
    const name = target.dataset.panel;
    setPanel(name, !state.panels[name]);
    return;
  }
  if (action === 'filter') {
    state.taskFilter = target.dataset.filter;
    renderTasks(project);
    return;
  }
  if (action === 'menu') {
    toggleRowMenu(target);
    return;
  }
  if (action.startsWith('edit-') || action.startsWith('delete-')) closeRowMenus();
  if (action === 'project-settings') return openProjectModal(project, { settings: true });
  if (action === 'add-note') return openNoteModal();
  if (action === 'edit-note') return openNoteModal(state.data.notes.find((note) => note.id === id));
  if (action === 'add-task') return openTaskModal();
  if (action === 'edit-task') return openTaskModal(state.data.tasks.find((task) => task.id === id));

  if (action === 'delete-note') {
    const note = state.data.notes.find((item) => item.id === id);
    confirmDelete({
      title: t('notes.deleteTitle'),
      copy: note ? t('notes.deleteNamed', { title: note.title }) : t('notes.deletePlain'),
      onSubmit: () => run(() => window.desk.deleteNote(id)),
    });
  }
  if (action === 'delete-task') {
    const task = state.data.tasks.find((item) => item.id === id);
    confirmDelete({
      title: t('tasks.deleteTitle'),
      copy: task ? t('tasks.deleteNamed', { title: task.title }) : t('tasks.deletePlain'),
      onSubmit: () => run(() => window.desk.deleteTask(id)),
    });
  }
});

els.workspace.addEventListener('change', (event) => {
  const box = event.target.closest('input[data-action="toggle"]');
  if (!box) return;
  const project = selectedProject();
  const task = state.data.tasks.find((item) => item.id === box.dataset.id);
  if (!project || !task) return;
  run(() => window.desk.saveTask({
    id: task.id,
    projectId: project.id,
    title: task.title,
    done: box.checked,
    dueDate: task.dueDate,
  }));
});

els.modalFields.addEventListener('mousedown', (event) => {
  if (event.target.closest('.editor-bar button')) {
    saveEditorRange();
    event.preventDefault();
  }
});

els.modalFields.addEventListener('click', (event) => {
  const command = event.target.closest('[data-cmd]');
  const editorAction = event.target.closest('[data-editor]');
  const editor = event.target.closest('[data-rich]');
  if (!editor) return;
  const surface = editor.querySelector('.editor-surface');

  if (command) {
    if (command.dataset.cmd === 'link') {
      saveEditorRange();
      const linkRow = editor.querySelector('.editor-link');
      linkRow.hidden = false;
      linkRow.querySelector('input').focus();
      return;
    }
    surface.focus();
    document.execCommand(command.dataset.cmd, false, command.dataset.value || null);
    markEditorEmpty(surface);
    syncEditorTools(surface);
    return;
  }

  if (editorAction?.dataset.editor === 'apply-link') applyEditorLink(editor);
  if (editorAction?.dataset.editor === 'cancel-link') {
    editor.querySelector('.editor-link').hidden = true;
    surface.focus();
  }
});

els.modalFields.addEventListener('input', (event) => {
  if (event.target.classList.contains('editor-surface')) markEditorEmpty(event.target);
});

els.modalFields.addEventListener('keyup', (event) => {
  if (event.target.classList.contains('editor-surface')) {
    markEditorEmpty(event.target);
    syncEditorTools(event.target);
  }
});

els.modalFields.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.closest('.editor-link input')) {
    event.preventDefault();
    applyEditorLink(event.target.closest('[data-rich]'));
  }
});

document.addEventListener('selectionchange', () => {
  const node = document.getSelection()?.anchorNode;
  const surface = node?.parentElement?.closest?.('.editor-surface') || node?.closest?.('.editor-surface');
  if (surface) syncEditorTools(surface);
});

els.modalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!modalSubmit) return;
  const data = new FormData(els.modalForm);
  els.modalFields.querySelectorAll('[data-rich]').forEach((editor) => {
    data.set(editor.dataset.name, readEditor(editor));
  });
  els.modalSubmit.disabled = true;
  const ok = await modalSubmit(data);
  els.modalSubmit.disabled = false;
  if (ok) closeModal();
});

els.modal.addEventListener('click', (event) => {
  if (event.target.closest('[data-settings-delete]')) {
    const project = selectedProject();
    if (!project) return;
    closeModal();
    confirmDelete({
      title: t('project.deleteTitle'),
      copy: t('project.deleteCopy', { name: project.name }),
      onSubmit: () => run(() => window.desk.deleteProject(project.id)),
    });
    return;
  }
  if (event.target.closest('[data-close]')) closeModal();
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.row-menu')) closeRowMenus();
});

function readLocalPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem('elegant.settings') || '{}');
    if (saved.locale === 'en' || saved.locale === 'tr') prefs.locale = saved.locale;
    if (['system', 'light', 'dark'].includes(saved.theme)) prefs.theme = saved.theme;
  } catch {
    // Kaydedilmiş ayar okunamazsa varsayılanlar kullanılır.
  }
}

function paintSettings() {
  els.settingsLocale.value = prefs.locale;
  els.themeOptions.querySelectorAll('[data-theme-value]').forEach((button) => {
    const on = button.dataset.themeValue === prefs.theme;
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-checked', String(on));
  });
  els.appVersion.textContent = t('settings.version', { version: prefs.version });
}

function openSettings() {
  paintSettings();
  els.settings.hidden = false;
  els.settingsLocale.focus();
}

function closeSettings() {
  els.settings.hidden = true;
}

async function updatePrefs(partial) {
  try {
    const next = await window.desk.saveSettings({
      theme: partial.theme || prefs.theme,
      locale: partial.locale || prefs.locale,
    });
    prefs.theme = next.theme;
    prefs.locale = next.locale;
    localStorage.setItem('elegant.settings', JSON.stringify({ theme: next.theme, locale: next.locale }));
    setLocale(next.locale);
    applyChrome();
    paintSettings();
    render();
  } catch (error) {
    paintSettings();
    toast(errorMessage(error));
  }
}

document.getElementById('open-settings').addEventListener('click', () => openSettings());

els.settingsLocale.addEventListener('change', () => {
  updatePrefs({ locale: els.settingsLocale.value });
});

els.themeOptions.addEventListener('click', (event) => {
  const button = event.target.closest('[data-theme-value]');
  if (!button || button.dataset.themeValue === prefs.theme) return;
  updatePrefs({ theme: button.dataset.themeValue });
});

els.settings.addEventListener('click', (event) => {
  if (event.target.closest('[data-settings-close]')) closeSettings();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !els.settings.hidden) {
    closeSettings();
    return;
  }
  if (event.key === 'Escape' && !els.modal.hidden) {
    closeModal();
    return;
  }
  if (event.key === 'Escape') closeRowMenus();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n' && els.modal.hidden && els.settings.hidden) {
    event.preventDefault();
    openProjectModal();
  }
});

async function boot() {
  try {
    const [settings, version] = await Promise.all([
      window.desk.getSettings(),
      window.desk.version(),
    ]);
    prefs.theme = settings.theme;
    prefs.locale = settings.locale;
    prefs.version = version || prefs.version;
    localStorage.setItem('elegant.settings', JSON.stringify({ theme: settings.theme, locale: settings.locale }));
    setLocale(settings.locale);
  } catch {
    // Ayarlar okunamazsa yerel tercih ve varsayılan sürüm kullanılır.
  }
  applyChrome();
  paintSettings();
  await run(() => window.desk.load());
}

readLocalPrefs();
setLocale(prefs.locale);
applyChrome();
boot();
