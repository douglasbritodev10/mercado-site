import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById('authForm');
const toggle = document.getElementById('toggleAuth');
const regNameInput = document.getElementById('regName');
const emailInput = document.getElementById('email'); // Capturando o campo de email/user
const userCheckMsg = document.getElementById('userCheckMsg');

let isLogin = true;
let isNameAvailable = false;

// --- 1. TROCAR ENTRE LOGIN E CADASTRO (AJUSTADO) ---
toggle.onclick = () => {
    isLogin = !isLogin;
    isNameAvailable = false; // Reseta a verificação ao trocar de tela
    userCheckMsg.innerText = "";
    regNameInput.value = "";
    emailInput.value = "";
    
    document.getElementById('authTitle').innerText = isLogin ? "Entrar" : "Criar Conta";
    document.getElementById('userBox').style.display = isLogin ? "none" : "block";
    document.getElementById('btnMain').innerText = isLogin ? "Acessar" : "Cadastrar";
    
    // Ajuste de labels e placeholders
    const labelEmail = document.getElementById('labelEmail');
    labelEmail.innerText = isLogin ? "Nome de Usuário" : "Seu Melhor E-mail";
    emailInput.placeholder = isLogin ? "EX: JPAULO" : "exemplo@email.com";

    toggle.innerHTML = isLogin ? 
        'Novo por aqui? <span style="color: var(--primary); font-weight: bold;">Cadastre-se</span>' : 
        'Já tem conta? <span style="color: var(--primary); font-weight: bold;">Entre aqui</span>';
};

// --- 2. PADRONIZAÇÃO DE INPUTS (NOME MAIÚSCULO / EMAIL LIVRE) ---
emailInput.addEventListener('input', (e) => {
    if (isLogin) {
        // No LOGIN: Se não tem @, força maiúsculo e trava em 10 letras
        if (!e.target.value.includes('@')) {
            e.target.value = e.target.value.toUpperCase().substring(0, 10);
            e.target.style.textTransform = "uppercase";
        } else {
            e.target.style.textTransform = "none";
        }
    } else {
        // NO CADASTRO: Email totalmente livre, sem limite e sem caixa alta forçada
        e.target.style.textTransform = "none";
    }
});

// Campo de Nome de Usuário no Cadastro: Sempre Maiúsculo e Max 10
regNameInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().substring(0, 10);
});

// --- 3. VERIFICAR NOME DE USUÁRIO EM TEMPO REAL ---
regNameInput.addEventListener('input', async (e) => {
    const nome = e.target.value.trim().toUpperCase();
    
    if (nome.length < 3) {
        userCheckMsg.innerText = "Mínimo 3 letras";
        userCheckMsg.style.color = "orange";
        isNameAvailable = false;
        return;
    }

    userCheckMsg.innerText = "Verificando...";
    userCheckMsg.style.color = "gray";

    // Consulta no Firestore para ver se o nome já existe
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

// --- 4. SUBMISSÃO DO FORMULÁRIO ---
form.onsubmit = async (e) => {
    e.preventDefault();
    const loginInput = emailInput.value.trim().toUpperCase(); 
    const pass = document.getElementById('password').value;
    const btn = document.getElementById('btnMain');
    
    btn.disabled = true;
    btn.innerText = "Processando...";

    try {
        if (isLogin) {
            let emailParaLogin = loginInput;

            // Se não contém '@', buscamos o e-mail pelo NOME em MAIÚSCULO
            if (!loginInput.includes('@')) {
                const q = query(collection(db, "usuarios"), where("nome", "==", loginInput));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    throw new Error("Nome de usuário não encontrado.");
                }
                emailParaLogin = querySnapshot.docs[0].data().email;
            }

            const res = await signInWithEmailAndPassword(auth, emailParaLogin.toLowerCase(), pass);
            const userDoc = await getDoc(doc(db, "usuarios", res.user.uid));
            
            if (userDoc.exists()) {
                const role = userDoc.data().role;
                window.location.href = (role === "admin" || role === "colaborador") ? "pagina.html" : "aguardar.html";
            } else {
                window.location.href = "aguardar.html";
            }

        } else {
            // CADASTRO
            const name = regNameInput.value.trim().toUpperCase();
            const email = emailInput.value.trim().toLowerCase(); // Email sempre salva lowcase no Auth
            
            if (!isNameAvailable) throw new Error("Escolha um nome disponível.");

            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: name });

            await setDoc(doc(db, "usuarios", res.user.uid), {
                nome: name, // Salva em MAIÚSCULO
                email: email,
                role: "cliente", 
                dataCriacao: new Date().toISOString()
            });

            alert("Cadastro realizado!");
            window.location.href = "aguardar.html";
        }
    } catch (err) {
        let msg = err.message;
        if(err.code === 'auth/invalid-credential') msg = "Dados incorretos.";
        alert("Erro: " + msg);
        btn.disabled = false;
        btn.innerText = isLogin ? "Acessar" : "Cadastrar";
    }
};
