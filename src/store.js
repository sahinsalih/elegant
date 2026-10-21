const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATUSES = ['aktif', 'beklemede', 'tamamlandi'];
const COLORS = ['slate', 'blue', 'teal', 'green', 'amber', 'red', 'purple'];
const GROUPS = ['İş', 'Özel', 'Genel'];

function emptyData() {
  return { version: 1, projects: [], notes: [], tasks: [] };
}

function validation(message) {
  const error = new Error(message);
  error.code = 'VALIDATION';
  return error;
}

function clean(value, max, label) {
  const text = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if (text.length > max) {
    throw validation(`${label} en fazla ${max} karakter olabilir.`);
  }
  return text;
}

function now() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function sortProjects(projects) {
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function touchProject(data, projectId) {
  const project = data.projects.find((item) => item.id === projectId);
  if (project) project.updatedAt = now();
}

function requireProject(data, projectId) {
  if (!data.projects.some((item) => item.id === projectId)) {
    throw validation('Proje bulunamadı.');
  }
}

function createStore(filePath) {
  function read() {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.projects)) return emptyData();
      return {
        version: 1,
        projects: data.projects,
        notes: Array.isArray(data.notes) ? data.notes : [],
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
      };
    } catch (error) {
      if (error.code === 'ENOENT') return emptyData();
      try {
        fs.copyFileSync(filePath, `${filePath}.bak`);
      } catch {
        // Bozuk dosya yedeklenemezse boş veri ile devam edilir.
      }
      return emptyData();
    }
  }

  function write(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.rmSync(filePath, { force: true });
    fs.renameSync(tmp, filePath);
  }

  function commit(mutator) {
    const data = read();
    mutator(data);
    sortProjects(data.projects);
    write(data);
    return data;
  }

  return {
    load: read,

    saveProject(input) {
      const name = clean(input?.name, 120, 'Proje adı');
      if (!name) throw validation('Proje adı gerekli.');
      const description = clean(input?.description, 2000, 'Açıklama');
      const status = STATUSES.includes(input?.status) ? input.status : 'aktif';
      const color = COLORS.includes(input?.color) ? input.color : 'slate';
      const group = GROUPS.includes(input?.group) ? input.group : 'Genel';
      const pinned = Boolean(input?.pinned);

      return commit((data) => {
        if (input?.id) {
          const project = data.projects.find((item) => item.id === input.id);
          if (!project) throw validation('Proje bulunamadı.');
          project.name = name;
          project.description = description;
          project.status = status;
          project.color = color;
          project.group = group;
          project.pinned = pinned;
          project.updatedAt = now();
          return;
        }

        const stamp = now();
        data.projects.push({
          id: newId(),
          name,
          description,
          status,
          color,
          group,
          pinned,
          createdAt: stamp,
          updatedAt: stamp,
        });
      });
    },

    deleteProject(id) {
      if (!id) throw validation('Proje bulunamadı.');
      return commit((data) => {
        const before = data.projects.length;
        data.projects = data.projects.filter((item) => item.id !== id);
        if (data.projects.length === before) throw validation('Proje bulunamadı.');
        data.notes = data.notes.filter((item) => item.projectId !== id);
        data.tasks = data.tasks.filter((item) => item.projectId !== id);
      });
    },

    saveNote(input) {
      const projectId = String(input?.projectId ?? '');
      const title = clean(input?.title, 160, 'Not başlığı');
      const body = richText(input?.body, 'Not');
      if (!title) throw validation('Not başlığı gerekli.');

      return commit((data) => {
        requireProject(data, projectId);
        if (input?.id) {
          const note = data.notes.find((item) => item.id === input.id);
          if (!note || note.projectId !== projectId) throw validation('Not bulunamadı.');
          note.title = title;
          note.body = body;
          note.updatedAt = now();
        } else {
          const stamp = now();
          data.notes.push({
            id: newId(),
            projectId,
            title,
            body,
            createdAt: stamp,
            updatedAt: stamp,
          });
        }
        touchProject(data, projectId);
      });
    },

    deleteNote(id) {
      if (!id) throw validation('Not bulunamadı.');
      return commit((data) => {
        const note = data.notes.find((item) => item.id === id);
        if (!note) throw validation('Not bulunamadı.');
        data.notes = data.notes.filter((item) => item.id !== id);
        touchProject(data, note.projectId);
      });
    },

    saveTask(input) {
      const projectId = String(input?.projectId ?? '');
      const title = clean(input?.title, 200, 'Görev');
      if (!title) throw validation('Görev başlığı gerekli.');
      const dueDate = normalizeDueDate(input?.dueDate);
      const done = Boolean(input?.done);
      const hasBody = input != null && Object.prototype.hasOwnProperty.call(input, 'body');
      const body = hasBody ? richText(input.body, 'Açıklama') : undefined;

      return commit((data) => {
        requireProject(data, projectId);
        if (input?.id) {
          const task = data.tasks.find((item) => item.id === input.id);
          if (!task || task.projectId !== projectId) throw validation('Görev bulunamadı.');
          task.title = title;
          task.done = done;
          task.dueDate = dueDate;
          if (hasBody) task.body = body;
          task.updatedAt = now();
        } else {
          const stamp = now();
          data.tasks.push({
            id: newId(),
            projectId,
            title,
            body: body || '',
            done,
            dueDate,
            createdAt: stamp,
            updatedAt: stamp,
          });
        }
        touchProject(data, projectId);
      });
    },

    deleteTask(id) {
      if (!id) throw validation('Görev bulunamadı.');
      return commit((data) => {
        const task = data.tasks.find((item) => item.id === id);
        if (!task) throw validation('Görev bulunamadı.');
        data.tasks = data.tasks.filter((item) => item.id !== id);
        touchProject(data, task.projectId);
      });
    },
  };
}

function richText(value, label) {
  let text = clean(value, 20000, label);
  text = text.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  text = text.replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');
  text = text.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  text = text.replace(/javascript\s*:/gi, '');
  return text;
}

function normalizeDueDate(value) {
  if (value == null || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw validation('Tarih YYYY-AA-GG biçiminde olmalı.');
  }
  return text;
}

module.exports = { createStore, STATUSES, COLORS, GROUPS };
