import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, getDoc, updateDoc, addDoc, serverTimestamp, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let selectedId = null;
let allClients = [];
let currentUserData = null;
const modalOp = new bootstrap.Modal('#modalQuickOp');

// --- 1. CONTROLE DE ACESSO, NÍVEL E PWA ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const role = userDoc.data().role;
            if (role === "admin" || role === "colaborador") {
                currentUserData = userDoc.data();
                document.getElementById('userName').innerText = `Olá, ${currentUserData.nome}`;
                
                if (role === "admin") {
                    document.getElementById('btnAdminArea').style.display = "block";
                }
                loadDashboard();
            } else {
                window.location.href = "aguardar.html";
            }
        } else {
            window.location.href = "aguardar.html";
        }
    } else {
        window.location.href = "index.html";
    }
});

// --- LOGICA DE INSTALAÇÃO PWA ---
let deferredPrompt;
const btnInstalar = document.getElementById('btnInstalar');

window.addEventListener('beforeinstallprompt', (e) => {
    // Impede que o navegador mostre o aviso padrão imediatamente
    e.preventDefault();
    deferredPrompt = e;
    
    // Verifica se já está rodando como aplicativo (se sim, não mostra o botão)
    if (!window.matchMedia('(display-mode: standalone)').matches) {
        btnInstalar.style.display = 'block';
    }
});

btnInstalar.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('Usuário aceitou a instalação');
            btnInstalar.style.display = 'none'; // Some após aceitar
        }
        deferredPrompt = null;
    }
});

// Esconde o botão se a instalação for concluída com sucesso
window.addEventListener('appinstalled', (evt) => {
    console.log('App instalado com sucesso!');
    btnInstalar.style.display = 'none';
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(() => console.log("Service Worker Ativo e Corrigido"))
        .catch(err => console.log("Erro no SW:", err));
}

// --- 2. MÁSCARA DE MOEDA ---
document.getElementById('qValor').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, "");
    v = (v / 100).toFixed(2) + "";
    v = v.replace(".", ",");
    v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
    e.target.value = v;
});

function formatCurrencyToNumber(amount) {
    if(!amount) return 0;
    return parseFloat(amount.toString().replace(/\./g, '').replace(',', '.'));
}

function formatNumberToCurrency(number) {
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// --- 3. CARREGAMENTO E RENDERIZAÇÃO ---
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
        div.className = `card client-card shadow-sm ${isDanger ? 'danger' : 'ok'}`;
        div.innerHTML = `
            <div class="card-body d-flex justify-content-between align-items-center">
                <div onclick="abrirOperacao('${c.id}', '${c.nome}')">
                    <h6 class="mb-0 fw-bold">${c.nome}</h6>
                    <small class="opacity-50">${c.cpf}</small>
                </div>
                <div class="text-end">
                    <div class="mb-1">
                         <button class="btn-pdf" onclick="event.stopPropagation(); gerarPDF('${c.id}')">PDF 📄</button>
                    </div>
                    <h5 class="mb-0 ${isDanger ? 'text-danger' : 'text-success'} fw-bold">R$ ${formatNumberToCurrency(c.saldo)}</h5>
                    <small class="small opacity-50">Lim: R$ ${formatNumberToCurrency(c.limite)}</small>
                </div>
            </div>`;
        box.appendChild(div);
    });
}

window.abrirOperacao = (id, nome) => {
    selectedId = id;
    document.getElementById('qNome').innerText = nome;
    document.getElementById('qValor').value = "";
    modalOp.show();
};

// --- 4. REGISTRAR COMPRA OU PAGAMENTO COM LOG DETALHADO ---
async function registrarOp(tipo) {
    const rawVal = document.getElementById('qValor').value;
    const val = formatCurrencyToNumber(rawVal);
    
    if(!val || !selectedId) return;

    const ref = doc(db, "clientes", selectedId);
    const snap = await getDoc(ref);
    const dadosCliente = snap.data();
    
    const saldoAnterior = dadosCliente.saldo;
    const novoSaldo = tipo === 'compra' ? saldoAnterior + val : saldoAnterior - val;
    
    try {
        await updateDoc(ref, { saldo: novoSaldo });
        
        // Texto descritivo para o log de histórico
        const acaoTitulo = tipo === 'compra' ? "Anotação de Compra" : "Recebimento de Pagamento";
        const detalheMsg = `Cliente: ${dadosCliente.nome} | Saldo: R$ ${formatNumberToCurrency(saldoAnterior)} -> R$ ${formatNumberToCurrency(novoSaldo)}`;

        // Salva no HISTÓRICO (Padronizado com a tela de clientes)
        await addDoc(collection(db, "historico"), {
            clienteId: selectedId,
            clienteNome: dadosCliente.nome,
            valor: val,
            tipo: tipo, // 'compra' ou 'pagamento'
            acao: acaoTitulo,
            detalhe: detalheMsg,
            usuarioNome: currentUserData.nome,
            usuarioId: auth.currentUser.uid,
            data: new Date().toLocaleString('pt-BR'),
            ts: serverTimestamp()
        });

        modalOp.hide();
    } catch (e) {
        alert("Erro: " + e.message);
    }
}

// --- 5. GERAÇÃO DE PDF DETALHADO ---
window.gerarPDF = async (id) => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();
    const cliente = allClients.find(c => c.id === id);
    const q = query(collection(db, "historico"), where("clienteId", "==", id), orderBy("ts", "desc"));
    const querySnap = await getDocs(q);
    
    docPdf.setFontSize(22);
    docPdf.setTextColor(211, 47, 47);
    docPdf.text("CASA & CANIL", 105, 20, { align: "center" });
    
    docPdf.setFontSize(10);
    docPdf.setTextColor(100);
    docPdf.text("Relatório Detalhado de Conta", 105, 28, { align: "center" });

    docPdf.setDrawColor(200);
    docPdf.line(15, 35, 195, 35);
    docPdf.setFontSize(12);
    docPdf.setTextColor(0);
    docPdf.text(`Cliente: ${cliente.nome}`, 15, 45);
    docPdf.text(`CPF: ${cliente.cpf}`, 15, 52);
    docPdf.text(`Limite de Crédito: R$ ${formatNumberToCurrency(cliente.limite)}`, 15, 59);

    const colunas = ["Data", "Tipo", "Valor", "Operador"];
    const linhas = [];
    querySnap.forEach(d => {
        const h = d.data();
        linhas.push([
            h.data,
            h.tipo === 'compra' ? "COMPRA" : "PAGAMENTO",
            `R$ ${formatNumberToCurrency(h.valor)}`,
            h.usuarioNome
        ]);
    });

    docPdf.autoTable({
        startY: 65,
        head: [colunas],
        body: linhas,
        theme: 'striped',
        headStyles: { fillColor: [211, 47, 47] }
    });

    const finalY = docPdf.lastAutoTable.finalY + 10;
    docPdf.setFontSize(14);
    docPdf.text(`SALDO TOTAL DEVEDOR: R$ ${formatNumberToCurrency(cliente.saldo)}`, 195, finalY, { align: "right" });
    docPdf.save(`Extrato_${cliente.nome}.pdf`);
};

document.getElementById('qCompra').onclick = () => registrarOp('compra');
document.getElementById('qPaga').onclick = () => registrarOp('pagamento');
document.getElementById('logout').onclick = () => signOut(auth);

document.getElementById('searchClient').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allClients.filter(c => c.nome.toLowerCase().includes(term) || c.cpf.includes(term));
    render(filtered);
};
