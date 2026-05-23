import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let clients = [];
let currentUserData = null; // Para guardar o nome do admin logado
const modal = new bootstrap.Modal('#modalAdd');

// --- 1. PROTEÇÃO DE ACESSO E NOME NO TOPO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
            currentUserData = userDoc.data();
            // Exibe o nome do usuário ao lado do botão voltar
            document.getElementById('userNameDisplay').innerText = `Olá, ${currentUserData.nome || 'Admin'}`;
            load(); 
        } else {
            alert("Acesso restrito apenas para administradores.");
            window.location.href = "pagina.html";
        }
    } else {
        window.location.href = "index.html";
    }
});

// --- 2. MÁSCARA DE CPF MELHORADA ---
document.getElementById('cCPF').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número
    
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    e.target.value = v;
});

// Função para registrar histórico de ações
async function registrarAcao(tipo, detalhe) {
    await addDoc(collection(db, "historico"), {
        usuarioNome: currentUserData.nome,
        usuarioId: auth.currentUser.uid,
        acao: tipo,
        detalhe: detalhe,
        data: new Date().toLocaleString('pt-BR'),
        ts: serverTimestamp()
    });
}

// Funções de formatação de moeda
function formatCurrencyToNumber(amount) {
    if(!amount) return 0;
    return parseFloat(amount.toString().replace(/\./g, '').replace(',', '.'));
}

function formatNumberToCurrency(number) {
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function load() {
    onSnapshot(query(collection(db, "clientes"), orderBy("nome")), snap => {
        clients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        render(clients);
    });
}

function render(data) {
    const box = document.getElementById('listaFull');
    box.innerHTML = "";
    data.forEach(c => {
        const div = document.createElement('div');
        div.className = 'glass-card mb-2 p-3 d-flex justify-content-between align-items-center';
        div.innerHTML = `
            <div>
                <h6 class="mb-0">${c.nome}</h6>
                <small class="opacity-50">CPF: ${c.cpf}</small><br>
                <small class="text-danger">Limite: R$ ${formatNumberToCurrency(c.limite)}</small>
            </div>
            <button class="btn btn-sm btn-outline-secondary">Editar</button>`;
        div.onclick = () => openEdit(c);
        box.appendChild(div);
    });
}

window.openEdit = (c) => {
    document.getElementById('editId').value = c.id;
    document.getElementById('cNome').value = c.nome;
    document.getElementById('cCPF').value = c.cpf;
    document.getElementById('cEmail').value = c.email || "";
    document.getElementById('cTel').value = c.telefone || "";
    document.getElementById('cEnd').value = c.endereco || "";
    document.getElementById('cLim').value = formatNumberToCurrency(c.limite);
    
    document.getElementById('btnExcluir').style.display = "block";
    document.getElementById('modalTitle').innerText = "Editar Cliente";
    modal.show();
};

document.getElementById('btnSalvar').onclick = async () => {
    const id = document.getElementById('editId').value;
    const valorInput = document.getElementById('cLim').value;

    const obj = {
        nome: document.getElementById('cNome').value,
        cpf: document.getElementById('cCPF').value,
        email: document.getElementById('cEmail').value,
        telefone: document.getElementById('cTel').value,
        endereco: document.getElementById('cEnd').value,
        limite: formatCurrencyToNumber(valorInput)
    };
    
    try {
        if(id) {
            await updateDoc(doc(db, "clientes", id), obj);
            await registrarAcao("Edição", `Editou o cliente ${obj.nome}`);
        } else {
            await addDoc(collection(db, "clientes"), { ...obj, saldo: 0 });
            await registrarAcao("Cadastro", `Cadastrou o cliente ${obj.nome}`);
        }
        modal.hide();
        resetForm();
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    }
};

document.getElementById('btnExcluir').onclick = async () => {
    const nomeExcluido = document.getElementById('cNome').value;
    if(confirm("Deseja realmente excluir?")) {
        await deleteDoc(doc(db, "clientes", document.getElementById('editId').value));
        await registrarAcao("Exclusão", `Excluiu o cliente ${nomeExcluido}`);
        modal.hide();
        resetForm();
    }
};

function resetForm() {
    document.getElementById('editId').value = "";
    document.getElementById('cNome').value = "";
    document.getElementById('cCPF').value = "";
    document.getElementById('cEmail').value = "";
    document.getElementById('cTel').value = "";
    document.getElementById('cEnd').value = "";
    document.getElementById('cLim').value = "";
    document.getElementById('btnExcluir').style.display = "none";
    document.getElementById('modalTitle').innerText = "Novo Cliente";
}

document.getElementById('searchClient').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    render(clients.filter(c => 
        c.nome.toLowerCase().includes(term) || 
        c.cpf.includes(term)
    ));
};
