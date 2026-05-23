import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function carregar(inicio = null, fim = null) {
    let q = query(collection(db, "historico"), orderBy("ts", "desc"));
    
    if(inicio && fim) {
        const dStart = new Date(inicio + "T00:00:00");
        const dEnd = new Date(fim + "T23:59:59");
        q = query(collection(db, "historico"), 
            where("ts", ">=", Timestamp.fromDate(dStart)), 
            where("ts", "<=", Timestamp.fromDate(dEnd)),
            orderBy("ts", "desc")
        );
    }

    const snap = await getDocs(q);
    render(snap.docs.map(d => d.data()));
}

function render(data) {
    const area = document.getElementById('logArea');
    area.innerHTML = data.length ? "" : "<p class='text-center opacity-50'>Nenhum registro encontrado.</p>";
    data.forEach(h => {
        const isCompra = h.tipo === 'compra';
        area.innerHTML += `
            <div class="glass-card mb-2 py-2 px-3 border-start border-4 ${isCompra ? 'border-danger' : 'border-success'}">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong class="d-block">${h.clienteNome}</strong>
                        <small class="opacity-50">${h.data}</small>
                    </div>
                    <div class="text-end">
                        <span class="fw-bold d-block ${isCompra ? 'text-danger' : 'text-success'}">
                            ${isCompra ? '-' : '+'} R$ ${h.valor.toFixed(2)}
                        </span>
                        <span class="badge ${isCompra ? 'bg-danger' : 'bg-success'} small">${h.tipo}</span>
                    </div>
                </div>
            </div>`;
    });
}

document.getElementById('btnFiltrar').onclick = () => {
    const s = document.getElementById('dateStart').value;
    const e = document.getElementById('dateEnd').value;
    carregar(s, e);
};

carregar();
