// User management
const users = [
  { username: 'CWD', password: '1234', role: 'admin' },
  { username: 'Camilo Duvane', password: '6363', role: 'participant' },
  { username: 'Cíntia Mucumbi', password: '4321', role: 'participant' }
];

let currentUser = null;
let progressChart = null;
let contributionsRef;
let goalsRef;

// State management
const state = {
  totalGoal: 0,
  contributions: [],
  goals: [
    { id: 1, name: 'TV', amount: 10000 },
    { id: 2, name: 'Notebook', amount: 6000 },
    { id: 3, name: 'Acessórios', amount: 4000 }
  ]
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupLoginForm();
  if (localStorage.getItem('currentUser')) {
    const savedUser = JSON.parse(localStorage.getItem('currentUser'));
    await login(savedUser.username, savedUser.password, true);
  }
});

function setupLoginForm() {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const loginButton = e.target.querySelector('button[type="submit"]');
    loginButton.disabled = true;
    loginButton.textContent = 'Entrando...';
    
    try {
      await login(username, password);
    } catch (error) {
      console.error('Login error:', error);
      alert('Erro ao fazer login. Tente novamente.');
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Entrar';
    }
  });
}

async function login(username, password, autoLogin = false) {
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    try {
      currentUser = user;
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      // Initialize Firebase refs
      const db = window.firebaseDatabase;
      contributionsRef = window.firebaseRef(db, 'contributions');
      goalsRef = window.firebaseRef(db, 'goals');
      
      // Load data from Firebase
      await loadFirebaseData();
      
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      document.getElementById('currentUser').textContent = `Olá, ${user.username}`;
      
      if (user.role === 'admin') {
        document.getElementById('adminUsersBtn').style.display = 'block';
        document.getElementById('adminActions').style.display = 'table-cell';
      }
      
      initializeApp();
      showSection('overview');
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  } else if (!autoLogin) {
    alert('Usuário ou senha inválidos!');
  }
}

async function loadFirebaseData() {
  try {
    // Load contributions
    const contributionsSnapshot = await window.firebaseGet(contributionsRef);
    if (contributionsSnapshot.exists()) {
      state.contributions = Object.values(contributionsSnapshot.val());
    }

    // Load goals
    const goalsSnapshot = await window.firebaseGet(goalsRef);
    if (goalsSnapshot.exists()) {
      state.goals = Object.values(goalsSnapshot.val());
    }
  } catch (error) {
    console.error('Error loading data from Firebase:', error);
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

function initializeApp() {
  initializeCharts();
  setupEventListeners();
  renderGoals();
  updateSummary();
  if (currentUser.role === 'admin') {
    setupUserManagement();
  }
}

function initializeCharts() {
  const ctx = document.getElementById('progressChart').getContext('2d');
  
  // Destroy existing chart if it exists
  if (progressChart) {
    progressChart.destroy();
  }
  
  progressChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Valor Acumulado',
        data: [],
        borderColor: '#2196F3',
        tension: 0.4,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        annotation: {
          annotations: []
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => `${value} MZN`
          }
        }
      }
    }
  });

  return progressChart;
}

function setupEventListeners() {
  const contributionForm = document.getElementById('contributionForm');
  contributionForm.addEventListener('submit', handleNewContribution);

  const goalForm = document.getElementById('goalForm');
  goalForm.addEventListener('submit', handleNewGoal);
}

async function handleNewContribution(e) {
  e.preventDefault();
  
  const contribution = {
    id: Date.now(),
    participant: currentUser.username,
    amount: Number(document.getElementById('amount').value),
    date: document.getElementById('date').value
  };
  
  try {
    // Save to Firebase
    await window.firebaseSet(window.firebaseRef(window.firebaseDatabase, `contributions/${contribution.id}`), contribution);
    
    // Update local state
    state.contributions.push(contribution);
    updateContributionsTable();
    updateProgressChart();
    updateSummary();
    e.target.reset();
  } catch (error) {
    console.error('Error saving contribution:', error);
    alert('Erro ao salvar contribuição. Tente novamente.');
  }
}

function updateContributionsTable() {
  const tbody = document.querySelector('#contributionsTable tbody');
  tbody.innerHTML = '';
  
  state.contributions
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(contribution => {
      const row = document.createElement('tr');
      let html = `
        <td>${new Date(contribution.date).toLocaleDateString()}</td>
        <td>${contribution.participant}</td>
        <td>${contribution.amount} MZN</td>
      `;
      
      if (currentUser.role === 'admin') {
        html += `
          <td>
            <button class="delete-btn" onclick="deleteContribution('${contribution.id}')">
              Excluir
            </button>
          </td>
        `;
      }
      
      row.innerHTML = html;
      tbody.appendChild(row);
    });
}

async function deleteContribution(id) {
  if (confirm('Tem certeza que deseja excluir esta contribuição?')) {
    try {
      // Delete from Firebase
      await window.firebaseRemove(window.firebaseRef(window.firebaseDatabase, `contributions/${id}`));
      
      // Update local state
      state.contributions = state.contributions.filter(c => c.id !== id);
      updateContributionsTable();
      updateProgressChart();
      updateSummary();
    } catch (error) {
      console.error('Error deleting contribution:', error);
      alert('Erro ao excluir contribuição. Tente novamente.');
    }
  }
}

async function handleNewGoal(e) {
  e.preventDefault();
  
  const goal = {
    id: Date.now(),
    name: document.getElementById('goalName').value,
    amount: Number(document.getElementById('goalAmount').value)
  };
  
  try {
    // Save to Firebase
    await window.firebaseSet(window.firebaseRef(window.firebaseDatabase, `goals/${goal.id}`), goal);
    
    // Update local state
    state.goals.push(goal);
    renderGoals();
    updateSummary();
    e.target.reset();
  } catch (error) {
    console.error('Error saving goal:', error);
    alert('Erro ao salvar objetivo. Tente novamente.');
  }
}

async function updateGoal(id, newName, newAmount) {
  try {
    const updatedGoal = {
      id,
      name: newName,
      amount: Number(newAmount)
    };
    
    // Update in Firebase
    await window.firebaseSet(window.firebaseRef(window.firebaseDatabase, `goals/${id}`), updatedGoal);
    
    // Update local state
    const goalIndex = state.goals.findIndex(g => g.id === id);
    if (goalIndex !== -1) {
      state.goals[goalIndex] = updatedGoal;
      renderGoals();
      updateSummary();
    }
  } catch (error) {
    console.error('Error updating goal:', error);
    alert('Erro ao atualizar objetivo. Tente novamente.');
  }
}

async function deleteGoal(id) {
  if (confirm('Tem certeza que deseja excluir este objetivo?')) {
    try {
      // Delete from Firebase
      await window.firebaseRemove(window.firebaseRef(window.firebaseDatabase, `goals/${id}`));
      
      // Update local state
      state.goals = state.goals.filter(g => g.id !== id);
      renderGoals();
      updateSummary();
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Erro ao excluir objetivo. Tente novamente.');
    }
  }
}

function setupUserManagement() {
  document.getElementById('userForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('userRole').value;
    
    users.push({ username, password, role });
    updateUsersTable();
    e.target.reset();
  });
  
  updateUsersTable();
}

function updateUsersTable() {
  const tbody = document.querySelector('#usersTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  users.forEach(user => {
    if (user.username !== currentUser.username) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${user.username}</td>
        <td>${user.role === 'admin' ? 'Administrador' : 'Participante'}</td>
        <td>
          <button class="delete-btn" onclick="deleteUser('${user.username}')">
            Excluir
          </button>
        </td>
      `;
      tbody.appendChild(row);
    }
  });
}

function deleteUser(username) {
  if (confirm(`Tem certeza que deseja excluir o usuário ${username}?`)) {
    const index = users.findIndex(u => u.username === username);
    if (index !== -1) {
      users.splice(index, 1);
      updateUsersTable();
    }
  }
}

function updateProgressChart() {
  const dates = [...new Set(state.contributions.map(c => c.date))].sort();
  let accumulated = 0;
  const data = dates.map(date => {
    const dayTotal = state.contributions
      .filter(c => c.date === date)
      .reduce((sum, c) => sum + c.amount, 0);
    accumulated += dayTotal;
    return accumulated;
  });
  
  // Create annotations for goals
  const annotations = [];
  let runningTotal = 0;
  
  state.goals.forEach((goal, index) => {
    runningTotal += goal.amount;
    annotations.push({
      type: 'line',
      yMin: runningTotal,
      yMax: runningTotal,
      borderColor: '#FFC107',
      borderWidth: 2,
      label: {
        content: goal.name,
        enabled: true,
        position: 'end'
      }
    });
  });
  
  // Update chart
  if (progressChart) {
    progressChart.data.labels = dates.map(date => new Date(date).toLocaleDateString());
    progressChart.data.datasets[0].data = data;
    progressChart.options.plugins.annotation.annotations = annotations;
    progressChart.update();
  }
}

function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const toggleButton = document.querySelector('.toggle-password');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    `;
  } else {
    passwordInput.type = 'password';
    toggleButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    `;
  }
}

function renderGoals() {
  const goalsList = document.getElementById('goalsList');
  goalsList.innerHTML = '';
  
  state.goals.forEach(goal => {
    const goalElement = document.createElement('div');
    goalElement.className = 'goal-item';
    
    const isAdmin = currentUser.role === 'admin';
    const editControls = isAdmin ? `
      <div class="goal-controls">
        <button onclick="editGoalPrompt(${goal.id})" class="edit-btn">Editar</button>
        <button onclick="deleteGoal(${goal.id})" class="delete-btn">Excluir</button>
      </div>
    ` : '';
    
    goalElement.innerHTML = `
      <div>
        <h3>${goal.name}</h3>
        <p>${goal.amount} MZN</p>
        <div class="goal-progress">
          <div class="goal-progress-bar" id="progress-${goal.id}"></div>
        </div>
      </div>
      ${editControls}
    `;
    goalsList.appendChild(goalElement);
  });
}

function editGoalPrompt(id) {
  const goal = state.goals.find(g => g.id === id);
  if (!goal) return;
  
  const newName = prompt('Novo nome do objetivo:', goal.name);
  if (!newName) return;
  
  const newAmount = prompt('Novo valor do objetivo (MZN):', goal.amount);
  if (!newAmount || isNaN(Number(newAmount))) return;
  
  updateGoal(id, newName, Number(newAmount));
}

function updateGoalsProgress(totalSaved) {
  let remainingSavings = totalSaved;
  
  state.goals.forEach(goal => {
    const progressBar = document.getElementById(`progress-${goal.id}`);
    if (progressBar) {
      const percentage = Math.min(100, (remainingSavings / goal.amount) * 100);
      progressBar.style.width = `${percentage}%`;
      remainingSavings = Math.max(0, remainingSavings - goal.amount);
    }
  });
}

function updateSummary() {
  const totalSaved = state.contributions.reduce((sum, c) => sum + c.amount, 0);
  const totalGoal = state.goals.reduce((sum, goal) => sum + goal.amount, 0);
  const remaining = totalGoal - totalSaved;
  
  document.getElementById('totalGoal').textContent = `${totalGoal} MZN`;
  document.getElementById('totalSaved').textContent = `${totalSaved} MZN`;
  document.getElementById('remaining').textContent = `${remaining} MZN`;
  
  updateGoalsProgress(totalSaved);
}

function showSection(sectionId) {
  document.querySelectorAll('section').forEach(section => {
    section.classList.remove('active');
  });
  document.querySelectorAll('nav button').forEach(button => {
    button.classList.remove('active');
  });
  
  document.getElementById(sectionId).classList.add('active');
  document.querySelector(`button[onclick="showSection('${sectionId}')"]`).classList.add('active');
}

function getTotalGoal() {
  return state.goals.reduce((sum, goal) => sum + goal.amount, 0);
}