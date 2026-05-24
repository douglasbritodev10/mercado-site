import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBoo2AKRXqbhnw96CG7KcnW_Gw7ZDKrzhw",
  authDomain: "trabalhopei1-ana.firebaseapp.com",
  projectId: "trabalhopei1-ana",
  storageBucket: "trabalhopei1-ana.firebasestorage.app",
  messagingSenderId: "231358659909",
  appId: "1:231358659909:web:e60c6b5e0fd5ea7806122c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
