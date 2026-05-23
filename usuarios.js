import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let usersList = [];
let currentUserData = null;
let userBeingEdited = null;
const modalUser = new bootstrap.Modal('#modalUser');

// --- 1. VERIFICAÇÃO DE ADMIN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
            currentUserData = userDoc.data();
            document.getElementById('userNameDisplay').innerText = currentUserData.nome;
            loadUsers();
        } else {
            alert("Acesso negado. Apenas administradores.");
            window.location.href = "pagina.html";
        }
    } else {
        window.location.href = "index.html";
    }
});

// --- 2. LOG DE AÇÕES DETALHADO ---
async function registrarLog(tipo, detalhe) {
    await addDoc(collection(db, "historico"), {
        usuarioNome: currentUserData.nome,
        usuarioId: auth.currentUser.uid,
        acao: tipo,
        detalhe: detalhe,
        data: new Date().toLocaleString('pt-BR'),
        ts: serverTimestamp()
    });
}

// --- 3. CARREGAR USUÁRIOS ---
function loadUsers() {
    onSnapshot(query(collection(db, "usuarios"), orderBy("nome")), snap => {
        usersList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderUsers(usersList);
    });
}

function renderUsers(data) {
    const box = document.getElementById('listaUsuarios');
    box.innerHTML = "";

    data.forEach(u => {
        // Pula o próprio usuário logado para evitar se auto-excluir
        if (u.id === auth.currentUser.uid) return;

        const div = document.createElement('div');
        // Mantemos a classe original para o efeito de borda colorida
        div.className = `glass-card user-card ${u.role}`; 
        
        div.innerHTML = `
            <div class="user-card-content">
                <div class="user-info">
                    <strong class="text-uppercase d-block">${u.nome}</strong>
                    <span class="small text-muted">${u.email}</span>
                    <div class="badge-role bg-light mt-1 d-inline-block ${getBadgeClass(u.role)} text-white">
                        ${u.role}
                    </div>
                </div>
                <button class="btn btn-sm btn-outline-danger btn-gerenciar" onclick="window.openEditUser('${u.id}')">
                    Gerenciar
                </button>
            </div>
        `;
        box.appendChild(div);
    });
}

function getBadgeClass(role) {
    if (role === 'admin') return 'bg-danger';
    if (role === 'colaborador') return 'bg-success';
    return 'bg-secondary';
}

// --- 4. EDIÇÃO ---
window.openEditUser = (id) => {
    userBeingEdited = usersList.find(u => u.id === id);
    document.getElementById('userId').value = userBeingEdited.id;
    document.getElementById('uNome').value = userBeingEdited.nome;
    document.getElementById('uRole').value = userBeingEdited.role;
    modalUser.show();
};

document.getElementById('btnSalvarUser').onclick = async () => {
    const newNome = document.getElementById('uNome').value;
    const newRole = document.getElementById('uRole').value;
    const ref = doc(db, "usuarios", userBeingEdited.id);

    let mudanças = [];
    if (userBeingEdited.nome !== newNome) mudanças.push(`Nome: ${userBeingEdited.nome} > ${newNome}`);
    if (userBeingEdited.role !== newRole) mudanças.push(`Nível: ${userBeingEdited.role} > ${newRole}`);

    if (mudanças.length === 0) {
        modalUser.hide();
        return;
    }

    try {
        await updateDoc(ref, { nome: newNome, role: newRole });
        await registrarLog("Alteração de Usuário", `Usuário ${userBeingEdited.email} alterado. Detalhes: ${mudanças.join(" | ")}`);
        modalUser.hide();
    } catch (e) {
        alert("Erro ao atualizar: " + e.message);
    }
};

document.getElementById('btnExcluirUser').onclick = async () => {
    if (confirm(`ATENÇÃO: Deseja realmente excluir o acesso de ${userBeingEdited.nome}?`)) {
        try {
            await deleteDoc(doc(db, "usuarios", userBeingEdited.id));
            await registrarLog("Exclusão de Usuário", `Removeu permanentemente o acesso de: ${userBeingEdited.nome} (${userBeingEdited.email})`);
            modalUser.hide();
        } catch (e) {
            alert("Erro ao excluir: " + e.message);
        }
    }
};

// Busca
document.getElementById('searchUser').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = usersList.filter(u => 
        u.nome.toLowerCase().includes(term) || 
        u.email.toLowerCase().includes(term)
    );
    renderUsers(filtered);
};
