const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../src/store');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-'));
const store = createStore(path.join(dir, 'data.json'));

const created = store.saveProject({
  name: '  API  ',
  description: 'Backend servisi',
  status: 'aktif',
});
assert.strictEqual(created.projects.length, 1);
assert.strictEqual(created.projects[0].name, 'API');
assert.strictEqual(created.projects[0].color, 'slate');
assert.strictEqual(created.projects[0].pinned, false);
assert.strictEqual(created.projects[0].group, 'Genel');
const projectId = created.projects[0].id;

const grouped = store.saveProject({
  id: projectId,
  name: 'API',
  description: 'Backend servisi',
  status: 'aktif',
  color: 'teal',
  group: 'İş',
  pinned: true,
});
assert.strictEqual(grouped.projects[0].group, 'İş');
assert.strictEqual(grouped.projects[0].pinned, true);
assert.strictEqual(grouped.projects[0].color, 'teal');

const withNote = store.saveNote({
  projectId,
  title: 'Karar',
  body: 'REST kullan',
});
assert.strictEqual(withNote.notes.length, 1);

const withTask = store.saveTask({
  projectId,
  title: 'Şema çiz',
  dueDate: '2026-10-08',
  body: '<p><strong>Açıklama</strong></p><script>alert(1)</script>',
});
assert.strictEqual(withTask.tasks[0].done, false);
assert.strictEqual(withTask.tasks[0].dueDate, '2026-10-08');
assert.ok(withTask.tasks[0].body.includes('Açıklama'));
assert.ok(!withTask.tasks[0].body.toLowerCase().includes('script'));

const toggled = store.saveTask({
  id: withTask.tasks[0].id,
  projectId,
  title: 'Şema çiz',
  done: true,
  dueDate: '2026-10-08',
});
assert.strictEqual(toggled.tasks[0].done, true);
assert.ok(toggled.tasks[0].body.includes('Açıklama'));

const edited = store.saveNote({
  id: withNote.notes[0].id,
  projectId,
  title: 'Karar',
  body: 'Önce SQLite',
});
assert.strictEqual(edited.notes[0].body, 'Önce SQLite');

const cleared = store.deleteProject(projectId);
assert.strictEqual(cleared.projects.length, 0);
assert.strictEqual(cleared.notes.length, 0);
assert.strictEqual(cleared.tasks.length, 0);

assert.throws(() => store.saveProject({ name: '   ' }), /Proje adı gerekli/);
assert.throws(() => store.saveTask({ projectId: 'yok', title: 'x' }), /Proje bulunamadı/);

const reloaded = createStore(path.join(dir, 'data.json')).load();
assert.strictEqual(reloaded.projects.length, 0);

console.log('store tests passed');
