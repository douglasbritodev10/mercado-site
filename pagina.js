import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, getDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let selectedId = null;
let allClients = [];

onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('userName').innerText = user.displayName || "Usuário";
        loadDashboard();
    } else { window.location.href = "index.html"; }
});

function loadDashboard() {
    onSnapshot(query(collection(db, "clientes"), orderBy("nome")), snap => {
        allClients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        render(allClients);
    });
}

function render(data) {
    const box = document.getElementById('renderLista');
    box.innerHTML = "";
    data.forEach(c => {
        const isDanger = c.saldo > c.limite;
        const div = document.createElement('div');
        div.className = `card client-card ${isDanger ? 'danger' : 'ok'}`;
        div.innerHTML = `
            <div class="card-body d-flex justify-content-between align-items-center">
                <div><h6 class="mb-0">${c.nome}</h6><small class="opacity-50">${c.cpf}</small></div>
                <div class="text-end">
                    <h5 class="mb-0 ${isDanger ? 'text-danger' : 'text-success'}">R$ ${c.saldo.toFixed(2)}</h5>
                    <small class="small opacity-50">Lim: R$ ${c.limite}</small>
                </div>
            </div>`;
        div.onclick = () => {
            selectedId = c.id;
            document.getElementById('qNome').innerText = c.nome;
            new bootstrap.Modal('#modalQuickOp').show();
        };
        box.appendChild(div);
    });
}

document.getElementById('searchClient').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allClients.filter(c => c.nome.toLowerCase().includes(term) || c.cpf.includes(term));
    render(filtered);
};

async function registrarOp(tipo) {
    const val = parseFloat(document.getElementById('qValor').value);
    if(!val || !selectedId) return;
    const ref = doc(db, "clientes", selectedId);
    const snap = await getDoc(ref);
    const novoSaldo = tipo === 'compra' ? snap.data().saldo + val : snap.data().saldo - val;
    
    await updateDoc(ref, { saldo: novoSaldo });
    await addDoc(collection(db, "historico"), {
        clienteId: selectedId,
        clienteNome: snap.data().nome,
        valor: val,
        tipo: tipo,
        data: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR'),
        ts: serverTimestamp()
    });
    bootstrap.Modal.getInstance(document.getElementById('modalQuickOp')).hide();
    document.getElementById('qValor').value = "";
}

document.getElementById('qCompra').onclick = () => registrarOp('compra');
document.getElementById('qPaga').onclick = () => registrarOp('pagamento');
document.getElementById('logout').onclick = () => signOut(auth);

// PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('btnInstallPWA').style.display = 'block';
});
document.getElementById('btnInstallPWA').onclick = () => {
    deferredPrompt.prompt();
    document.getElementById('btnInstallPWA').style.display = 'none';
};
