import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const form = document.getElementById('authForm');
const toggle = document.getElementById('toggleAuth');
let isLogin = true;

toggle.onclick = () => {
    isLogin = !isLogin;
    document.getElementById('authTitle').innerText = isLogin ? "Entrar" : "Criar Conta";
    document.getElementById('userBox').style.display = isLogin ? "none" : "block";
    document.getElementById('btnMain').innerText = isLogin ? "Acessar" : "Cadastrar";
    toggle.innerText = isLogin ? "Já tem conta? Entre aqui" : "Novo por aqui? Cadastre-se";
};

form.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        if(isLogin) {
            await signInWithEmailAndPassword(auth, email, pass);
        } else {
            const name = document.getElementById('regName').value;
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: name });
        }
        window.location.href = "dashboard.html";
    } catch (err) { alert("Erro: " + err.message); }
};

onAuthStateChanged(auth, user => { if(user) window.location.href = "dashboard.html"; });
