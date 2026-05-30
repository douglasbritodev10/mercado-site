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
                    
                    // --- AJUSTE AQUI: DISPARAR NOTIFICAÇÃO ---
                    // Se a permissão for padrão, pergunta primeiro. Se já tiver, executa direto.
                    if (Notification.permission === "default") {
                        Notification.requestPermission().then(perm => {
                            if (perm === "granted") verificarVencimentosHoje();
                        });
                    } else if (Notification.permission === "granted") {
                        verificarVencimentosHoje();
                    } else {
                        // Se estiver negada, a função rodará e mostrará o alert() convencional
                        verificarVencimentosHoje();
                    }
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

async function verificarVencimentosHoje() {
    // AJUSTE DE DATA: Garante que o "hoje" siga o fuso de Brasília (America/Sao_Paulo)
    // Isso evita que o sistema mude de dia antes da meia-noite real no Brasil.
    const hoje = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date()).split('/').reverse().join('-');
    
    const jaAvisadoHoje = localStorage.getItem('aviso_vencimento_' + hoje);
    if (jaAvisadoHoje) {
        console.log("Notificação já enviada hoje via localStorage.");
        return;
    }

    try {
        const q = query(
            collection(db, "historico"), 
            where("vencimento", "==", hoje),
            where("tipo", "==", "compra")
        );

        const snap = await getDocs(q);
        
        if (!snap.empty) {
            // --- LÓGICA DE MAPEAMENTO (MANTIDA) ---
            const resumoClientes = {}; 

            snap.forEach(docSnap => {
                const data = docSnap.data();
                const nome = data.clienteNome || "Cliente s/ nome";
                const valor = data.valor || 0;

                if (resumoClientes[nome]) {
                    resumoClientes[nome] += valor;
                } else {
                    resumoClientes[nome] = valor;
                }
            });

            // Monta a string do corpo da notificação
            let listaNomes = Object.entries(resumoClientes)
                .map(([nome, valor]) => `${nome} (R$ ${formatNumberToCurrency(valor)})`)
                .join(', ');

            const totalVencidos = snap.size;
            const titulo = "Casa & Canil: Vencimentos de Hoje";
            const corpoTexto = `Total: ${totalVencidos} anotação(ões). Clientes: ${listaNomes}`;

            const opcoes = {
                body: corpoTexto,
                icon: 'icon-192.png',
                badge: 'icon-192.png',
                vibrate: [200, 100, 200],
                tag: 'vencimento-hoje',
                renotify: true 
            };

            // Envio da Notificação (MANTIDO)
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(titulo, opcoes);
                });
            } else if (Notification.permission === "granted") {
                new Notification(titulo, opcoes);
            } else {
                alert(`📢 VENCIMENTOS HOJE:\n${listaNomes}`);
            }

            localStorage.setItem('aviso_vencimento_' + hoje, 'true');
        }
    } catch (error) {
        console.error("Erro ao checar vencimentos:", error);
    }
}

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
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center" onclick="alternarDetalhes('${c.id}')">
                    <div>
                        <h6 class="mb-0 fw-bold">${c.nome}</h6>
                        <small class="opacity-50">${c.cpf}</small>
                        <div class="mt-1"><span class="badge bg-light text-dark border">Clique para ver histórico</span></div>
                    </div>
                    <div class="text-end">
                        <div class="mb-1">
                             <button class="btn-pdf" onclick="event.stopPropagation(); gerarPDF('${c.id}')">PDF 📄</button>
                        </div>
                        <h5 class="mb-0 ${isDanger ? 'text-danger' : 'text-success'} fw-bold">R$ ${formatNumberToCurrency(c.saldo)}</h5>
                        <small class="small opacity-50">Limite: R$ ${formatNumberToCurrency(c.limite)}</small>
                    </div>
                </div>
                <div id="detalhes-${c.id}" class="mt-3 pt-3 border-top" style="display: none; font-size: 0.85rem;">
                    <div class="text-center opacity-50">Carregando histórico...</div>
                </div>
                <button class="btn btn-sm btn-outline-danger w-100 mt-3 fw-bold" onclick="abrirOperacao('${c.id}', '${c.nome}')">
                    + NOVA OPERAÇÃO
                </button>
            </div>`;
        box.appendChild(div);
    });
}

window.alternarDetalhes = async (id) => {
    const el = document.getElementById(`detalhes-${id}`);
    if (el.style.display === "block") {
        el.style.display = "none";
        return;
    }
    el.style.display = "block";
    
    // Busca os últimos registros do histórico para o cliente
    const q = query(collection(db, "historico"), where("clienteId", "==", id), orderBy("ts", "desc"));
    const snap = await getDocs(q);
    
    if (snap.empty) {
        el.innerHTML = `<div class="text-center py-2">Nenhum registro encontrado.</div>`;
        return;
    }

    let html = `<h6 class="fw-bold small text-uppercase mb-2">Últimos Lançamentos:</h6>`;
    
    // --- AJUSTE PARA FUSO HORÁRIO DE BRASÍLIA ---
    // Pega a data atual formatada para o Brasil e transforma em YYYY-MM-DD para comparar
    const dataBrasilStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date()).split('/').reverse().join('-');
    
    const hoje = new Date(dataBrasilStr + "T00:00:00");

    snap.forEach(d => {
        const h = d.data();
        let avisoVencimento = "";
        let classeCorVencimento = "text-muted"; // Cor padrão

        // REGRA DE CORES PARA VENCIMENTO
        if (h.tipo === 'compra' && h.vencimento) {
            // h.vencimento vem no formato YYYY-MM-DD
            const dataVenc = new Date(h.vencimento + "T00:00:00");

            if (dataVenc < hoje) {
                // VENCIDO: Vermelho
                classeCorVencimento = "text-danger fw-bold";
                avisoVencimento = `⚠️ VENCIDO EM: ${h.vencimento.split('-').reverse().join('/')}`;
            } else if (dataVenc.getTime() === hoje.getTime()) {
                // VENCE HOJE: Laranja/Amarelo (Opcional, mas ajuda a destacar)
                classeCorVencimento = "text-warning fw-bold";
                avisoVencimento = `🔔 VENCE HOJE: ${h.vencimento.split('-').reverse().join('/')}`;
            } else {
                // EM DIA: Verde
                classeCorVencimento = "text-success fw-bold";
                avisoVencimento = `📅 VENCE EM: ${h.vencimento.split('-').reverse().join('/')}`;
            }
        }

        html += `
            <div class="mb-2 p-2 rounded bg-light border-start border-3 ${h.tipo === 'compra' ? 'border-danger' : 'border-success'}">
                <div class="d-flex justify-content-between">
                    <strong>${h.tipo === 'compra' ? '🔴 COMPRA' : '🟢 PAGAMENTO'}</strong>
                    <span class="fw-bold">R$ ${formatNumberToCurrency(h.valor)}</span>
                </div>
                
                ${h.tipo === 'compra' && h.vencimento ? `<div class="small ${classeCorVencimento} mb-1">${avisoVencimento}</div>` : ""}
                
                <div class="text-muted small" style="font-size: 0.75rem;">
                    Lançado: ${h.data} | Por: ${h.usuarioNome}
                </div>
                
                ${h.obs ? `<div class="mt-1 text-dark" style="font-size: 0.8rem;"><strong>Obs:</strong> ${h.obs}</div>` : ""}
            </div>`;
    });
    
    el.innerHTML = html;
};

window.abrirOperacao = (id, nome) => {
    selectedId = id;
    document.getElementById('qNome').innerText = nome;
    document.getElementById('qValor').value = "";
    document.getElementById('qObs').value = "";
    
    // AJUSTE: Define amanhã com base no fuso de Brasília
    const dataBrasil = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date()).split('/').reverse().join('-');
    
    const amanha = new Date(dataBrasil + "T00:00:00");
    amanha.setDate(amanha.getDate() + 1);
    const dataMin = amanha.toISOString().split('T')[0];
    
    const inputData = document.getElementById('qVencimento');
    inputData.value = dataMin;
    inputData.min = dataMin;
    
    modalOp.show();
};

// --- 4. REGISTRAR COMPRA OU PAGAMENTO COM LOG DETALHADO (VERSÃO INTELIGENTE) ---
async function registrarOp(tipo) {
    const rawVal = document.getElementById('qValor').value;
    const obs = document.getElementById('qObs').value.trim();
    const vencimento = document.getElementById('qVencimento').value;
    const val = formatCurrencyToNumber(rawVal);
    
    if(!val || !selectedId) return;

    const ref = doc(db, "clientes", selectedId);
    const snap = await getDoc(ref);
    const dadosCliente = snap.data();

    // --- TRAVA DE PAGAMENTO MAIOR QUE A DÍVIDA ---
    if (tipo === 'pagamento' && val > dadosCliente.saldo) {
        alert(`Operação negada! O valor do pagamento (R$ ${formatNumberToCurrency(val)}) é maior que a dívida atual (R$ ${formatNumberToCurrency(dadosCliente.saldo)}).`);
        return;
    }

    // --- TRAVA DE DATA (SEGURANÇA EXTRA NO JS) ---
    if (tipo === 'compra') {
        const dataHoje = new Date();
        dataHoje.setHours(0, 0, 0, 0);
        const dataEscolha = new Date(vencimento + "T00:00:00");

        if (dataEscolha <= dataHoje) {
            alert("A data de vencimento deve ser no mínimo para amanhã!");
            return;
        }
    }

    const novoSaldo = tipo === 'compra' ? dadosCliente.saldo + val : dadosCliente.saldo - val;
    const quitouAgora = (tipo === 'pagamento' && novoSaldo <= 0);

    try {
        await updateDoc(ref, { saldo: novoSaldo });
        
        await addDoc(collection(db, "historico"), {
            clienteId: selectedId,
            clienteNome: dadosCliente.nome,
            valor: val,
            tipo: tipo,
            obs: obs,
            vencimento: tipo === 'compra' ? vencimento : null, // Salva o vencimento se for compra
            usuarioNome: currentUserData.nome,
            usuarioId: auth.currentUser.uid,
            data: new Date().toLocaleString('pt-BR'),
            ts: serverTimestamp(),
            foiQuitacao: quitouAgora
        });

        modalOp.hide();
    } catch (e) {
        alert("Erro: " + e.message);
    }
}

// --- GERAÇÃO DE PDF PROFISSIONAL COM INTELIGÊNCIA DE MARCO ZERO (CORRIGIDO) ---
window.gerarPDF = async (id) => {
    const cliente = allClients.find(c => c.id === id);

    if (!cliente || cliente.saldo <= 0) {
        alert("Este cliente não possui pendências financeiras (Saldo Zerado).");
        return;
    }

    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();
    
    const q = query(
        collection(db, "historico"), 
        where("clienteId", "==", id), 
        orderBy("ts", "desc")
    );
    const querySnap = await getDocs(q);

    const linhas = [];
    let encontrouPontoCorte = false;

    querySnap.forEach(docSnap => {
        if (encontrouPontoCorte) return; 

        const h = docSnap.data();
        
        if (h.foiQuitacao === true) {
            encontrouPontoCorte = true;
            return; 
        }

        const dataVencFormatada = h.vencimento ? h.vencimento.split('-').reverse().join('/') : "-";

        // MELHORIA PROFISSIONAL: Limpa quebras de linha e espaços extras da observação
        const obsLimpa = h.obs ? h.obs.replace(/\n/g, ', ').replace(/\s\s+/g, ' ').trim() : "-";

        linhas.unshift([
            h.data.split(',')[0], 
            h.tipo === 'compra' ? "ANOTADO" : "PAGOU",
            dataVencFormatada,
            `R$ ${formatNumberToCurrency(h.valor)}`,
            obsLimpa, // Usando a versão limpa e organizada
            h.usuarioNome
        ]);
    });

    const corPrimaria = [211, 47, 47]; 
    const corTexto = [45, 45, 45];
    const corSuave = [100, 100, 100];
    const carrinhoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAB80lEQVR4nO2YMW7CQBBE30onpUegSInSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSInSREmREidFSpQSInUmSInSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSInSREmREidFSpQSInUmSInSREmREidFSpQSInUmSInSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSInSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSInSREmREidFSpQSInUmSInSREmREidFSpQSInUmSInSREmREidFSpQSInUmSInSREmREidFSpQSInUmSInSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSInSREmREidFSpQSInUmSInSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSInSREmREidFSpQSInUmSInSREmREidFSpQSInUmSInSREmREidFSpQSInUmSInSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSAnSREmREidFSpQSInUmSInSREmREidFSpQSInUmSInSREmREidF/AKG0X6WvGvSogAAAABJRU5ErkJggg==";

    let logoBase64 = "";
    try {
        logoBase64 = await getImageDataURL('icon-192.png');
    } catch (e) {
        logoBase64 = carrinhoBase64;
    }

    if (logoBase64) {
        docPdf.addImage(logoBase64, 'PNG', 15, 12, 22, 22);
    }
    
    docPdf.setFontSize(18);
    docPdf.setTextColor(corPrimaria[0], corPrimaria[1], corPrimaria[2]);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("CASA & CANIL", 45, 20);
    
    docPdf.setFontSize(9);
    docPdf.setTextColor(corSuave[0], corSuave[1], corSuave[2]);
    docPdf.setFont("helvetica", "normal");
    docPdf.text("Ração • Medicamentos • Jardinagem • Utilidades", 45, 25);
    docPdf.text("Contato: (27) 9.9899-2768", 45, 30);

    docPdf.setDrawColor(220, 220, 220);
    docPdf.line(15, 40, 195, 40);

    docPdf.setFontSize(12);
    docPdf.setTextColor(corTexto[0], corTexto[1], corTexto[2]);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("EXTRATO DE PENDÊNCIAS ATUAIS", 105, 50, { align: "center" });

    const yStartInfo = 60;
    docPdf.setFontSize(10);
    docPdf.text(`CLIENTE: ${cliente.nome.toUpperCase()}`, 15, yStartInfo);
    docPdf.text(`CPF: ${cliente.cpf}`, 15, yStartInfo + 6);
    docPdf.text(`ENDEREÇO: ${cliente.endereco || "Não informado"}`, 15, yStartInfo + 12);
    docPdf.text(`CONTATO: ${cliente.telefone || "Não informado"}`, 15, yStartInfo + 18);

    docPdf.autoTable({
        startY: 85,
        head: [["Data", "Tipo", "Vencimento", "Valor", "Obs / Detalhes", "Atendente"]],
        body: linhas,
        theme: 'striped',
        headStyles: { fillColor: corPrimaria, fontSize: 9, halign: 'center' },
        styles: { 
            fontSize: 8, 
            cellPadding: 3, // Aumentado para melhor leitura
            overflow: 'linebreak',
            valign: 'middle' 
        },
        columnStyles: {
            0: { cellWidth: 22, halign: 'center' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 25, halign: 'center' },
            3: { cellWidth: 25, fontStyle: 'bold', halign: 'right' },
            4: { cellWidth: 'auto' }, // Deixa o Obs crescer o máximo possível
            5: { cellWidth: 25, halign: 'center' }
        }
    });

    let finalY = docPdf.lastAutoTable.finalY + 10;
    if (finalY > 250) {
        docPdf.addPage();
        finalY = 20;
    }

    docPdf.setFillColor(245, 245, 245);
    docPdf.rect(15, finalY, 180, 25, 'F');
    docPdf.setDrawColor(corPrimaria[0], corPrimaria[1], corPrimaria[2]);
    docPdf.setLineWidth(1);
    docPdf.line(15, finalY, 15, finalY + 25);

    docPdf.setFontSize(10);
    docPdf.setTextColor(corTexto[0], corTexto[1], corTexto[2]);
    docPdf.setFont("helvetica", "normal");
    docPdf.text("Limite de Crédito Disponível:", 20, finalY + 10);
    docPdf.text(`R$ ${formatNumberToCurrency(cliente.limite)}`, 190, finalY + 10, { align: "right" });

    docPdf.setFontSize(14);
    docPdf.setTextColor(corPrimaria[0], corPrimaria[1], corPrimaria[2]);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("VALOR TOTAL PARA QUITAÇÃO:", 20, finalY + 20);
    docPdf.text(`R$ ${formatNumberToCurrency(cliente.saldo)}`, 190, finalY + 20, { align: "right" });

    const dataEmissao = new Date().toLocaleString('pt-BR');
    docPdf.setFontSize(8);
    docPdf.setTextColor(corSuave[0], corSuave[1], corSuave[2]);
    docPdf.setFont("helvetica", "italic");
    docPdf.text(`Este extrato exibe apenas lançamentos após a última quitação total.`, 105, 280, { align: "center" });
    docPdf.text(`Documento gerado em: ${dataEmissao}`, 105, 285, { align: "center" });

    docPdf.save(`Extrato_${cliente.nome.replace(/\s+/g, '_')}.pdf`);
};

// Função auxiliar que estava faltando no seu código
const getImageDataURL = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = url;
    });
};

document.getElementById('qCompra').onclick = () => registrarOp('compra');
document.getElementById('qPaga').onclick = () => registrarOp('pagamento');
document.getElementById('logout').onclick = () => signOut(auth);

document.getElementById('searchClient').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allClients.filter(c => c.nome.toLowerCase().includes(term) || c.cpf.includes(term));
    render(filtered);
};
