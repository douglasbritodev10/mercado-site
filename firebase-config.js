import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA7LDoSENl5WjAXptXX5w1aXiOcMRzp48g",
  authDomain: "casaecanil-90b27.firebaseapp.com",
  projectId: "casaecanil-90b27",
  storageBucket: "casaecanil-90b27.firebasestorage.app",
  messagingSenderId: "345869639725",
  appId: "1:345869639725:web:dbbca9ca5fdc95e9d958a4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
