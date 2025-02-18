// User management
const userNames = {
  'camilowilliam0@gmail.com': 'Camilo Duvane',
  'cintiajaime11@gmail.com': 'Cíntia Mucumbi'
};

const validCredentials = {
  'camilowilliam0@gmail.com': ['6363', '1234'],
  'cintiajaime11@gmail.com': ['4321']
};

let currentUser = null;

// State management
const state = {
  totalGoal: 0,
  contributions: [],
  goals: []
};

let progressChart = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('user-select-screen').style.display = 'flex';
});

function selectUser(email, password) {
  login(email, password);
}

// Update the login function
async function login(email, password) {
  try {
    const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    currentUser = {
      email: user.email,
      username: userNames[user.email] || user.email,
      role: user.email === 'camilowilliam0@gmail.com' ? 'admin' : 'participant'
    };
    
    document.getElementById('user-select-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('currentUser').textContent = `Olá, ${currentUser.username}`;
    
    if (currentUser.role === 'admin') {
      document.getElementById('adminUsersBtn').style.display = 'block';
      document.getElementById('adminActions').style.display = 'table-cell';
    }
    
    // Load data and initialize app
    await loadFirestoreData();
    initializeApp();
  } catch (error) {
    console.error('Error:', error);
    alert('Erro ao entrar no sistema. Tente novamente.');
  }
}

// Update the logout function
function logout() {
  currentUser = null;
  document.getElementById('user-select-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

async function loadFirestoreData() {
  try {
    // Load contributions
    const contributionsSnapshot = await window.firebaseGetDocs(
      window.firebaseCollection(window.firebaseDb, 'contributions')
    );
    state.contributions = contributionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Load goals
    const goalsSnapshot = await window.firebaseGetDocs(
      window.firebaseCollection(window.firebaseDb, 'goals')
    );
    state.goals = goalsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error loading data from Firestore:', error);
  }
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
    participant: currentUser.username,
    amount: Number(document.getElementById('amount').value),
    date: document.getElementById('date').value,
    createdAt: new Date().toISOString()
  };
  
  try {
    // Save to Firestore
    const docRef = await window.firebaseAddDoc(
      window.firebaseCollection(window.firebaseDb, 'contributions'),
      contribution
    );
    
    // Update local state
    state.contributions.push({ ...contribution, id: docRef.id });
    updateContributionsTable();
    updateProgressChart();
    updateSummary();
    e.target.reset();
  } catch (error) {
    console.error('Error saving contribution:', error);
    alert('Erro ao salvar contribuição. Tente novamente.');
  }
}

async function deleteContribution(id) {
  if (confirm('Tem certeza que deseja excluir esta contribuição?')) {
    try {
      // Delete from Firestore
      await window.firebaseDeleteDoc(
        window.firebaseDoc(window.firebaseDb, 'contributions', id)
      );
      
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
    name: document.getElementById('goalName').value,
    amount: Number(document.getElementById('goalAmount').value)
  };
  
  try {
    // Save to Firestore
    const docRef = await window.firebaseAddDoc(
      window.firebaseCollection(window.firebaseDb, 'goals'),
      goal
    );
    
    // Update local state
    state.goals.push({ ...goal, id: docRef.id });
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
      name: newName,
      amount: newAmount
    };
    
    // Update in Firestore
    await window.firebaseUpdateDoc(
      window.firebaseDoc(window.firebaseDb, 'goals', id),
      updatedGoal
    );
    
    // Update local state
    const goalIndex = state.goals.findIndex(g => g.id === id);
    if (goalIndex !== -1) {
      state.goals[goalIndex] = { ...state.goals[goalIndex], name: newName, amount: newAmount };
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
      // Delete from Firestore
      await window.firebaseDeleteDoc(
        window.firebaseDoc(window.firebaseDb, 'goals', id)
      );
      
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