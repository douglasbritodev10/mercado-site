import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// Importe o Firestore para salvar na coleção se desejar
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    const btn = document.getElementById('btnMain');
    
    btn.disabled = true;
    btn.innerText = "Processando...";

    try {
        if(isLogin) {
            await signInWithEmailAndPassword(auth, email, pass);
            // IMPORTANTE: Verifique se o nome do arquivo é dashboard.html ou pagina.html
            window.location.href = "pagina.html"; 
        } else {
            const name = document.getElementById('regName').value;
            if(!name) throw new Error("Por favor, digite um nome de usuário.");
            
            // 1. Cria o usuário no Auth
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            
            // 2. Atualiza o nome no Perfil
            await updateProfile(res.user, { displayName: name });

            // 3. Salva no Firestore (Só vai funcionar se você mudar as REGRAS acima)
            await setDoc(doc(db, "usuarios", res.user.uid), {
                nome: name,
                email: email,
                role: "colaborador",
                dataCriacao: new Date().toISOString()
            });

            alert("Conta criada com sucesso!");
            window.location.href = "pagina.html";
        }
    } catch (err) {
        console.error("Erro detalhado:", err.code);
        if (err.code === 'auth/email-already-in-use') {
            alert("Este e-mail já está cadastrado. Tente fazer login.");
        } else {
            alert("Erro: " + err.message);
        }
        btn.disabled = false;
        btn.innerText = isLogin ? "Acessar" : "Cadastrar";
    }
};
