import { db, auth } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy, Timestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let todosRegistrosPeriodo = []; // Cache para a busca local

// --- 1. PROTEÇÃO DE ROTA ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        const dados = userDoc.data();
        
        // Só permite admin ou colaborador
        if (userDoc.exists() && (dados.role === "admin" || dados.role === "colaborador")) {
            console.log("Acesso autorizado");
        } else {
            alert("Acesso negado.");
            window.location.href = "pagina.html";
        }
    } else {
        window.location.href = "index.html";
    }
});

// --- 2. CARREGAR DADOS (Somente via Botão) ---
async function carregarRelatorio() {
    const inicio = document.getElementById('dateStart').value;
    const fim = document.getElementById('dateEnd').value;

    if (!inicio || !fim) {
        alert("Selecione as datas de início e fim para filtrar.");
        return;
    }

    const dStart = new Date(inicio + "T00:00:00");
    const dEnd = new Date(fim + "T23:59:59");

    const q = query(
        collection(db, "historico"), 
        where("ts", ">=", Timestamp.fromDate(dStart)), 
        where("ts", "<=", Timestamp.fromDate(dEnd)),
        orderBy("ts", "desc")
    );

    const snap = await getDocs(q);
    // Salvamos no cache para a busca por nome funcionar dentro desse período
    todosRegistrosPeriodo = snap.docs.map(d => d.data());
    render(todosRegistrosPeriodo);
}

// --- 3. RENDERIZAR NA TELA ---
function render(data) {
    const area = document.getElementById('logArea');
    area.innerHTML = data.length ? "" : "<p class='text-center opacity-50 mt-4'>Nenhum registro encontrado para este período ou busca.</p>";
    
    data.forEach(h => {
        // Verifica se é entrada ou saída (ajuste os termos conforme seu Firebase)
        const isSaida = h.tipo === 'compra' || h.tipo === 'Saída' || h.acao?.includes('Exclusão');
        
        area.innerHTML += `
            <div class="glass-card mb-2 py-2 px-3 border-start border-4 ${isSaida ? 'border-danger' : 'border-success'}">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong class="d-block">${h.clienteNome || h.usuarioNome || 'Ação do Sistema'}</strong>
                        <small class="opacity-50">${h.data}</small>
                        <div class="small fw-bold text-muted">${h.detalhe || ''}</div>
                    </div>
                    <div class="text-end">
                        <span class="fw-bold d-block ${isSaida ? 'text-danger' : 'text-success'}">
                            ${h.valor ? (isSaida ? '- R$ ' : '+ R$ ') + h.valor.toFixed(2) : h.acao}
                        </span>
                        <span class="badge ${isSaida ? 'bg-danger' : 'bg-success'} small" style="font-size:0.6rem">
                            ${h.tipo || 'LOG'}
                        </span>
                    </div>
                </div>
            </div>`;
    });
}

// --- 4. EVENTOS ---

// Botão Filtrar
document.getElementById('btnFiltrar').onclick = carregarRelatorio;

// Campo de Busca (Filtra apenas o que já foi carregado no período)
document.getElementById('searchHist').oninput = (e) => {
    const termo = e.target.value.toLowerCase();
    const filtrados = todosRegistrosPeriodo.filter(reg => 
        (reg.clienteNome && reg.clienteNome.toLowerCase().includes(termo)) || 
        (reg.usuarioNome && reg.usuarioNome.toLowerCase().includes(termo)) ||
        (reg.detalhe && reg.detalhe.toLowerCase().includes(termo))
    );
    render(filtrados);
};
