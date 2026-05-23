import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let clients = [];
let currentUserData = null; 
let clientBeingEdited = null; // Guarda os dados originais para comparar na edição
const modal = new bootstrap.Modal('#modalAdd');

// --- 1. PROTEÇÃO DE ACESSO E NOME NO TOPO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
            currentUserData = userDoc.data();
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

// --- 2. MÁSCARA DE CPF ---
document.getElementById('cCPF').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    e.target.value = v;
});

// Função de Histórico Centralizada
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
        div.className = 'glass-card mb-2 p-3 d-flex justify-content-between align-items-center cursor-pointer';
        div.innerHTML = `
            <div>
                <h6 class="mb-0">${c.nome}</h6>
                <small class="opacity-50">CPF: ${c.cpf}</small><br>
                <small class="text-danger fw-bold">Limite: R$ ${formatNumberToCurrency(c.limite)}</small>
            </div>
            <button class="btn btn-sm btn-outline-secondary">Editar</button>`;
        div.onclick = () => openEdit(c);
        box.appendChild(div);
    });
}

window.openEdit = (c) => {
    clientBeingEdited = { ...c }; // Salva cópia para comparar depois
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
    const novoLimite = formatCurrencyToNumber(valorInput);

    const obj = {
        nome: document.getElementById('cNome').value,
        cpf: document.getElementById('cCPF').value,
        email: document.getElementById('cEmail').value,
        telefone: document.getElementById('cTel').value,
        endereco: document.getElementById('cEnd').value,
        limite: novoLimite
    };
    
    try {
        if(id) {
            // Lógica de Comparação para o Log de Edição
            let mudanças = [];
            if (clientBeingEdited.nome !== obj.nome) mudanças.push(`Nome: ${clientBeingEdited.nome} > ${obj.nome}`);
            if (clientBeingEdited.limite !== obj.limite) mudanças.push(`Limite: ${clientBeingEdited.limite} > ${obj.limite}`);
            if (clientBeingEdited.cpf !== obj.cpf) mudanças.push(`CPF alterado`);
            
            const detalheMsg = mudanças.length > 0 ? mudanças.join(" | ") : "Nenhuma alteração nos campos principais";

            await updateDoc(doc(db, "clientes", id), obj);
            await registrarAcao("Edição Cliente", `Cliente: ${obj.nome}. Modificações: ${detalheMsg}`);
        } else {
            await addDoc(collection(db, "clientes"), { ...obj, saldo: 0 });
            await registrarAcao("Cadastro Cliente", `Cadastrou novo cliente: ${obj.nome} com limite R$ ${valorInput}`);
        }
        modal.hide();
        resetForm();
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    }
};

document.getElementById('btnExcluir').onclick = async () => {
    const nomeExcluido = document.getElementById('cNome').value;
    const cpfExcluido = document.getElementById('cCPF').value;
    if(confirm(`Tem certeza que deseja excluir ${nomeExcluido}?`)) {
        await deleteDoc(doc(db, "clientes", document.getElementById('editId').value));
        await registrarAcao("Exclusão Cliente", `Excluiu permanentemente: ${nomeExcluido} (CPF: ${cpfExcluido})`);
        modal.hide();
        resetForm();
    }
};

function resetForm() {
    clientBeingEdited = null;
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
