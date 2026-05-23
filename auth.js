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

// --- 3. SUBMISSÃO DO FORMULÁRIO (LOGIN HÍBRIDO) ---
form.onsubmit = async (e) => {
    e.preventDefault();
    const loginInput = document.getElementById('email').value.trim(); // Pode ser e-mail ou username
    const pass = document.getElementById('password').value;
    const btn = document.getElementById('btnMain');
    
    btn.disabled = true;
    btn.innerText = "Processando...";

    try {
        if (isLogin) {
            // LÓGICA DE IDENTIFICAÇÃO (E-mail ou Username)
            let emailParaLogin = loginInput;

            // Se não contém '@', buscamos o e-mail correspondente ao nome de usuário no Firestore
            if (!loginInput.includes('@')) {
                const q = query(collection(db, "usuarios"), where("nome", "==", loginInput.toLowerCase()));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    throw new Error("Nome de usuário não encontrado.");
                }
                
                // Extrai o e-mail do documento encontrado
                emailParaLogin = querySnapshot.docs[0].data().email;
            }

            // Tenta o login com o e-mail resolvido
            const res = await signInWithEmailAndPassword(auth, emailParaLogin, pass);
            
            // VERIFICAR NÍVEL DE ACESSO NO BANCO APÓS LOGIN
            const userDoc = await getDoc(doc(db, "usuarios", res.user.uid));
            
            if (userDoc.exists()) {
                const role = userDoc.data().role;
                if (role === "admin" || role === "colaborador") {
                    window.location.href = "pagina.html";
                } else {
                    window.location.href = "aguardar.html";
                }
            } else {
                window.location.href = "aguardar.html";
            }

        } else {
            // LÓGICA DE CADASTRO
            const name = regNameInput.value.trim().toLowerCase();
            const email = document.getElementById('email').value.trim();
            
            if (!isNameAvailable) {
                throw new Error("Escolha um nome de usuário disponível.");
            }

            // 1. Cria no Auth
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            
            // 2. Atualiza perfil
            await updateProfile(res.user, { displayName: name });

            // 3. Salva dados extras e nível no Firestore
            await setDoc(doc(db, "usuarios", res.user.uid), {
                nome: name,
                email: email,
                role: "cliente", 
                dataCriacao: new Date().toISOString()
            });

            alert("Cadastro realizado! Aguarde a liberação.");
            window.location.href = "aguardar.html";
        }
    } catch (err) {
        // Tratamento de erros amigável
        let msg = err.message;
        if(err.code === 'auth/invalid-credential') msg = "Usuário ou senha incorretos.";
        if(err.code === 'auth/wrong-password') msg = "Senha incorreta.";
        if(err.code === 'auth/user-not-found') msg = "E-mail não cadastrado.";
        
        alert("Erro: " + msg);
        btn.disabled = false;
        btn.innerText = isLogin ? "Acessar" : "Cadastrar";
    }
};
