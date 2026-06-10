/**
 * WeekPlanner — Vanilla JS (Conectado à Nuvem)
 */

const API_BASE  = 'https://t1-topografia-backend.onrender.com';  

let statusChartInstance = null;
let memberChartInstance = null;

let state = {
  tasks:       [],
  users:       [],
  avisos:      [],      
  weekOffset:  0,       
  searchQuery: '',
  detailTask:  null,
};

// ─────────────────────────────────────────────────────────
// SINCRONIZAÇÃO COM A NUVEM
// ─────────────────────────────────────────────────────────
async function carregarDaNuvem() {
    try {
        const [resUsers, resTasks, resAvisos] = await Promise.all([
            fetch(`${API_BASE}/users`),
            fetch(`${API_BASE}/tasks`),
            fetch(`${API_BASE}/avisos`)
        ]);
        
        if (resUsers.ok) state.users = await resUsers.json();
        if (resTasks.ok) state.tasks = await resTasks.json();
        if (resAvisos.ok) state.avisos = await resAvisos.json();
        
        renderMembers();
        renderAvisos();
        renderBoard();
        if(document.getElementById('team-view').style.display === 'flex') renderTeamTab();
        if(document.getElementById('reports-view').style.display === 'flex') renderReportsTab();
        
    } catch (e) {
        console.error("Erro ao conectar com a API:", e);
        toast('Erro de conexão: Servidor indisponível ou dormindo.', 'error');
    }
}

// ─────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────
const DAYS = [
  { num: 1, short: 'SEG', full: 'Segunda-feira'  },
  { num: 2, short: 'TER', full: 'Terça-feira'    },
  { num: 3, short: 'QUA', full: 'Quarta-feira'   },
  { num: 4, short: 'QUI', full: 'Quinta-feira'   },
  { num: 5, short: 'SEX', full: 'Sexta-feira'    },
  { num: 6, short: 'SÁB', full: 'Sábado'         },
  { num: 7, short: 'DOM', full: 'Domingo'        },
];

const SHIFTS = [
  { key: 'manha', label: 'Manhã',  icon: '🌅' },
  { key: 'tarde', label: 'Tarde',  icon: '☀️' },
  { key: 'noite', label: 'Noite',  icon: '🌙' },
];

const STATUS_LABELS = {
  a_fazer:      'A fazer',
  em_andamento: 'Em andamento',
  concluido:    'Concluído',
};

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay(); 
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + offset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatWeekLabel(dates) {
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const s = dates[0], e = dates[6];
  if (s.getMonth() === e.getMonth())
    return `${s.getDate()} – ${e.getDate()} de ${months[s.getMonth()]} ${s.getFullYear()}`;
  return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
}

function isToday(date) {
  const t = new Date();
  return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
}

function getFormatDateISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─────────────────────────────────────────────────────────
// CONFIRMAÇÃO CUSTOMIZADA
// ─────────────────────────────────────────────────────────
let confirmResolve = null;
function customConfirm(msg) {
  document.getElementById('confirm-message').textContent = msg;
  document.getElementById('modal-confirm').classList.add('is-open');
  return new Promise(resolve => { confirmResolve = resolve; });
}
function closeConfirm(result) {
  document.getElementById('modal-confirm').classList.remove('is-open');
  if (confirmResolve) confirmResolve(result);
}

// ─────────────────────────────────────────────────────────
// RENDER: BOARD E TAREFAS
// ─────────────────────────────────────────────────────────
function renderBoard() {
  const board = document.getElementById('board');
  if(!board) return;
  board.innerHTML = '';

  const dates = getWeekDates(state.weekOffset);
  document.getElementById('week-label').textContent = formatWeekLabel(dates);

  const corner = document.createElement('div');
  corner.className = 'board-corner';
  board.appendChild(corner);

  dates.forEach((date, i) => {
    const hdr = document.createElement('div');
    hdr.className = 'day-header' + (isToday(date) ? ' is-today' : '');
    hdr.innerHTML = `<span class="day-name">${DAYS[i].short}</span><span class="day-date">${date.getDate()}</span>`;
    board.appendChild(hdr);
  });

  SHIFTS.forEach(shift => {
    const lbl = document.createElement('div');
    lbl.className = 'shift-label';
    lbl.innerHTML = `<span class="shift-icon">${shift.icon}</span><span class="shift-name">${shift.label}</span>`;
    board.appendChild(lbl);

    DAYS.forEach(day => {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.dia = day.num;
      cell.dataset.turno = shift.key;

      const cellDate = dates[day.num - 1]; 
      const cellDateStr = getFormatDateISO(cellDate);

      const tasks = state.tasks.filter(t => {
          if (t.data_exata) {
              return t.data_exata === cellDateStr && t.turno === shift.key;
          } else {
              return t.dia_da_semana === day.num && t.turno === shift.key && state.weekOffset === 0;
          }
      });

      if (tasks.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cell-empty';
        empty.textContent = '—';
        cell.appendChild(empty);
      } else {
        tasks.forEach(task => cell.appendChild(createTaskCard(task)));
      }

      const addBtn = document.createElement('button');
      addBtn.className = 'cell-add-btn';
      addBtn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar`;
      addBtn.addEventListener('click', () => openAddModal(day.num, shift.key));
      cell.appendChild(addBtn);

      board.appendChild(cell);
    });
  });

  updateStats();
  applySearch();
}

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card task-card--${task.status}`;
  card.dataset.taskId = task.id;

  const userName = task.user ? task.user.nome.split(' ')[0] : '?';
  const userAvatar = task.user ? (task.user.avatar || task.user.nome.substring(0,2).toUpperCase()) : '?';
  const userColor = task.user ? task.user.cor : '#555';

  card.innerHTML = `
    <div class="task-titulo">${escHtml(task.titulo)}</div>
    <div class="task-footer">
      <div class="task-user">
        <div class="task-avatar" style="background:${userColor}">${escHtml(userAvatar)}</div>
        <span class="task-user-name">${escHtml(userName)}</span>
      </div>
      <span class="task-status-dot task-status-dot--${task.status}" title="${STATUS_LABELS[task.status]}"></span>
    </div>
  `;

  card.addEventListener('click', () => openDetailModal(task));
  return card;
}

function renderMembers() {
  const list = document.getElementById('members-list');
  if(!list) return;
  list.innerHTML = '';
  state.users.forEach(u => {
    const li = document.createElement('li');
    li.className = 'member-item';
    li.innerHTML = `<div class="member-avatar" style="background:${u.cor}">${escHtml(u.avatar || u.nome.substring(0,2))}</div><span>${escHtml(u.nome.split(' ')[0])}</span>`;
    list.appendChild(li);
  });
}

function populateUserSelect(selectEl, selectedId = null) {
  selectEl.innerHTML = '';
  state.users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.nome;
    if (selectedId && parseInt(selectedId) === u.id) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

function updateStats() {
  const total = state.tasks.length;
  const a_fazer = state.tasks.filter(t => t.status === 'a_fazer').length;
  const em_andamento = state.tasks.filter(t => t.status === 'em_andamento').length;
  const concluido = state.tasks.filter(t => t.status === 'concluido').length;

  document.querySelector('#stat-total .stat-num').textContent = total;
  document.querySelector('#stat-a_fazer .stat-num').textContent = a_fazer;
  document.querySelector('#stat-em_andamento .stat-num').textContent = em_andamento;
  document.querySelector('#stat-concluido .stat-num').textContent = concluido;
}

function applySearch() {
  const q = state.searchQuery.toLowerCase().trim();
  document.querySelectorAll('.task-card').forEach(card => {
    const titulo = card.querySelector('.task-titulo')?.textContent.toLowerCase() || '';
    const user = card.querySelector('.task-user-name')?.textContent.toLowerCase() || '';
    if (!q || titulo.includes(q) || user.includes(q)) {
      card.classList.remove('filtered-out');
    } else {
      card.classList.add('filtered-out');
    }
  });
}

// ─────────────────────────────────────────────────────────
// NAVEGAÇÃO ENTRE AS ABAS
// ─────────────────────────────────────────────────────────
function bindTabNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const views = {
    'menu-board': document.getElementById('board-view'),
    'menu-timeline': document.getElementById('timeline-view'),
    'menu-team': document.getElementById('team-view'),
    'menu-reports': document.getElementById('reports-view')
  };

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      Object.values(views).forEach(view => { if(view) view.style.display = 'none'; });

      const targetView = views[item.id];
      if(targetView) {
        targetView.style.display = 'flex';
        targetView.style.flexDirection = 'column';

        if(item.id === 'menu-team') renderTeamTab();
        if(item.id === 'menu-reports') renderReportsTab();
        if(item.id === 'menu-timeline') {
            bindAvisosTabs();
            renderAvisos();
        }
      }
    });
  });
}

// ─────────────────────────────────────────────────────────
// LÓGICA DO QUADRO DE AVISOS
// ─────────────────────────────────────────────────────────
function bindAvisosTabs() {
    const btnLev = document.getElementById('tab-levantamentos');
    const btnObras = document.getElementById('tab-obras');
    const contLev = document.getElementById('content-levantamentos');
    const contObras = document.getElementById('content-obras');
    const filterLev = document.getElementById('filter-levantamentos');

    if(!btnLev) return;

    btnLev.onclick = () => {
        btnLev.style.borderBottomColor = 'var(--accent)'; btnLev.style.color = 'var(--accent)';
        btnObras.style.borderBottomColor = 'transparent'; btnObras.style.color = 'var(--txt-secondary)';
        contLev.style.display = 'block'; contObras.style.display = 'none';
    };
    btnObras.onclick = () => {
        btnObras.style.borderBottomColor = 'var(--accent)'; btnObras.style.color = 'var(--accent)';
        btnLev.style.borderBottomColor = 'transparent'; btnLev.style.color = 'var(--txt-secondary)';
        contObras.style.display = 'block'; contLev.style.display = 'none';
    };
    
    filterLev.onchange = renderAvisos;
}

function renderAvisos() {
    const listLevantamentos = document.getElementById('list-levantamentos');
    const listObras = document.getElementById('list-obras');
    const filter = document.getElementById('filter-levantamentos')?.value || 'todos';

    if(listLevantamentos) listLevantamentos.innerHTML = '';
    if(listObras) listObras.innerHTML = '';

    state.avisos.forEach(aviso => {
        const card = document.createElement('div');
        card.style.cssText = `background: var(--bg-card); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;`;

        let tag = '';
        if(aviso.category === 'levantamento') {
            const tagColor = aviso.type === 'planimetrico' ? '#2A9D8F' : '#E76F51';
            const tagLabel = aviso.type === 'planimetrico' ? 'Planimétrico' : 'Planialtimétrico';
            tag = `<span style="font-size: 11px; padding: 4px 10px; border-radius: 12px; background: ${tagColor}33; color: ${tagColor}; margin-bottom: 8px; display: inline-block; font-weight: bold;">${tagLabel}</span><br>`;
        }

        let prazoHtml = aviso.dataLimite ? `<span style="display: block; font-size: 12px; color: #e8a33a; margin-top: 6px; font-weight: bold;">📅 Prazo: ${escHtml(aviso.dataLimite)}</span>` : '';

        card.innerHTML = `
            <div>
                ${tag}
                <span style="color: var(--txt-primary); font-size: 15px;">${escHtml(aviso.text)}</span>
                ${prazoHtml}
            </div>
            <button onclick="deleteAviso(${aviso.id})" title="Remover pendência" style="background: transparent; border: none; color: var(--txt-muted); cursor: pointer;">✕</button>
        `;

        if(aviso.category === 'levantamento') {
            if(filter === 'todos' || filter === aviso.type) {
                listLevantamentos.appendChild(card);
            }
        } else {
            listObras.appendChild(card);
        }
    });
}

function addAviso(category) {
    document.getElementById('aviso-category').value = category;
    document.getElementById('aviso-desc').value = '';
    document.getElementById('aviso-prazo').value = '';

    const tipoContainer = document.getElementById('aviso-tipo-container');
    if(category === 'levantamento') {
        tipoContainer.style.display = 'block';
        document.getElementById('aviso-modal-title').textContent = 'Novo Levantamento';
    } else {
        tipoContainer.style.display = 'none';
        document.getElementById('aviso-modal-title').textContent = 'Nova Pendência de Obra';
    }

    document.getElementById('modal-aviso').classList.add('is-open');
    document.getElementById('aviso-desc').focus();
}

function closeAvisoModal() {
    document.getElementById('modal-aviso').classList.remove('is-open');
}

async function saveAviso() {
    const category = document.getElementById('aviso-category').value;
    const text = document.getElementById('aviso-desc').value.trim();
    const dataLimite = document.getElementById('aviso-prazo').value.trim();
    let type = '';

    if(!text) { 
        toast('Digite a descrição da pendência', 'error'); 
        document.getElementById('aviso-desc').focus();
        return; 
    }
    if(category === 'levantamento') type = document.getElementById('aviso-tipo').value;

    const payload = { category, type: type || null, text, dataLimite: dataLimite || null };

    try {
        await fetch(`${API_BASE}/avisos`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(payload) 
        });
        await carregarDaNuvem();
        closeAvisoModal();
        toast('Pendência registrada com sucesso!', 'success');
    } catch(e) {
        toast('Erro ao registrar pendência', 'error');
    }
}

async function deleteAviso(id) {
    const confirmed = await customConfirm("Tem certeza que deseja excluir esta pendência?");
    if (!confirmed) return;
    try {
        await fetch(`${API_BASE}/avisos/${id}`, { method: 'DELETE' });
        await carregarDaNuvem();
        toast('Pendência removida', 'info');
    } catch(e) { toast('Erro ao deletar', 'error'); }
}

// ─────────────────────────────────────────────────────────
// LÓGICA DA EQUIPE
// ─────────────────────────────────────────────────────────
function renderTeamTab() {
  const teamList = document.getElementById('team-list');
  if (!teamList) return;
  teamList.innerHTML = '';
  
  state.users.forEach(user => {
    const initials = user.avatar || user.nome.substring(0, 2).toUpperCase();
    const card = document.createElement('div');
    card.style.cssText = `background: var(--bg-card); padding: 20px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; border-left: 5px solid ${user.cor}; box-shadow: 0 4px 12px rgba(0,0,0,0.1);`;
    
    card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <div style="background: ${user.cor}; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white;">
                ${initials}
            </div>
            <div>
                <h4 style="margin: 0; padding: 0; font-size: 16px; color: var(--txt-primary);">${escHtml(user.nome)}</h4>
                <small style="color: var(--accent); font-weight: bold; display: block; margin-top: 2px;">${escHtml(user.cargo || 'Membro')}</small>
                <small style="color: var(--txt-secondary);">${escHtml(user.email)}</small>
            </div>
        </div>
        <button onclick="deleteMember(${user.id})" title="Excluir" style="background: transparent; border: none; color: #e85555; cursor: pointer; padding: 5px; transition: transform 0.2s;">
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
    `;
    teamList.appendChild(card);
  });
}

async function deleteMember(id) {
    const confirmed = await customConfirm("Tem certeza que deseja excluir este membro da equipe?");
    if (!confirmed) return;
    try {
        await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
        await carregarDaNuvem();
        toast("Membro excluído", "info");
    } catch(e) { toast("Erro ao excluir", "error"); }
}

function openMemberModal() {
    document.getElementById('member-nome').value = '';
    document.getElementById('member-cargo').value = '';
    document.getElementById('member-email').value = '';
    document.getElementById('modal-member').classList.add('is-open');
    document.getElementById('member-nome').focus();
}

function closeMemberModal() {
    document.getElementById('modal-member').classList.remove('is-open');
}

async function saveMember() {
    const nome = document.getElementById('member-nome').value.trim();
    if(!nome) {
        toast('Por favor, digite o nome do membro.', 'error');
        document.getElementById('member-nome').focus();
        return;
    }

    const payload = {
        nome: nome,
        cargo: document.getElementById('member-cargo').value.trim() || 'Membro',
        email: document.getElementById('member-email').value.trim() || 'sem@email.com',
        cor: '#' + Math.floor(Math.random()*16777215).toString(16),
        avatar: nome.substring(0,2).toUpperCase()
    };

    try {
        await fetch(`${API_BASE}/users`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(payload) 
        });
        await carregarDaNuvem();
        closeMemberModal();
        toast(nome + " adicionado(a) à equipe!", "success");
    } catch(e) { toast("Erro ao salvar membro", "error"); }
}

// ─────────────────────────────────────────────────────────
// LÓGICA DE RELATÓRIOS (COM GRÁFICOS)
// ─────────────────────────────────────────────────────────
function renderReportsTab() {
  const totalTodo = state.tasks.filter(t => t.status === 'a_fazer').length;
  const totalDoing = state.tasks.filter(t => t.status === 'em_andamento').length;
  const totalDone = state.tasks.filter(t => t.status === 'concluido').length;

  const elTodo = document.getElementById('count-todo');
  const elDoing = document.getElementById('count-doing');
  const elDone = document.getElementById('count-done');

  if (elTodo) elTodo.textContent = totalTodo;
  if (elDoing) elDoing.textContent = totalDoing;
  if (elDone) elDone.textContent = totalDone;

  renderCharts(totalTodo, totalDoing, totalDone);
}

function renderCharts(todo, doing, done) {
    const ctxStatus = document.getElementById('statusChart');
    const ctxMember = document.getElementById('memberChart');
    
    if (!ctxStatus || !ctxMember || typeof Chart === 'undefined') return;

    const style = getComputedStyle(document.body);
    const colorTodo = style.getPropertyValue('--c-a_fazer').trim() || '#7b82a0';
    const colorDoing = style.getPropertyValue('--c-em_andamento').trim() || '#e8a33a';
    const colorDone = style.getPropertyValue('--c-concluido').trim() || '#3cba6e';
    const colorAccent = style.getPropertyValue('--accent').trim() || '#F37021';
    const textColor = style.getPropertyValue('--txt-secondary').trim() || '#676879';

    if (statusChartInstance) statusChartInstance.destroy();
    if (memberChartInstance) memberChartInstance.destroy();

    Chart.defaults.font.family = "'DM Sans', sans-serif";
    Chart.defaults.color = textColor;

    statusChartInstance = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['A Fazer', 'Em Andamento', 'Concluídas'],
            datasets: [{
                data: [todo, doing, done],
                backgroundColor: [colorTodo, colorDoing, colorDone],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            cutout: '70%'
        }
    });

    const memberTaskCount = {};
    state.users.forEach(u => memberTaskCount[u.nome] = 0);
    state.tasks.forEach(t => {
        if (t.user && t.user.nome) {
            memberTaskCount[t.user.nome] = (memberTaskCount[t.user.nome] || 0) + 1;
        }
    });

    memberChartInstance = new Chart(ctxMember, {
        type: 'bar',
        data: {
            labels: Object.keys(memberTaskCount),
            datasets: [{
                label: 'Número de Tarefas',
                data: Object.values(memberTaskCount),
                backgroundColor: colorAccent,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            plugins: { legend: { display: false } }
        }
    });
}

// ─────────────────────────────────────────────────────────
// MODAL E CRUD DE TAREFAS DA SEMANA
// ─────────────────────────────────────────────────────────
function openAddModal(dia = 1, turno = 'manha') {
  const overlay = document.getElementById('modal-task');
  document.getElementById('modal-title').textContent = 'Nova Tarefa';
  document.getElementById('task-id').value = '';
  document.getElementById('task-titulo').value = '';
  document.getElementById('task-descricao').value = '';
  document.getElementById('task-dia').value = dia;
  document.getElementById('task-turno').value = turno;
  document.getElementById('task-status').value = 'a_fazer';
  populateUserSelect(document.getElementById('task-user'));
  overlay.classList.add('is-open');
  document.getElementById('task-titulo').focus();
}

function openEditModal(task) {
  closeDetailModal();
  const overlay = document.getElementById('modal-task');
  document.getElementById('modal-title').textContent = 'Editar Tarefa';
  document.getElementById('task-id').value = task.id;
  document.getElementById('task-titulo').value = task.titulo;
  document.getElementById('task-descricao').value = task.descricao || '';
  document.getElementById('task-dia').value = task.dia_da_semana;
  document.getElementById('task-turno').value = task.turno;
  document.getElementById('task-status').value = task.status;
  populateUserSelect(document.getElementById('task-user'), task.user_id);
  overlay.classList.add('is-open');
  document.getElementById('task-titulo').focus();
}

function closeTaskModal() {
  document.getElementById('modal-task').classList.remove('is-open');
}

async function saveTask() {
  const id = document.getElementById('task-id').value;
  const titulo= document.getElementById('task-titulo').value.trim();

  if (!titulo) {
    toast('Digite um título para a tarefa', 'error');
    document.getElementById('task-titulo').focus();
    return;
  }

  const userId = parseInt(document.getElementById('task-user').value);
  const diaNum = parseInt(document.getElementById('task-dia').value);
  const dates = getWeekDates(state.weekOffset);
  const dataExata = getFormatDateISO(dates[diaNum - 1]); 

  const payload = {
    titulo,
    descricao:     document.getElementById('task-descricao').value.trim() || null,
    dia_da_semana: diaNum,
    turno:         document.getElementById('task-turno').value,
    status:        document.getElementById('task-status').value,
    user_id:       userId,
    data_exata:    dataExata
  };

  try {
      if (id) {
          await fetch(`${API_BASE}/tasks/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          toast('Tarefa atualizada!', 'success');
      } else {
          await fetch(`${API_BASE}/tasks`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          toast('Tarefa criada!', 'success');
      }
      await carregarDaNuvem();
      closeTaskModal();
  } catch(e) { toast("Erro ao salvar tarefa.", "error"); }
}

function openDetailModal(task) {
  state.detailTask = task;
  const overlay = document.getElementById('modal-detail');

  document.getElementById('detail-titulo').textContent = task.titulo;
  document.getElementById('detail-descricao').textContent = task.descricao || 'Sem descrição.';

  const badge = document.getElementById('detail-badge');
  badge.textContent = STATUS_LABELS[task.status];
  badge.className = `detail-badge detail-badge--${task.status}`;

  document.getElementById('detail-user').textContent  = task.user ? task.user.nome : '—';
  document.getElementById('detail-dia').textContent   = DAYS.find(d => d.num === task.dia_da_semana)?.full || '—';
  document.getElementById('detail-turno').textContent = SHIFTS.find(s => s.key === task.turno)?.label || '—';

  document.querySelectorAll('.status-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === task.status);
  });

  renderSubtasks(); 
  overlay.classList.add('is-open');
}

function closeDetailModal() {
  document.getElementById('modal-detail').classList.remove('is-open');
  state.detailTask = null;
}

async function changeStatus(newStatus) {
  if (!state.detailTask) return;
  try {
      await fetch(`${API_BASE}/tasks/${state.detailTask.id}`, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ status: newStatus })
      });
      
      const badge = document.getElementById('detail-badge');
      badge.textContent = STATUS_LABELS[newStatus];
      badge.className = `detail-badge detail-badge--${newStatus}`;

      document.querySelectorAll('.status-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === newStatus);
      });

      await carregarDaNuvem();
      state.detailTask = state.tasks.find(t => t.id === state.detailTask.id);
      toast('Status atualizado!', 'success');
  } catch(e) { toast('Erro ao atualizar status', 'error'); }
}

async function deleteTask() {
  if (!state.detailTask) return;
  const confirmed = await customConfirm(`Excluir a tarefa "${state.detailTask.titulo}"?`);
  if (!confirmed) return;
  try {
      await fetch(`${API_BASE}/tasks/${state.detailTask.id}`, { method: 'DELETE' });
      await carregarDaNuvem();
      closeDetailModal();
      toast('Tarefa excluída.', 'info');
  } catch(e) { toast('Erro ao excluir tarefa', 'error'); }
}

// ─────────────────────────────────────────────────────────
// UTILITÁRIOS E EVENTOS GERAIS
// ─────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if(!container) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem('wp_theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
  if (localStorage.getItem('wp_theme') === 'dark') {
      document.body.classList.add('dark-theme');
  }
}

function exportToCSV() {
    try {
        if (!state.tasks || state.tasks.length === 0) {
            toast('Nenhuma tarefa cadastrada para exportar.', 'error');
            return;
        }
        const headers = ['ID', 'Titulo', 'Descricao', 'Dia da Semana', 'Turno', 'Status', 'Responsavel', 'Data Exata'];
        const rows = state.tasks.map(t => [
            t.id,
            `"${(t.titulo || '').replace(/"/g, '""')}"`,
            `"${(t.descricao || '').replace(/"/g, '""')}"`,
            t.dia_da_semana,
            t.turno,
            t.status,
            t.user ? t.user.nome : 'Sem Responsável',
            t.data_exata || 'Sem Data'
        ]);
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'T1_Topografia_Relatorio.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast('Relatório CSV exportado com sucesso!', 'success');
    } catch (error) { toast('Ocorreu um erro ao gerar o CSV.', 'error'); }
}

// ─────────────────────────────────────────────────────────
// LÓGICA DE SUBTAREFAS
// ─────────────────────────────────────────────────────────
async function addSubtask() {
    const input = document.getElementById('new-subtask-input');
    const titulo = input.value.trim();
    if (!titulo || !state.detailTask) return;

    try {
        await fetch(`${API_BASE}/tasks/${state.detailTask.id}/subtasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo })
        });
        input.value = '';
        await carregarDaNuvem();
        state.detailTask = state.tasks.find(t => t.id === state.detailTask.id); 
        renderSubtasks();
    } catch (err) { toast('Erro ao adicionar subtarefa', 'error'); }
}

async function toggleSubtask(subtaskId, isChecked) {
    try {
        await fetch(`${API_BASE}/subtasks/${subtaskId}?concluida=${isChecked}`, { method: 'PUT' });
        await carregarDaNuvem();
        state.detailTask = state.tasks.find(t => t.id === state.detailTask.id);
    } catch (err) { toast('Erro ao atualizar checklist', 'error'); }
}

function renderSubtasks() {
    const container = document.getElementById('detail-subtasks-list');
    container.innerHTML = '';
    const subtasks = state.detailTask.subtasks || [];
    
    if (subtasks.length === 0) {
        container.innerHTML = '<span style="font-size: 12px; color: var(--txt-muted);">Nenhum item no checklist.</span>';
        return;
    }

    subtasks.forEach(st => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '10px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = st.concluida;
        checkbox.style.cursor = 'pointer';
        checkbox.addEventListener('change', (e) => toggleSubtask(st.id, e.target.checked));
        
        const label = document.createElement('span');
        label.textContent = st.titulo;
        label.style.fontSize = '13.5px';
        label.style.color = st.concluida ? 'var(--txt-muted)' : 'var(--txt-primary)';
        label.style.textDecoration = st.concluida ? 'line-through' : 'none';
        
        div.appendChild(checkbox);
        div.appendChild(label);
        container.appendChild(div);
    });
}

function bindEvents() {
  document.getElementById('btn-prev-week').addEventListener('click', () => { state.weekOffset--; renderBoard(); });
  document.getElementById('btn-next-week').addEventListener('click', () => { state.weekOffset++; renderBoard(); });
  document.getElementById('btn-today').addEventListener('click', () => { state.weekOffset = 0; renderBoard(); });
  document.getElementById('btn-add-task').addEventListener('click', () => openAddModal());

  document.getElementById('btn-add-member')?.addEventListener('click', openMemberModal);

  document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);

  document.getElementById('search-input').addEventListener('input', e => {
    state.searchQuery = e.target.value;
    applySearch();
  });

  document.getElementById('modal-close').addEventListener('click', closeTaskModal);
  document.getElementById('modal-cancel').addEventListener('click', closeTaskModal);
  document.getElementById('modal-save').addEventListener('click', saveTask);
  
  document.getElementById('detail-close').addEventListener('click', closeDetailModal);
  document.getElementById('detail-edit').addEventListener('click', () => openEditModal(state.detailTask));
  document.getElementById('detail-delete').addEventListener('click', deleteTask);

  document.querySelectorAll('.status-option').forEach(btn => {
    btn.addEventListener('click', () => changeStatus(btn.dataset.status));
  });

  document.getElementById('modal-task').addEventListener('click', e => { if (e.target === document.getElementById('modal-task')) closeTaskModal(); });
  document.getElementById('modal-detail').addEventListener('click', e => { if (e.target === document.getElementById('modal-detail')) closeDetailModal(); });
  document.getElementById('modal-member')?.addEventListener('click', e => { if (e.target === document.getElementById('modal-member')) closeMemberModal(); });
  document.getElementById('modal-aviso')?.addEventListener('click', e => { if (e.target === document.getElementById('modal-aviso')) closeAvisoModal(); });
  document.getElementById('modal-confirm')?.addEventListener('click', e => { if (e.target === document.getElementById('modal-confirm')) closeConfirm(false); });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('modal-task').classList.contains('is-open')) closeTaskModal();
    if (document.getElementById('modal-detail').classList.contains('is-open')) closeDetailModal();
    if (document.getElementById('modal-member')?.classList.contains('is-open')) closeMemberModal();
    if (document.getElementById('modal-aviso')?.classList.contains('is-open')) closeAvisoModal();
    if (document.getElementById('modal-confirm')?.classList.contains('is-open')) closeConfirm(false);
  });

  document.getElementById('task-titulo').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveTask();
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', exportToCSV);
  
  document.getElementById('btn-add-subtask')?.addEventListener('click', addSubtask);
  document.getElementById('new-subtask-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') addSubtask();
  });
}

// ─────────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────
async function init() {
  try {
    loadTheme(); 
    await carregarDaNuvem(); 
    bindEvents();
    bindTabNavigation();
  } catch (err) {
    toast('Erro ao inicializar: ' + err.message, 'error');
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', init);