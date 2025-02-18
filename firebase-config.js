import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5gjkbcUrcnRVU_5pdFfjGsfKTNVi99fY",
  authDomain: "alunos-9848d.firebaseapp.com",
  databaseURL: "https://alunos-9848d-default-rtdb.firebaseio.com",
  projectId: "alunos-9848d",
  storageBucket: "alunos-9848d.firebasestorage.app",
  messagingSenderId: "697570485120",
  appId: "1:697570485120:web:7667e3913f144fc7f3d765",
  measurementId: "G-ND3QML6L1P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const analytics = getAnalytics(app);

export { db };