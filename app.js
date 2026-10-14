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
  {
    id: 1,
    name: 'Lucas García',
    email: 'lucas@empower.com',
    role: 'Analista',
    installation: 'Granja Solar',
    status: 'Activo'
  },
  {
    id: 2,
    name: 'María López',
    email: 'maria@empower.com',
    role: 'Supervisor',
    installation: 'Planta del Sur',
    status: 'Pendiente'
  },
  {
    id: 3,
    name: 'Andrés Torres',
    email: 'andres@empower.com',
    role: 'Administrador',
    installation: 'Centro de Control',
    status: 'Activo'
  },
  {
    id: 4,
    name: 'Rosa Díaz',
    email: 'rosa@empower.com',
    role: 'Analista',
    installation: 'Granja Solar',
    status: 'Inactivo'
  }
];

// Elementos de la interfaz
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

// Cambiar la vista según el rol
function setRoleView(role) {
  const isAdmin = role === 'admin';

  adminView.classList.toggle('hidden', !isAdmin);
  userView.classList.toggle('hidden', isAdmin);

  sidebarRole.textContent = isAdmin
    ? 'Administrador del'
    : 'Usuario del';

  sidebarName.textContent = 'Sistema';

  currentRoute.textContent = isAdmin
    ? 'empower.platform.energy/admin/registrar-usuario'
    : 'empower.platform.energy/usuario/consumo';

  profileAvatar.style.background = isAdmin
    ? 'linear-gradient(135deg, #d7ebff, #9fcaf5)'
    : 'linear-gradient(135deg, #d8f2d0, #a8d9b5)';
}

// Actualizar las métricas del panel

function updateMetrics() {
  const activeUsers = userRows.filter(
    (user) => user.status === 'Activo'
  ).length;

  // Consumo de demostración asignado a cada usuario.
  // Se conserva mientras el prototipo no tenga mediciones reales.
  const getConsumption = (user) => {
  if (Number.isFinite(user.consumption)) {
    return user.consumption;
  }

  if (user.role === 'Administrador') return 2100;
  if (user.role === 'Supervisor') return 1500;

  return 1200;
};

  const totalKwh = userRows.reduce(
    (sum, user) => sum + getConsumption(user),
    0
  );

  const averageKwh = userRows.length
    ? totalKwh / userRows.length
    : 0;

  metricActiveUsers.textContent = String(activeUsers);

  metricTotalKwh.textContent =
    `${totalKwh.toLocaleString('es-CO')} kWh`;

  metricAlerts.textContent = String(
    userRows.filter((user) => user.status !== 'Activo').length + 10
  );

  metricReports.textContent = String(18 + userRows.length);

  // Actualizar la lista de consumo por usuario
  reportList.innerHTML = userRows.map((user) => `
    <li>
      <span>${user.name}</span>
      <strong>
        ${getConsumption(user).toLocaleString('es-CO')} kWh
      </strong>
    </li>
  `).join('');

  // Actualizar el resumen ejecutivo
  const reportTotalKwh = document.getElementById('reportTotalKwh');
  const reportAverageKwh = document.getElementById('reportAverageKwh');

  if (reportTotalKwh) {
    reportTotalKwh.textContent =
      `${totalKwh.toLocaleString('es-CO')} kWh`;
  }

  if (reportAverageKwh) {
    reportAverageKwh.textContent =
      `${Math.round(averageKwh).toLocaleString('es-CO')} kWh`;
  }
}


// Dibujar la tabla y sus botones
function renderUsers() {
  userTableBody.innerHTML = userRows.map((user) => `
    <tr>
      <td>${user.name}</td>
      <td>${user.role}</td>
      <td>${user.installation}</td>
      <td>
        <span class="status ${
          user.status === 'Activo'
            ? 'ok'
            : user.status === 'Pendiente'
              ? 'warn'
              : ''
        }">
          ${user.status}
        </span>
      </td>
      <td>
        <button
          class="table-action"
          type="button"
          data-edit-id="${user.id}"
        >
          Editar
        </button>

        <button
          class="table-action danger"
          type="button"
          data-delete-id="${user.id}"
        >
          Eliminar
        </button>
      </td>
    </tr>
  `).join('');

  // HU-2: editar un usuario
  document.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const id = Number(event.currentTarget.dataset.editId);

      const user = userRows.find((item) => item.id === id);

      if (!user) {
        alert('El usuario no fue encontrado.');
        return;
      }

      userIdInput.value = String(user.id);
      userNameInput.value = user.name;
      userEmailInput.value = user.email;
      userRoleInput.value = user.role;
      userInstallationInput.value = user.installation;
      userStatusInput.value = user.status;

      showTab('managementTab');
    });
  });

  // HU-3: eliminar únicamente usuarios inactivos
  document.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const id = Number(event.currentTarget.dataset.deleteId);

      const user = userRows.find((item) => item.id === id);

      if (!user) {
        alert(
          'El usuario no fue encontrado o ya fue eliminado.'
        );
        return;
      }

      if (user.status !== 'Inactivo') {
        alert(
          'No se puede eliminar un usuario activo o pendiente. ' +
          'Primero debe estar inactivo.'
        );
        return;
      }

      const confirmed = confirm(
        `¿Estás segura de que deseas eliminar a ${user.name}?`
      );

      if (!confirmed) {
        return;
      }

      const index = userRows.findIndex(
        (item) => item.id === id
      );

      if (index === -1) {
        alert(
          'El usuario no fue encontrado o ya fue eliminado.'
        );
        return;
      }

      userRows.splice(index, 1);

      renderUsers();
      updateMetrics();

      alert('Usuario eliminado correctamente.');
    });
  });
}

// Mostrar una pestaña del panel
function showTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle(
      'active',
      button.dataset.tab === tabId
    );
  });

  document.querySelectorAll('.admin-tab').forEach((section) => {
    section.classList.toggle(
      'hidden',
      section.id !== tabId
    );
  });
}

// Verificar las credenciales
function loginUser(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = baseUsers[normalizedEmail];

  if (!user) {
    return false;
  }

  if (user.password !== password) {
    return false;
  }

  setRoleView(user.role);
  return true;
}

// Inicio de sesión
loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const email = document
    .getElementById('username')
    .value.trim()
    .toLowerCase();

  const password = document
    .getElementById('password')
    .value.trim();

  if (!email || !password) {
    loginError.textContent =
      'Ingresa usuario y contraseña para continuar.';
    return;
  }

  const isValid = loginUser(email, password);

  if (!isValid) {
    loginError.textContent =
      'Credenciales incorrectas. Prueba admin@empower.com / 123456';
    return;
  }

  loginError.textContent = '';
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
});

// Preparar el formulario para registrar un usuario nuevo
newUserBtn.addEventListener('click', () => {
  userForm.reset();
  userIdInput.value = '';
  showTab('managementTab');
});

// Cancelar registro o edición
cancelEditBtn.addEventListener('click', () => {
  userForm.reset();
  userIdInput.value = '';
  showTab('usersTab');
});

// HU-1 y HU-2: registrar o actualizar usuarios
userForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const payload = {
    id: userIdInput.value
      ? Number(userIdInput.value)
      : Date.now(),

    name: userNameInput.value.trim(),
    email: userEmailInput.value.trim().toLowerCase(),
    role: userRoleInput.value,
    installation: userInstallationInput.value,
    status: userStatusInput.value
  };

  // Validar los campos obligatorios
  if (
    !payload.name ||
    !payload.email ||
    !payload.role ||
    !payload.installation ||
    !payload.status
  ) {
    alert(
      'Por favor, completa todos los campos obligatorios.'
    );
    return;
  }

  // Validar el formato del correo
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(payload.email)) {
    alert(
      'El correo electrónico no tiene un formato válido.'
    );
    return;
  }

  // Evitar correos duplicados, excepto el del usuario editado
  const duplicateEmail = userRows.some((user) =>
    user.email.trim().toLowerCase() === payload.email &&
    user.id !== payload.id
  );

  if (duplicateEmail) {
    alert(
      'Este correo ya está registrado. ' +
      'Utiliza otro correo electrónico.'
    );
    return;
  }

  // Comprobar si se está editando un usuario
  const existing = userRows.find(
    (user) => user.id === payload.id
  );

  if (existing) {
    Object.assign(existing, payload);

    alert(
      'Los datos del usuario se actualizaron correctamente.'
    );
  } else {
    userRows.unshift(payload);

    alert('Usuario registrado correctamente.');
  }

  // Actualizar tabla y métricas
  renderUsers();
  updateMetrics();

  // Limpiar el formulario y volver a la tabla
  userForm.reset();
  userIdInput.value = '';

  showTab('usersTab');
});

// Cerrar sesión
document.querySelector('.close-tab').addEventListener('click', () => {
  appScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');

  loginForm.reset();
  loginError.textContent = '';

  setRoleView('admin');
});

// Navegación entre pestañas
document.querySelectorAll('.tab-btn').forEach((button) => {
  button.addEventListener('click', (event) => {
    showTab(event.currentTarget.dataset.tab);
  });
});

// Inicializar el prototipo
setRoleView('admin');
renderUsers();
updateMetrics();
showTab('usersTab');



/* HU-6: Metas de ahorro */

const goalFormHU6 = document.getElementById('goalForm');
const goalInputHU6 = document.getElementById('goalInput');
const goalProgressBarHU6 = document.getElementById('goalProgressBar');
const goalProgressTextHU6 = document.getElementById('goalProgressText');
const goalMessageHU6 = document.getElementById('goalMessage');

// Progreso de demostración: se reemplazará por datos de consumo
// cuando el prototipo tenga un cálculo real de ahorro.
const demoReductionHU6 = 12;


function updateGoalHU6() {
  const savedGoal = localStorage.getItem('empowerSavingsGoal');
  const goal = savedGoal ? Number(savedGoal) : 18;

  goalInputHU6.value = goal;

  const goalSummaryValue = document.getElementById('goalSummaryValue');
  if (goalSummaryValue) {
    goalSummaryValue.textContent = `${goal}%`;
  }

  const progress = Math.min(
    (demoReductionHU6 / goal) * 100,
    100
  );

  goalProgressBarHU6.style.width = `${progress}%`;
  goalProgressTextHU6.textContent =
    `Progreso hacia tu meta: ${Math.round(progress)}%`;

  if (demoReductionHU6 >= goal) {
    goalMessageHU6.textContent =
      '¡Felicitaciones! Has alcanzado tu meta de ahorro.';
  } else {
    const remaining = goal - demoReductionHU6;

    goalMessageHU6.textContent =
      `Reducción de demostración: ${demoReductionHU6}%. ` +
      `Te faltan ${remaining}% para alcanzar tu meta.`;
  }
}

if (goalFormHU6) {
  updateGoalHU6();

  goalFormHU6.addEventListener('submit', function (event) {
    event.preventDefault();

    const goal = Number(goalInputHU6.value);

    if (!Number.isFinite(goal) || goal < 1 || goal > 50) {
      alert('Ingresa una meta entre 1% y 50%.');
      return;
    }

    localStorage.setItem('empowerSavingsGoal', String(goal));
    updateGoalHU6();

    alert('Tu meta de ahorro se guardó correctamente.');
  });
}


/* HU-7: Recomendaciones de ahorro energético */

// Consumo de demostración: porcentaje de referencia.
const demoConsumptionHU7 = 79;

const recommendationLevelHU7 =
  document.getElementById('recommendationLevel');

const recommendationListHU7 =
  document.getElementById('recommendationList');

function updateRecommendationsHU7() {
  if (!recommendationLevelHU7 || !recommendationListHU7) {
    return;
  }

  let level;
  let recommendations;

  if (demoConsumptionHU7 >= 75) {
    level = 'Consumo alto';

    recommendations = [
      'Reduce el uso simultáneo de equipos de alto consumo.',
      'Utiliza el aire acondicionado a una temperatura moderada.',
      'Apaga luces y equipos cuando no sean necesarios.'
    ];
  } else if (demoConsumptionHU7 >= 40) {
    level = 'Consumo medio';

    recommendations = [
      'Apaga los equipos que no estés utilizando.',
      'Aprovecha la iluminación natural.',
      'Desconecta cargadores cuando no los uses.'
    ];
  } else {
    level = 'Consumo bajo';

    recommendations = [
      'Mantén tus buenos hábitos de ahorro.',
      'Continúa apagando luces innecesarias.',
      'Revisa periódicamente tu consumo energético.'
    ];
  }

  recommendationLevelHU7.textContent = level;

  recommendationListHU7.replaceChildren();

  recommendations.forEach((recommendation) => {
    const item = document.createElement('li');
    item.textContent = recommendation;
    recommendationListHU7.appendChild(item);
  });
}

updateRecommendationsHU7();



/* HU-8: Alertas por exceso de consumo */

// Valores de demostración en kWh.
const demoConsumptionHU8 = 245;
const consumptionLimitHU8 = 200;

const alertStatusHU8 =
  document.getElementById('alertStatusHU8');

const alertListHU8 =
  document.getElementById('alertListHU8');

function updateAlertsHU8() {
  if (!alertStatusHU8 || !alertListHU8) {
    return;
  }

  alertListHU8.replaceChildren();

  if (demoConsumptionHU8 > consumptionLimitHU8) {
    const excess = demoConsumptionHU8 - consumptionLimitHU8;

    alertStatusHU8.textContent =
      'Atención: el consumo superó el límite establecido.';

    const item = document.createElement('li');
    const badge = document.createElement('span');

    badge.className = 'badge red';
    badge.textContent = 'Alta';

    item.appendChild(badge);
    item.appendChild(
      document.createTextNode(
        ` Consumo de ${demoConsumptionHU8} kWh: ` +
        `${excess} kWh por encima del límite de ` +
        `${consumptionLimitHU8} kWh.`
      )
    );

    alertListHU8.appendChild(item);
  } else {
    alertStatusHU8.textContent =
      'Consumo dentro del límite establecido.';

    const item = document.createElement('li');
    const badge = document.createElement('span');

    badge.className = 'badge amber';
    badge.textContent = 'Normal';

    item.appendChild(badge);
    item.appendChild(
      document.createTextNode(
        ` Consumo de ${demoConsumptionHU8} kWh; ` +
        `límite de ${consumptionLimitHU8} kWh.`
      )
    );

    alertListHU8.appendChild(item);
  }
}

updateAlertsHU8();



/* HU-9: Historial de consumo energético */

// Datos ficticios para demostrar la consulta del historial.
const demoHistoryHU9 = [
  { period: 'Día 1', daysAgo: 0, consumption: 245, variation: '+8%' },
  { period: 'Día 2', daysAgo: 1, consumption: 226, variation: '+3%' },
  { period: 'Día 3', daysAgo: 2, consumption: 219, variation: '-2%' },
  { period: 'Día 4', daysAgo: 3, consumption: 238, variation: '+6%' },
  { period: 'Día 5', daysAgo: 4, consumption: 210, variation: '-4%' },
  { period: 'Día 6', daysAgo: 5, consumption: 205, variation: '-5%' },
  { period: 'Día 7', daysAgo: 6, consumption: 198, variation: '-7%' },
  { period: 'Día 8', daysAgo: 9, consumption: 232, variation: '+4%' },
  { period: 'Día 9', daysAgo: 14, consumption: 215, variation: '-3%' },
  { period: 'Día 10', daysAgo: 20, consumption: 201, variation: '-6%' },
  { period: 'Día 11', daysAgo: 25, consumption: 224, variation: '+2%' },
  { period: 'Día 12', daysAgo: 29, consumption: 190, variation: '-9%' }
];

const historyPeriodHU9 =
  document.getElementById('historyPeriodHU9');

const historyTableHU9 =
  document.getElementById('historyTableHU9');

const historySummaryHU9 =
  document.getElementById('historySummaryHU9');

function updateHistoryHU9() {
  if (!historyPeriodHU9 || !historyTableHU9 || !historySummaryHU9) {
    return;
  }

  const selectedPeriod = historyPeriodHU9.value;

  let filteredHistory = demoHistoryHU9;

  if (selectedPeriod === 'week') {
    filteredHistory = demoHistoryHU9.filter(
      (entry) => entry.daysAgo < 7
    );
  } else if (selectedPeriod === 'month') {
    filteredHistory = demoHistoryHU9.filter(
      (entry) => entry.daysAgo < 30
    );
  }

  historyTableHU9.replaceChildren();

  filteredHistory.forEach((entry) => {
    const row = document.createElement('tr');

    const periodCell = document.createElement('td');
    periodCell.textContent = entry.period;

    const consumptionCell = document.createElement('td');
    consumptionCell.textContent = `${entry.consumption} kWh`;

    const variationCell = document.createElement('td');
    variationCell.textContent = entry.variation;

    row.append(periodCell, consumptionCell, variationCell);
    historyTableHU9.appendChild(row);
  });

  historySummaryHU9.textContent = filteredHistory.length
    ? `Se muestran ${filteredHistory.length} registros de consumo.`
    : 'No hay registros para el periodo seleccionado.';
}

if (historyPeriodHU9) {
  historyPeriodHU9.addEventListener('change', updateHistoryHU9);
  updateHistoryHU9();
}


/* HU-11: Descargar historial de consumo en PDF */

const downloadHistoryPDFHU11 =
  document.getElementById('downloadHistoryPDFHU11');

function downloadHistoryAsPDFHU11() {
  // Comprobar que la librería está disponible.
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert(
      'No se pudo cargar el generador de PDF. ' +
      'Verifica tu conexión a Internet e inténtalo nuevamente.'
    );
    return;
  }

  // Obtener el historial según el filtro seleccionado.
  const selectedPeriod = historyPeriodHU9.value;

  let filteredHistory = demoHistoryHU9;

  if (selectedPeriod === 'week') {
    filteredHistory = demoHistoryHU9.filter(
      (entry) => entry.daysAgo < 7
    );
  } else if (selectedPeriod === 'month') {
    filteredHistory = demoHistoryHU9.filter(
      (entry) => entry.daysAgo < 30
    );
  }

  // HU-11: validar si existen registros.
  if (filteredHistory.length === 0) {
    alert(
      'No existen registros de consumo para descargar.'
    );
    return;
  }

  // Crear el documento PDF.
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  pdf.setFontSize(18);
  pdf.text('EMPower - Historial de consumo energético', 14, 20);

  pdf.setFontSize(10);
  pdf.text(
    `Fecha de generación: ${new Date().toLocaleDateString('es-CO')}`,
    14,
    30
  );

  const periodLabels = {
    all: 'Todos los periodos',
    week: 'Últimos 7 días',
    month: 'Últimos 30 días'
  };

  pdf.text(
    `Periodo consultado: ${periodLabels[selectedPeriod]}`,
    14,
    37
  );

  // Encabezados de la tabla.
  let y = 50;

  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.text('Periodo', 14, y);
  pdf.text('Consumo', 85, y);
  pdf.text('Variación', 135, y);

  pdf.line(14, y + 3, 195, y + 3);

  // Filas del historial.
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(10);
  y += 12;

  filteredHistory.forEach((entry) => {
    // Añadir página si no queda espacio suficiente.
    if (y > 275) {
      pdf.addPage();
      y = 20;
    }

    pdf.text(String(entry.period), 14, y);
    pdf.text(`${entry.consumption} kWh`, 85, y);
    pdf.text(String(entry.variation), 135, y);

    y += 9;
  });

  // Resumen del consumo exportado.
  const total = filteredHistory.reduce(
    (sum, entry) => sum + entry.consumption,
    0
  );

  if (y > 270) {
    pdf.addPage();
    y = 20;
  } else {
    y += 5;
  }

  pdf.line(14, y, 195, y);
  y += 9;

  pdf.setFont(undefined, 'bold');
  pdf.text(
    `Registros exportados: ${filteredHistory.length}`,
    14,
    y
  );

  y += 8;

  pdf.text(
    `Consumo acumulado: ${total} kWh`,
    14,
    y
  );

  // Descargar el archivo.
  pdf.save('historial-consumo-empower.pdf');
}

if (downloadHistoryPDFHU11) {
  downloadHistoryPDFHU11.addEventListener(
    'click',
    downloadHistoryAsPDFHU11
  );
}



/* HU-10: Comparación de periodos de consumo */

const comparePeriod1HU10 =
  document.getElementById('comparePeriod1HU10');

const comparePeriod2HU10 =
  document.getElementById('comparePeriod2HU10');

const compareButtonHU10 =
  document.getElementById('compareButtonHU10');

const comparisonResultHU10 =
  document.getElementById('comparisonResultHU10');

function getComparisonRecordsHU10(period, referencePeriod) {
  // Usa los registros de demostración definidos en la HU-9.
  if (period === 'week') {
    return demoHistoryHU9.filter(
      (entry) => entry.daysAgo >= 0 && entry.daysAgo < 7
    );
  }

  if (period === 'month') {
    return demoHistoryHU9.filter(
      (entry) => entry.daysAgo >= 0 && entry.daysAgo < 30
    );
  }

  // "Periodo anterior" corresponde al periodo inmediatamente previo
  // de la misma duración que el primer periodo seleccionado.
  if (period === 'previous') {
    if (referencePeriod === 'week') {
      return demoHistoryHU9.filter(
        (entry) => entry.daysAgo >= 7 && entry.daysAgo < 14
      );
    }

    if (referencePeriod === 'month') {
      return demoHistoryHU9.filter(
        (entry) => entry.daysAgo >= 30 && entry.daysAgo < 60
      );
    }
  }

  return [];
}

function compareConsumptionHU10() {
  if (
    !comparePeriod1HU10 ||
    !comparePeriod2HU10 ||
    !comparisonResultHU10
  ) {
    return;
  }

  const firstPeriod = comparePeriod1HU10.value;
  const secondPeriod = comparePeriod2HU10.value;

  if (firstPeriod === secondPeriod) {
    comparisonResultHU10.textContent =
      'Selecciona dos periodos diferentes para compararlos.';
    return;
  }

  const firstRecords = getComparisonRecordsHU10(
    firstPeriod,
    firstPeriod
  );

  const secondRecords = getComparisonRecordsHU10(
    secondPeriod,
    firstPeriod
  );

  if (!firstRecords.length || !secondRecords.length) {
    comparisonResultHU10.textContent =
      'No existen datos suficientes en uno o ambos periodos ' +
      'para realizar la comparación.';
    return;
  }

  const firstConsumption = firstRecords.reduce(
    (total, entry) => total + entry.consumption,
    0
  );

  const secondConsumption = secondRecords.reduce(
    (total, entry) => total + entry.consumption,
    0
  );

  const difference = firstConsumption - secondConsumption;

  let interpretation;

  if (difference > 0) {
    interpretation =
      `El primer periodo registra ${difference} kWh más de consumo.`;
  } else if (difference < 0) {
    interpretation =
      `El primer periodo registra ${Math.abs(difference)} kWh menos de consumo.`;
  } else {
    interpretation =
      'Ambos periodos registran el mismo consumo.';
  }

  comparisonResultHU10.textContent =
    `Primer periodo: ${firstConsumption} kWh. ` +
    `Segundo periodo: ${secondConsumption} kWh. ` +
    `Diferencia: ${Math.abs(difference)} kWh. ` +
    interpretation;
}

if (compareButtonHU10) {
  compareButtonHU10.addEventListener(
    'click',
    compareConsumptionHU10
  );
}
