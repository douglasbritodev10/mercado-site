import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById('authForm');
const toggle = document.getElementById('toggleAuth');
const regNameInput = document.getElementById('regName');
const userCheckMsg = document.getElementById('userCheckMsg');

let isLogin = true;
let isNameAvailable = false;

// --- 1. TROCAR ENTRE LOGIN E CADASTRO ---
toggle.onclick = () => {
    isLogin = !isLogin;
    document.getElementById('authTitle').innerText = isLogin ? "Entrar" : "Criar Conta";
    document.getElementById('userBox').style.display = isLogin ? "none" : "block";
    document.getElementById('btnMain').innerText = isLogin ? "Acessar" : "Cadastrar";
    toggle.innerHTML = isLogin ? 'Novo por aqui? <span style="color: var(--primary); font-weight: bold;">Cadastre-se</span>' : 'Já tem conta? <span style="color: var(--primary); font-weight: bold;">Entre aqui</span>';
};

// --- 2. VERIFICAR NOME DE USUÁRIO EM TEMPO REAL ---
regNameInput.addEventListener('input', async (e) => {
    const nome = e.target.value.trim().toLowerCase();
    if (nome.length < 3) {
        userCheckMsg.innerText = "";
        return;
    }

    userCheckMsg.innerText = "Verificando...";
    userCheckMsg.style.color = "gray";

    const q = query(collection(db, "usuarios"), where("nome", "==", nome));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        userCheckMsg.innerText = "❌ Nome já em uso";
        userCheckMsg.style.color = "red";
        isNameAvailable = false;
    } else {
        userCheckMsg.innerText = "✅ Disponível";
        userCheckMsg.style.color = "green";
        isNameAvailable = true;
    }
});

// --- 3. SUBMISSÃO DO FORMULÁRIO ---
form.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const btn = document.getElementById('btnMain');
    
    btn.disabled = true;
    btn.innerText = "Processando...";

    try {
        if (isLogin) {
            // LOGIN
            const res = await signInWithEmailAndPassword(auth, email, pass);
            
            // VERIFICAR NÍVEL DE ACESSO NO BANCO
            const userDoc = await getDoc(doc(db, "usuarios", res.user.uid));
            
            if (userDoc.exists()) {
                const role = userDoc.data().role;
                if (role === "admin" || role === "colaborador") {
                    window.location.href = "pagina.html";
                } else {
                    window.location.href = "aguardar.html";
                }
            } else {
                // Caso o usuário exista no Auth mas não no Firestore (segurança extra)
                window.location.href = "aguardar.html";
            }

        } else {
            // CADASTRO
            const name = regNameInput.value.trim().toLowerCase();
            
            if (!isNameAvailable) {
                throw new Error("Por favor, escolha um nome de usuário disponível.");
            }

            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: name });

            // SALVAR NO FIRESTORE COM ROLE PADRÃO 'CLIENTE'
            await setDoc(doc(db, "usuarios", res.user.uid), {
                nome: name,
                email: email,
                role: "cliente", // Todo novo usuário começa bloqueado
                dataCriacao: new Date().toISOString()
            });

            alert("Cadastro realizado! Aguarde a liberação do administrador.");
            window.location.href = "aguardar.html";
        }
    } catch (err) {
        alert("Erro: " + err.message);
        btn.disabled = false;
        btn.innerText = isLogin ? "Acessar" : "Cadastrar";
    }
};
