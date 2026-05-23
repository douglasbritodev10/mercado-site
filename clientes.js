import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let clients = [];
const modal = new bootstrap.Modal('#modalAdd');

// --- 1. PROTEÇÃO DE ACESSO ADM ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
            load(); // Só carrega se for admin
        } else {
            alert("Acesso restrito apenas para administradores.");
            window.location.href = "pagina.html";
        }
    } else {
        window.location.href = "index.html";
    }
});

// --- 2. MÁSCARAS E FORMATAÇÃO ---
// Máscara de CPF em tempo real
document.getElementById('cCPF').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.substring(0, 11);
    v = v.replace(/(\idx{3})(\idx{3})(\idx{3})(\idx{2})/, "$1.$2.$3-$4");
    e.target.value = v;
});

// Função para converter "1.500,50" em 1500.50 (para o Firebase)
function formatCurrencyToNumber(amount) {
    if(!amount) return 0;
    // Remove os pontos de milhar e troca a vírgula por ponto
    return parseFloat(amount.replace(/\./g, '').replace(',', '.'));
}

// Função para mostrar "1500.50" como "1.500,50" (para a tela)
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
    // Carrega o valor formatado para o input
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
        limite: formatCurrencyToNumber(valorInput) // Salva como número no banco
    };
    
    try {
        if(id) {
            await updateDoc(doc(db, "clientes", id), obj);
        } else {
            await addDoc(collection(db, "clientes"), { ...obj, saldo: 0 });
        }
        modal.hide();
        resetForm();
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    }
};

document.getElementById('btnExcluir').onclick = async () => {
    if(confirm("Deseja realmente excluir?")) {
        await deleteDoc(doc(db, "clientes", document.getElementById('editId').value));
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
