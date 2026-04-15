// ─── State ───────────────────────────────────────────────────────────────────
let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
let editingId = null;
let dragSrcIndex = null;
let selectedRecur = 'none';

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const taskList     = document.getElementById('taskList');
const newTaskBtn   = document.getElementById('newTaskBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose   = document.getElementById('modalClose');
const modalTitle   = document.getElementById('modalTitle');
const taskNameInput = document.getElementById('taskNameInput');
const taskDescInput = document.getElementById('taskDescInput');
const taskDueInput  = document.getElementById('taskDueInput');
const btnCancel    = document.getElementById('btnCancel');
const btnSave      = document.getElementById('btnSave');
const toggleBtns   = document.querySelectorAll('.toggle-btn');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function save() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${parseInt(d)}, ${y}`;
}

function isOverdue(iso) {
  if (!iso) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  const due = new Date(iso + 'T00:00:00');
  return due < today;
}

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function addMonths(iso, months) {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function nextDueDate(task) {
  const base = task.due || new Date().toISOString().split('T')[0];
  if (task.recur === 'weekly')  return addDays(base, 7);
  if (task.recur === 'monthly') return addMonths(base, 1);
  return null;
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  if (tasks.length === 0) {
    taskList.innerHTML = `
      <li class="empty-state">
        <div class="empty-icon">✦</div>
        <div>No tasks yet. Add one above!</div>
      </li>`;
    return;
  }

  taskList.innerHTML = '';
  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');
    li.draggable = true;
    li.dataset.index = index;

    const overdueClass = (!task.completed && isOverdue(task.due)) ? ' overdue' : '';

    li.innerHTML = `
      <div class="drag-handle" title="Drag to reorder">
        <span></span><span></span><span></span>
      </div>
      <div class="task-checkbox${task.completed ? ' checked' : ''}" data-id="${task.id}" title="Mark complete"></div>
      <div class="task-content">
        <div class="task-name">${escHtml(task.name)}</div>
        ${task.desc ? `<div class="task-desc">${escHtml(task.desc)}</div>` : ''}
        <div class="task-meta">
          ${task.due ? `<span class="task-due${overdueClass}">${formatDate(task.due)}</span>` : ''}
          ${task.recur !== 'none' ? `<span class="task-recur">${capitalise(task.recur)}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action-btn edit" data-id="${task.id}" title="Edit">✎</button>
        <button class="task-action-btn delete" data-id="${task.id}" title="Delete">✕</button>
      </div>`;

    // ── Drag events ──
    li.addEventListener('dragstart', onDragStart);
    li.addEventListener('dragover',  onDragOver);
    li.addEventListener('drop',      onDrop);
    li.addEventListener('dragend',   onDragEnd);

    // ── Checkbox ──
    li.querySelector('.task-checkbox').addEventListener('click', () => toggleComplete(task.id));

    // ── Edit ──
    li.querySelector('.edit').addEventListener('click', () => openEdit(task.id));

    // ── Delete ──
    li.querySelector('.delete').addEventListener('click', () => deleteTask(task.id));

    taskList.appendChild(li);
  });
}

function escHtml(str) {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Task Actions ─────────────────────────────────────────────────────────────
function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  if (!task.completed && task.recur !== 'none') {
    // Schedule the next occurrence
    const next = nextDueDate(task);
    tasks.push({
      id: genId(),
      name: task.name,
      desc: task.desc,
      due: next,
      recur: task.recur,
      completed: false,
      createdAt: Date.now()
    });
  }

  task.completed = !task.completed;
  save();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save();
  render();
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(mode, task) {
  editingId = mode === 'edit' ? task.id : null;
  modalTitle.textContent = mode === 'edit' ? 'Edit Task' : 'New Task';

  taskNameInput.value = task ? task.name : '';
  taskDescInput.value = task ? task.desc : '';
  taskDueInput.value  = task ? (task.due || '') : '';
  setRecur(task ? task.recur : 'none');

  modalOverlay.classList.add('active');
  setTimeout(() => taskNameInput.focus(), 50);
}

function closeModal() {
  modalOverlay.classList.remove('active');
  editingId = null;
}

function openEdit(id) {
  const task = tasks.find(t => t.id === id);
  if (task) openModal('edit', task);
}

function setRecur(value) {
  selectedRecur = value;
  toggleBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

toggleBtns.forEach(btn => {
  btn.addEventListener('click', () => setRecur(btn.dataset.value));
});

function saveTask() {
  const name = taskNameInput.value.trim();
  if (!name) {
    taskNameInput.focus();
    taskNameInput.style.borderColor = '#C06040';
    setTimeout(() => taskNameInput.style.borderColor = '', 1000);
    return;
  }

  if (editingId) {
    const task = tasks.find(t => t.id === editingId);
    if (task) {
      task.name  = name;
      task.desc  = taskDescInput.value.trim();
      task.due   = taskDueInput.value || null;
      task.recur = selectedRecur;
    }
  } else {
    tasks.push({
      id: genId(),
      name,
      desc:  taskDescInput.value.trim(),
      due:   taskDueInput.value || null,
      recur: selectedRecur,
      completed: false,
      createdAt: Date.now()
    });
  }

  save();
  render();
  closeModal();
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────────
function onDragStart(e) {
  dragSrcIndex = parseInt(this.dataset.index);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
  this.classList.add('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  const targetIndex = parseInt(this.dataset.index);
  if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;

  const moved = tasks.splice(dragSrcIndex, 1)[0];
  tasks.splice(targetIndex, 0, moved);
  save();
  render();
}

function onDragEnd() {
  document.querySelectorAll('.task-item').forEach(el => {
    el.classList.remove('dragging', 'drag-over');
  });
  dragSrcIndex = null;
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
newTaskBtn.addEventListener('click', () => openModal('new', null));
modalClose.addEventListener('click', closeModal);
btnCancel.addEventListener('click', closeModal);
btnSave.addEventListener('click', saveTask);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && modalOverlay.classList.contains('active') && e.target !== taskDescInput) {
    saveTask();
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
render();
