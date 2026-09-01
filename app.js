const baseUsers = {
  'admin@empower.com': {
    name: 'Administrador del Sistema',
    password: '123456',
    role: 'admin'
  },
  'lucas@empower.com': {
    name: 'Lucas García',
    password: '123456',
    role: 'user'
  },
  'maria@empower.com': {
    name: 'María López',
    password: '123456',
    role: 'user'
  }
};

const userRows = [
  { id: 1, name: 'Lucas García', email: 'lucas@empower.com', role: 'Analista', installation: 'Granja Solar', status: 'Activo' },
  { id: 2, name: 'María López', email: 'maria@empower.com', role: 'Supervisor', installation: 'Planta del Sur', status: 'Pendiente' },
  { id: 3, name: 'Andrés Torres', email: 'andres@empower.com', role: 'Administrador', installation: 'Centro de Control', status: 'Activo' },
  { id: 4, name: 'Rosa Díaz', email: 'rosa@empower.com', role: 'Analista', installation: 'Granja Solar', status: 'Inactivo' }
];

const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const sidebarRole = document.getElementById('sidebarRole');
const sidebarName = document.getElementById('sidebarName');
const adminView = document.getElementById('adminView');
const userView = document.getElementById('userView');
const currentRoute = document.getElementById('currentRoute');
const profileAvatar = document.getElementById('profileAvatar');
const userTableBody = document.getElementById('userTableBody');
const userForm = document.getElementById('userForm');
const userIdInput = document.getElementById('userId');
const userNameInput = document.getElementById('userName');
const userEmailInput = document.getElementById('userEmail');
const userRoleInput = document.getElementById('userRole');
const userInstallationInput = document.getElementById('userInstallation');
const userStatusInput = document.getElementById('userStatus');
const newUserBtn = document.getElementById('newUserBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const metricActiveUsers = document.getElementById('metricActiveUsers');
const metricTotalKwh = document.getElementById('metricTotalKwh');
const metricAlerts = document.getElementById('metricAlerts');
const metricReports = document.getElementById('metricReports');
const reportList = document.getElementById('reportList');

function setRoleView(role) {
  const isAdmin = role === 'admin';

  adminView.classList.toggle('hidden', !isAdmin);
  userView.classList.toggle('hidden', isAdmin);

  sidebarRole.textContent = isAdmin ? 'Administrador del' : 'Usuario del';
  sidebarName.textContent = 'Sistema';
  currentRoute.textContent = isAdmin
    ? 'empower.platform.energy/admin/registrar-usuario'
    : 'empower.platform.energy/usuario/consumo';

  profileAvatar.style.background = isAdmin
    ? 'linear-gradient(135deg, #d7ebff, #9fcaf5)'
    : 'linear-gradient(135deg, #d8f2d0, #a8d9b5)';
}

function updateMetrics() {
  const activeUsers = userRows.filter((user) => user.status === 'Activo').length;
  const totalKwh = userRows.reduce((sum, user) => sum + (user.status === 'Activo' ? 1100 : 850) + (user.role === 'Administrador' ? 260 : 0), 0);

  metricActiveUsers.textContent = String(activeUsers);
  metricTotalKwh.textContent = `${(totalKwh / 1000).toFixed(3).replace('.', ',')} kWh`;
  metricAlerts.textContent = String(userRows.filter((user) => user.status !== 'Activo').length + 10);
  metricReports.textContent = String(18 + userRows.length);

  reportList.innerHTML = userRows.map((user) => `
    <li><span>${user.name}</span><strong>${(user.role === 'Administrador' ? 2100 : user.role === 'Supervisor' ? 1500 : 1200) + (user.id * 120)} kWh</strong></li>
  `).join('');
}

function renderUsers() {
  userTableBody.innerHTML = userRows.map((user) => `
    <tr>
      <td>${user.name}</td>
      <td>${user.role}</td>
      <td>${user.installation}</td>
      <td><span class="status ${user.status === 'Activo' ? 'ok' : user.status === 'Pendiente' ? 'warn' : ''}">${user.status}</span></td>
      <td>
        <button class="table-action" type="button" data-edit-id="${user.id}">Editar</button>
        <button class="table-action danger" type="button" data-delete-id="${user.id}">Eliminar</button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const id = Number(event.currentTarget.dataset.editId);
      const user = userRows.find((item) => item.id === id);
      if (!user) return;

      userIdInput.value = String(user.id);
      userNameInput.value = user.name;
      userEmailInput.value = user.email;
      userRoleInput.value = user.role;
      userInstallationInput.value = user.installation;
      userStatusInput.value = user.status;

      document.querySelectorAll('.tab-btn').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === 'managementTab'));
      document.querySelectorAll('.admin-tab').forEach((tab) => tab.classList.toggle('hidden', tab.id !== 'managementTab'));
    });
  });

  document.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const id = Number(event.currentTarget.dataset.deleteId);
      const index = userRows.findIndex((user) => user.id === id);
      if (index === -1) return;

      userRows.splice(index, 1);
      renderUsers();
      updateMetrics();
    });
  });
}

function showTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabId);
  });

  document.querySelectorAll('.admin-tab').forEach((section) => {
    section.classList.toggle('hidden', section.id !== tabId);
  });
}

function loginUser(email, password) {
  const user = baseUsers[email];
  if (!user) {
    return false;
  }

  if (user.password !== password) {
    return false;
  }

  setRoleView(user.role);
  return true;
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const email = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    loginError.textContent = 'Ingresa usuario y contraseña para continuar.';
    return;
  }

  const isValid = loginUser(email, password);

  if (!isValid) {
    loginError.textContent = 'Credenciales incorrectas. Prueba admin@empower.com / 123456';
    return;
  }

  loginError.textContent = '';
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
});

newUserBtn.addEventListener('click', () => {
  userForm.reset();
  userIdInput.value = '';
  showTab('managementTab');
});

cancelEditBtn.addEventListener('click', () => {
  userForm.reset();
  userIdInput.value = '';
  showTab('usersTab');
});

userForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const payload = {
    id: userIdInput.value ? Number(userIdInput.value) : Date.now(),
    name: userNameInput.value.trim(),
    email: userEmailInput.value.trim(),
    role: userRoleInput.value,
    installation: userInstallationInput.value,
    status: userStatusInput.value
  };

  if (!payload.name || !payload.email) {
    return;
  }

  const existing = userRows.find((user) => user.id === payload.id);
  if (existing) {
    Object.assign(existing, payload);
  } else {
    userRows.unshift(payload);
  }

  renderUsers();
  updateMetrics();
  userForm.reset();
  userIdInput.value = '';
  showTab('usersTab');
});

document.querySelector('.close-tab').addEventListener('click', () => {
  appScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  loginForm.reset();
  loginError.textContent = '';
  setRoleView('admin');
});

document.querySelectorAll('.tab-btn').forEach((button) => {
  button.addEventListener('click', (event) => {
    showTab(event.currentTarget.dataset.tab);
  });
});

setRoleView('admin');
renderUsers();
updateMetrics();
showTab('usersTab');
