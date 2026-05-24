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

function render(data) {
    const area = document.getElementById('logArea');
    area.innerHTML = data.length ? "" : "<p class='text-center opacity-50 mt-4'>Nenhum registro encontrado para este período ou busca.</p>";
    
    data.forEach(h => {
        const isSaida = h.tipo === 'compra' || h.tipo === 'Saída' || h.acao?.includes('Exclusão');
        
        // Se houver valor, é uma operação financeira. Se não, é uma ação de sistema (Cadastro/Edição).
        const temValor = h.valor !== undefined;

        // INTELIGÊNCIA DE EXIBIÇÃO: Prioriza o que estiver preenchido
        const informacaoAdicional = h.detalhe || h.obs || '';
        const identificacaoSujeito = h.clienteNome ? `CLIENTE: ${h.clienteNome}` : '';

        area.innerHTML += `
        <div class="glass-card mb-2 border-start border-4 ${isSaida ? 'border-danger' : 'border-success'}">
            <div class="hist-item-container">
                <div class="hist-info">
                    <strong class="d-block text-uppercase text-danger">${h.usuarioNome || 'Sistema'}</strong>
                    
                    <small class="text-muted d-block">${h.data}</small>
                    
                    <div class="small fw-bold opacity-75 mt-1" style="line-height: 1.2;">
                        ${identificacaoSujeito}
                        ${(identificacaoSujeito && informacaoAdicional) ? '<br>' : ''}
                        ${informacaoAdicional}
                    </div>
                </div>

                <div class="hist-value-area text-end">
                    <span class="badge ${isSaida ? 'bg-danger' : 'bg-success'} mb-1" style="font-size:0.65rem">
                        ${h.acao || h.tipo}
                    </span>

                    ${temValor ? `
                        <div class="fw-bold ${isSaida ? 'text-danger' : 'text-success'}">
                            ${isSaida ? '-' : '+'} R$ ${h.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </div>
                    ` : ''}
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
        (reg.detalhe && reg.detalhe.toLowerCase().includes(termo)) ||
        (reg.obs && reg.obs.toLowerCase().includes(termo)) // Adicionado busca por obs também
    );
    render(filtrados);
};
