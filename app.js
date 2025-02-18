import { db } from './firebase-config.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy,
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// State management
const state = {
  totalGoal: 199000,
  contributions: [],
  goals: [
    { name: 'Apresentação', amount: 100000, priority: 1, emoji: '🎭' },
    { name: 'Motorizada', amount: 35000, priority: 2, emoji: '🛵' },
    { name: 'Notebook', amount: 25000, priority: 3, emoji: '💻' },
    { name: 'Geleira', amount: 25000, priority: 4, emoji: '❄️' },
    { name: 'TV', amount: 10000, priority: 5, emoji: '📺' },
    { name: 'Acessórios', amount: 4000, priority: 6, emoji: '🎮' }
  ]
};

// Initialize charts
let progressChart;

document.addEventListener('DOMContentLoaded', async () => {
  initializeCharts();
  setupEventListeners();
  renderGoals();
  await loadContributions();
  setupRealtimeListeners();
  
  // Show initial section
  showSection('overview');
});

async function loadContributions() {
  const q = query(collection(db, "contributions"), orderBy("date", "desc"));
  const querySnapshot = await getDocs(q);
  state.contributions = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: doc.data().date // Ensure date is properly handled
  }));
  
  updateContributionsTable();
  updateProgressChart();
  updateSummary();
}

function setupRealtimeListeners() {
  const q = query(collection(db, "contributions"), orderBy("date", "desc"));
  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const contribution = {
          id: change.doc.id,
          ...change.doc.data()
        };
        if (!state.contributions.find(c => c.id === contribution.id)) {
          state.contributions.push(contribution);
        }
      }
    });
    
    updateContributionsTable();
    updateProgressChart();
    updateSummary();
  });
}

async function handleNewContribution(e) {
  e.preventDefault();
  
  const contribution = {
    participant: document.getElementById('participant').value,
    amount: Number(document.getElementById('amount').value),
    date: document.getElementById('date').value,
    timestamp: new Date().toISOString()
  };
  
  try {
    await addDoc(collection(db, "contributions"), contribution);
    e.target.reset();
  } catch (error) {
    console.error("Error adding contribution: ", error);
    alert("Erro ao adicionar contribuição. Tente novamente.");
  }
}

function initializeCharts() {
  const ctx = document.getElementById('progressChart').getContext('2d');
  progressChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Valor Acumulado',
        data: [],
        borderColor: '#2196F3',
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += context.parsed.y + ' MZN';
              
              // Add emojis for achieved goals
              const value = context.parsed.y;
              let achievedGoals = '';
              let remainingValue = value;
              
              state.goals.forEach(goal => {
                if (remainingValue >= goal.amount) {
                  achievedGoals += ' ' + goal.emoji;
                  remainingValue -= goal.amount;
                }
              });
              
              if (achievedGoals) {
                label += ' ' + achievedGoals;
              }
              
              return label;
            }
          }
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
}

function setupEventListeners() {
  const contributionForm = document.getElementById('contributionForm');
  contributionForm.addEventListener('submit', handleNewContribution);
  
  // Add navigation button event listeners
  document.querySelectorAll('nav button').forEach(button => {
    button.addEventListener('click', (e) => {
      const sectionId = e.target.getAttribute('data-section');
      showSection(sectionId);
    });
  });
}

function updateContributionsTable() {
  const tbody = document.querySelector('#contributionsTable tbody');
  tbody.innerHTML = '';
  
  state.contributions
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(contribution => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(contribution.date).toLocaleDateString()}</td>
        <td>${contribution.participant}</td>
        <td>${contribution.amount} MZN</td>
      `;
      tbody.appendChild(row);
    });
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
  
  progressChart.data.labels = dates.map(date => new Date(date).toLocaleDateString());
  progressChart.data.datasets[0].data = data;
  progressChart.update();
}

function updateSummary() {
  const totalSaved = state.contributions.reduce((sum, c) => sum + c.amount, 0);
  const remaining = state.totalGoal - totalSaved;
  
  document.getElementById('totalGoal').textContent = `${state.totalGoal} MZN`;
  document.getElementById('totalSaved').textContent = `${totalSaved} MZN`;
  document.getElementById('remaining').textContent = `${remaining} MZN`;
  
  updateGoalsProgress(totalSaved);
}

function renderGoals() {
  const goalsList = document.getElementById('goalsList');
  goalsList.innerHTML = '';
  
  state.goals.forEach(goal => {
    const goalElement = document.createElement('div');
    goalElement.className = 'goal-item';
    goalElement.innerHTML = `
      <div>
        <h3>${goal.emoji} ${goal.name}</h3>
        <p>${goal.amount} MZN</p>
        <div class="goal-progress">
          <div class="goal-progress-bar" id="progress-${goal.name}"></div>
        </div>
      </div>
    `;
    goalsList.appendChild(goalElement);
  });
}

function updateGoalsProgress(totalSaved) {
  let remainingSavings = totalSaved;
  
  state.goals.forEach(goal => {
    const progressBar = document.getElementById(`progress-${goal.name}`);
    const percentage = Math.min(100, (remainingSavings / goal.amount) * 100);
    progressBar.style.width = `${percentage}%`;
    if (percentage >= 100) {
      progressBar.classList.add('completed');
    } else {
      progressBar.classList.remove('completed');
    }
    remainingSavings = Math.max(0, remainingSavings - goal.amount);
  });
}

function showSection(sectionId) {
  document.querySelectorAll('section').forEach(section => {
    section.classList.remove('active');
  });
  document.querySelectorAll('nav button').forEach(button => {
    button.classList.remove('active');
  });
  
  document.getElementById(sectionId).classList.add('active');
  document.querySelector(`button[data-section='${sectionId}']`).classList.add('active');
}