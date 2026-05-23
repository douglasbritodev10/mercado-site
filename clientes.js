import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let clients = [];
const modal = new bootstrap.Modal('#modalAdd');

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
        div.innerHTML = `<div><h6 class="mb-0">${c.nome}</h6><small class="opacity-50">${c.cpf}</small></div>
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
    document.getElementById('cLim').value = c.limite;
    document.getElementById('btnExcluir').style.display = "block";
    document.getElementById('modalTitle').innerText = "Editar Cliente";
    modal.show();
};

document.getElementById('btnSalvar').onclick = async () => {
    const id = document.getElementById('editId').value;
    const obj = {
        nome: document.getElementById('cNome').value,
        cpf: document.getElementById('cCPF').value,
        email: document.getElementById('cEmail').value,
        telefone: document.getElementById('cTel').value,
        endereco: document.getElementById('cEnd').value,
        limite: parseFloat(document.getElementById('cLim').value)
    };
    
    if(id) {
        await updateDoc(doc(db, "clientes", id), obj);
    } else {
        await addDoc(collection(db, "clientes"), { ...obj, saldo: 0 });
    }
    modal.hide();
    resetForm();
};

document.getElementById('btnExcluir').onclick = async () => {
    if(confirm("Deseja realmente excluir?")) {
        await deleteDoc(doc(db, "clientes", document.getElementById('editId').value));
        modal.hide();
    }
};

function resetForm() {
    document.getElementById('editId').value = "";
    document.getElementById('cNome').value = "";
    document.getElementById('cCPF').value = "";
    document.getElementById('cLim').value = "";
    document.getElementById('btnExcluir').style.display = "none";
    document.getElementById('modalTitle').innerText = "Novo Cliente";
}

document.getElementById('searchClient').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    render(clients.filter(c => c.nome.toLowerCase().includes(term) || c.cpf.includes(term)));
};

load();
