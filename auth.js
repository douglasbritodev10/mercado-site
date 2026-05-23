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
    
    // Bloqueia o botão para evitar múltiplos cliques
    btn.disabled = true;
    btn.innerText = "Processando...";

    try {
        if(isLogin) {
            await signInWithEmailAndPassword(auth, email, pass);
            window.location.href = "pagina.html"; // Use o nome correto da sua página
        } else {
            const name = document.getElementById('regName').value;
            if(!name) throw new Error("Por favor, digite um nome de usuário.");
            if(pass.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");

            const res = await createUserWithEmailAndPassword(auth, email, pass);
            
            // Atualiza o perfil no Authentication
            await updateProfile(res.user, { displayName: name });

            // SALVANDO NA COLEÇÃO (O que você sentiu falta):
            // Criamos um documento na coleção 'usuarios' com o ID do Auth
            await setDoc(doc(db, "usuarios", res.user.uid), {
                nome: name,
                email: email,
                role: "colaborador", // Padrão
                dataCriacao: new Date().toISOString()
            });

            alert("Conta criada com sucesso!");
            window.location.href = "pagina.html";
        }
    } catch (err) {
        console.error("Erro detalhado:", err.code, err.message);
        alert("Erro: " + err.message);
        btn.disabled = false;
        btn.innerText = isLogin ? "Acessar" : "Cadastrar";
    }
};
