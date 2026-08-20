import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC2Qa0lMl4WhjhDzNhIzWFTJsIABuSf8nc",
    authDomain: "totti-c9e6f.firebaseapp.com",
    projectId: "totti-c9e6f",
    storageBucket: "totti-c9e6f.firebasestorage.app",
    messagingSenderId: "938110274522",
    appId: "1:938110274522:web:69a16be8aa09ce7b2a0ee3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const colAg = collection(db, "agendamentos");
const colClientes = collection(db, "clientes");

const PROFISSIONAIS = ["Ana", "Juliana", "Fernanda"];
const HORARIOS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00"];

let agenda = [];
let clientes = new Set();
let dataSelecionada = new Date().toISOString().split("T")[0];

document.addEventListener("DOMContentLoaded", () => {
    const fieldHora = document.getElementById("fieldHora");
    const fieldProf = document.getElementById("fieldProf");
    
    // Popula as opções do formulário
    if(fieldProf) fieldProf.innerHTML = PROFISSIONAIS.map(p => `<option value="${p}">${p}</option>`).join("");
    if(fieldHora) fieldHora.innerHTML = HORARIOS.map(h => `<option value="${h}">${h}</option>`).join("");

    // Listener para Novo Agendamento
    document.getElementById("btnNovoAgendamento")?.addEventListener("click", () => {
        document.getElementById("formAgendamento").reset();
        document.getElementById("fieldId").value = "";
        document.getElementById("fieldData").value = dataSelecionada;
        new bootstrap.Modal(document.getElementById("modalAgendar")).show();
    });

    // Cadastro rápido de cliente
    document.getElementById("btnAbrirModalCliente")?.addEventListener("click", () => {
        new bootstrap.Modal(document.getElementById("modalCliente")).show();
    });

    // Salvar no Firestore
    document.getElementById("formAgendamento").onsubmit = async (e) => {
        e.preventDefault();
        const nome = document.getElementById("fieldNome").value.trim();
        const status = document.getElementById("clienteStatus");

        if (!clientes.has(nome.toLowerCase())) {
            status.innerHTML = "❌ <a href='#' id='linkCadastrar'>Cliente não cadastrado. Clique para cadastrar.</a>";
            status.className = "text-danger";
            return;
        }

        const dados = {
            data: document.getElementById("fieldData").value,
            hora: document.getElementById("fieldHora").value,
            nome: nome,
            profissional: document.getElementById("fieldProf").value,
            servico: document.getElementById("fieldServico").value
        };

        const id = document.getElementById("fieldId").value;
        id ? await updateDoc(doc(db, "agendamentos", id), dados) : await addDoc(colAg, dados);
        bootstrap.Modal.getInstance(document.getElementById("modalAgendar")).hide();
    };

    // Firebase: Monitorar Agendamentos
    onSnapshot(colAg, (snap) => {
        agenda = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAgenda();
        document.getElementById("loading-overlay").style.display = "none";
    });

    // Firebase: Monitorar Clientes
    onSnapshot(colClientes, (snap) => {
        clientes = new Set(snap.docs.map(d => d.data().nome.toLowerCase().trim()));
    });
});

function renderAgenda() {
    const corpo = document.getElementById("corpoAgenda");
    if (!corpo) return;
    corpo.innerHTML = "";

    HORARIOS.forEach(h => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td class="fw-bold bg-light">${h}</td>` + PROFISSIONAIS.map(p => {
            const ag = agenda.find(a => a.data === dataSelecionada && a.hora === h && a.profissional === p);
            return `
                <td class="cell-agendamento">
                    ${ag ? `<div class="card-agendamento">
                                <strong>${ag.nome}</strong><br>
                                <small>${ag.servico}</small>
                            </div>` : ''}
                </td>`;
        }).join("");
        corpo.appendChild(tr);
    });
}
