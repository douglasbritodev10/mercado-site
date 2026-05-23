import { db, auth } from './firebase-config.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('userEmail').innerText = user.email;
        
        // Fica "escutando" em tempo real qualquer mudança no documento do usuário
        const unsub = onSnapshot(doc(db, "usuarios", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                const role = userData.role;

                document.getElementById('msgOla').innerText = `Olá, ${userData.nome}!`;

                // Se o admin mudar o nível para algo diferente de 'cliente', redireciona
                if (role === "admin" || role === "colaborador") {
                    window.location.href = "pagina.html";
                }
            } else {
                // Se o admin deletar o usuário, ele volta pro login
                window.location.href = "index.html";
            }
        });

    } else {
        // Se não tiver logado, volta pro início
        window.location.href = "index.html";
    }
});
