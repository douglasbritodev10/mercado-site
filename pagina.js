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
                    <small class="small opacity-50">Limite de Crédito: R$ ${formatNumberToCurrency(c.limite)}</small>
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

// --- 5. GERAÇÃO DE PDF PROFISSIONAL (EXTRATO DE CONTA) ---
window.gerarPDF = async (id) => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();
    const cliente = allClients.find(c => c.id === id);
    
    // Tenta carregar o ícone antes de começar o PDF
    let logoBase64 = "";
    try {
        logoBase64 = await getImageDataURL('icon-192.png');
    } catch (e) {
        console.error("Erro ao carregar o ícone:", e);
    }

    const corPrimaria = [211, 47, 47];
    const corTexto = [45, 45, 45];
    const corSuave = [100, 100, 100];

    // --- CABEÇALHO COM LOGO ---
    if (logoBase64) {
        // img, formato, x, y, largura, altura
        docPdf.addImage(logoBase64, 'PNG', 15, 12, 25, 25);
    } else {
        // Caso a imagem falhe, mantém o círculo estilizado como reserva
        docPdf.setDrawColor(corPrimaria[0], corPrimaria[1], corPrimaria[2]);
        docPdf.setLineWidth(0.5);
        docPdf.circle(30, 25, 15, 'S');
    }
    
    docPdf.setFontSize(18);
    docPdf.setTextColor(corPrimaria[0], corPrimaria[1], corPrimaria[2]);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("CASA & CANIL", 50, 22);
    
    docPdf.setFontSize(9);
    docPdf.setTextColor(corSuave[0], corSuave[1], corSuave[2]);
    docPdf.setFont("helvetica", "normal");
    docPdf.text("Ração • Medicamentos • Jardinagem • Utilidades", 50, 27);
    docPdf.text("Contato: (27) 9.9899-2768", 50, 32);

    // O RESTANTE DO CÓDIGO (Linha divisória,
    docPdf.setDrawColor(220, 220, 220);
    docPdf.line(15, 45, 195, 45);

    // 3. Título do Documento
    docPdf.setFontSize(14);
    docPdf.setTextColor(corTexto[0], corTexto[1], corTexto[2]);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("EXTRATO DE CONTA DO CLIENTE", 105, 55, { align: "center" });

    // 4. Bloco de Dados do Cliente (Organizado)
    let yPos = 70;
    
    // Função auxiliar para desenhar campos
    const drawField = (label, value, y) => {
        docPdf.setFontSize(10);
        docPdf.setTextColor(corSuave[0], corSuave[1], corSuave[2]);
        docPdf.setFont("helvetica", "bold");
        docPdf.text(label, 20, y);
        
        docPdf.setFontSize(11);
        docPdf.setTextColor(corTexto[0], corTexto[1], corTexto[2]);
        docPdf.setFont("helvetica", "normal");
        docPdf.text(value || "Não informado", 70, y);
        
        // Linha fininha embaixo de cada campo para organizar
        docPdf.setDrawColor(240, 240, 240);
        docPdf.line(20, y + 2, 190, y + 2);
    };

    drawField("NOME DO CLIENTE:", cliente.nome.toUpperCase(), yPos);
    drawField("CPF:", cliente.cpf, yPos + 10);
    drawField("CONTATO / TEL:", cliente.telefone || "Disponível no cadastro", yPos + 20);
    drawField("ENDEREÇO:", cliente.endereco || "Não informado", yPos + 30);

    // 5. Bloco Financeiro (Destaque)
    yPos += 55;
    
    // Fundo cinza claro para a área financeira
    docPdf.setFillColor(248, 249, 250);
    docPdf.rect(15, yPos - 10, 180, 45, 'F');
    docPdf.setDrawColor(corPrimaria[0], corPrimaria[1], corPrimaria[2]);
    docPdf.line(15, yPos - 10, 15, yPos + 35); // Barra lateral vermelha

    docPdf.setFontSize(11);
    docPdf.setTextColor(corTexto[0], corTexto[1], corTexto[2]);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("LIMITE DE CRÉDITO:", 25, yPos);
    docPdf.setFont("helvetica", "normal");
    docPdf.text(`R$ ${formatNumberToCurrency(cliente.limite)}`, 185, yPos, { align: "right" });

    yPos += 15;
    docPdf.setFontSize(14);
    docPdf.setTextColor(corPrimaria[0], corPrimaria[1], corPrimaria[2]);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("VALOR TOTAL ANOTADO:", 25, yPos + 5);
    docPdf.text(`R$ ${formatNumberToCurrency(cliente.saldo)}`, 185, yPos + 5, { align: "right" });

    // 6. Rodapé e Data de Emissão
    const dataEmissao = new Date().toLocaleString('pt-BR');
    docPdf.setFontSize(8);
    docPdf.setTextColor(corSuave[0], corSuave[1], corSuave[2]);
    docPdf.setFont("helvetica", "italic");
    docPdf.text(`Documento gerado em: ${dataEmissao}`, 105, 280, { align: "center" });
    docPdf.text("Este documento serve como conferência de saldo devedor.", 105, 285, { align: "center" });

    // Salvar o arquivo
    docPdf.save(`Extrato_${cliente.nome.replace(/\s+/g, '_')}.pdf`);
};

document.getElementById('qCompra').onclick = () => registrarOp('compra');
document.getElementById('qPaga').onclick = () => registrarOp('pagamento');
document.getElementById('logout').onclick = () => signOut(auth);

document.getElementById('searchClient').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allClients.filter(c => c.nome.toLowerCase().includes(term) || c.cpf.includes(term));
    render(filtered);
};
