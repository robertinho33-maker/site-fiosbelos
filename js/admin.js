import { db } from "./firebase-config.js";
import { 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    updateDoc, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Armazenamento local dos dados para filtragem rápida
let rawOrders = [];
let rawCustomers = [];
let rawCoupons = [];
let rawCommissions = [];
let rawProducts = [];

// ==========================================
// 1. PEDIDOS COM FILTRO & ORDENAÇÃO
// ==========================================
async function loadOrders() {
    const tbody = document.getElementById('admin-orders-list');
    if (!tbody) return;

    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        rawOrders = [];
        querySnapshot.forEach(docSnap => {
            rawOrders.push({ id: docSnap.id, ...docSnap.data() });
        });

        filterOrders();
    } catch (err) {
        console.error("Erro ao carregar pedidos:", err);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erro ao carregar pedidos.</td></tr>`;
    }
}

function filterOrders() {
    const tbody = document.getElementById('admin-orders-list');
    const search = document.getElementById('filter-order-search')?.value.toLowerCase() || "";
    const status = document.getElementById('filter-order-status')?.value || "";
    const sort = document.getElementById('filter-order-sort')?.value || "newest";

    let filtered = rawOrders.filter(o => {
        const matchesSearch = (o.customerName || "").toLowerCase().includes(search) || o.id.toLowerCase().includes(search);
        const matchesStatus = status === "" || o.status === status;
        return matchesSearch && matchesStatus;
    });

    // Ordenação
    filtered.sort((a, b) => {
        if (sort === "highest") return (b.totalAmount || 0) - (a.totalAmount || 0);
        if (sort === "lowest") return (a.totalAmount || 0) - (b.totalAmount || 0);
        
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        
        return sort === "oldest" ? dateA - dateB : dateB - dateA;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Nenhum pedido encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(order => {
        const date = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/I';
        return `
            <tr>
                <td><small class="fw-bold">#${order.id.substring(0, 8)}</small></td>
                <td>${date}</td>
                <td>${escapeHTML(order.customerName || 'Cliente')}</td>
                <td><strong>R$ ${(order.totalAmount || 0).toFixed(2)}</strong></td>
                <td>${order.couponCode ? `<span class="badge bg-light text-dark border">${order.couponCode}</span>` : '-'}</td>
                <td>
                    <select class="form-select form-select-sm" onchange="updateOrderStatus('${order.id}', this.value)">
                        <option value="Pendente" ${order.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="Pago" ${order.status === 'Pago' ? 'selected' : ''}>Pago</option>
                        <option value="Enviado" ${order.status === 'Enviado' ? 'selected' : ''}>Enviado</option>
                        <option value="Cancelado" ${order.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await updateDoc(doc(db, "orders", orderId), { status: newStatus });
        const item = rawOrders.find(o => o.id === orderId);
        if (item) item.status = newStatus;
        alert(`Status atualizado para ${newStatus}!`);
    } catch (err) {
        console.error("Erro ao atualizar status:", err);
    }
}

// ==========================================
// 2. CLIENTES COM BUSCA
// ==========================================
async function loadCustomers() {
    try {
        const querySnapshot = await getDocs(collection(db, "customers"));
        rawCustomers = [];
        querySnapshot.forEach(docSnap => rawCustomers.push(docSnap.data()));
        filterCustomers();
    } catch (err) {
        console.error("Erro ao carregar clientes:", err);
    }
}

function filterCustomers() {
    const tbody = document.getElementById('admin-customers-list');
    const search = document.getElementById('filter-customer-search')?.value.toLowerCase() || "";

    const filtered = rawCustomers.filter(c => {
        return (c.name || "").toLowerCase().includes(search) ||
               (c.email || "").toLowerCase().includes(search) ||
               (c.city || "").toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Nenhum cliente encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(c => {
        const date = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('pt-BR') : '-';
        return `
            <tr>
                <td><strong>${escapeHTML(c.name || 'Sem nome')}</strong></td>
                <td>${escapeHTML(c.email || '-')}</td>
                <td>${escapeHTML(c.phone || '-')}</td>
                <td>${escapeHTML(c.city ? `${c.city}/${c.state}` : '-')}</td>
                <td>${date}</td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// 3. CUPONS COM FILTRO
// ==========================================
async function saveCoupon(e) {
    e.preventDefault();
    const codeInput = document.getElementById('coup-code').value.trim();
    const normalizedCode = codeInput.toLowerCase();

    const couponData = {
        code: codeInput.toUpperCase(),
        type: document.getElementById('coup-type').value,
        value: parseFloat(document.getElementById('coup-value').value) || 0,
        commissionPercent: parseFloat(document.getElementById('coup-commission').value) || 0,
        affiliateName: document.getElementById('coup-affiliate').value.trim() || 'Geral',
        active: true
    };

    try {
        await setDoc(doc(db, "coupons", normalizedCode), couponData);
        alert(`Cupom ${couponData.code} cadastrado!`);
        document.getElementById('form-coupon').reset();
        loadCoupons();
    } catch (err) {
        console.error("Erro ao salvar cupom:", err);
    }
}

async function loadCoupons() {
    try {
        const querySnapshot = await getDocs(collection(db, "coupons"));
        rawCoupons = [];
        querySnapshot.forEach(docSnap => rawCoupons.push(docSnap.data()));
        filterCoupons();
    } catch (err) {
        console.error("Erro ao carregar cupons:", err);
    }
}

function filterCoupons() {
    const tbody = document.getElementById('admin-coupons-list');
    const search = document.getElementById('filter-coupon-search')?.value.toLowerCase() || "";
    const status = document.getElementById('filter-coupon-status')?.value || "";

    const filtered = rawCoupons.filter(c => {
        const matchesSearch = (c.code || "").toLowerCase().includes(search) || (c.affiliateName || "").toLowerCase().includes(search);
        const matchesStatus = status === "" || (status === "active" ? c.active : !c.active);
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Nenhum cupom encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(data => `
        <tr>
            <td><strong>${escapeHTML(data.code)}</strong></td>
            <td>${data.type === 'percent' ? 'Porcentagem' : 'Fixo'}</td>
            <td>${data.type === 'percent' ? data.value + '%' : 'R$ ' + data.value.toFixed(2)}</td>
            <td>${escapeHTML(data.affiliateName)}</td>
            <td>${data.commissionPercent ? data.commissionPercent + '%' : '-'}</td>
            <td>
                <span class="badge ${data.active ? 'bg-success' : 'bg-secondary'}">
                    ${data.active ? 'Ativo' : 'Inativo'}
                </span>
            </td>
        </tr>
    `).join('');
}

// ==========================================
// 4. COMISSÕES COM BUSCA
// ==========================================
async function loadCommissions() {
    try {
        const querySnapshot = await getDocs(collection(db, "commissions"));
        rawCommissions = [];
        querySnapshot.forEach(docSnap => rawCommissions.push(docSnap.data()));
        filterCommissions();
    } catch (err) {
        console.error("Erro ao carregar comissões:", err);
    }
}

function filterCommissions() {
    const tbody = document.getElementById('admin-commissions-list');
    const search = document.getElementById('filter-commission-search')?.value.toLowerCase() || "";

    const filtered = rawCommissions.filter(com => {
        return (com.affiliateName || "").toLowerCase().includes(search) || (com.code || "").toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Nenhuma comissão encontrada.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(com => {
        const date = com.createdAt?.toDate ? com.createdAt.toDate().toLocaleDateString('pt-BR') : '-';
        return `
            <tr>
                <td><strong>${escapeHTML(com.affiliateName || 'Geral')}</strong></td>
                <td><span class="badge bg-secondary">${escapeHTML(com.code || '-')}</span></td>
                <td>R$ ${(com.orderTotal || 0).toFixed(2)}</td>
                <td>${com.commissionPercent || 0}%</td>
                <td class="text-success fw-bold">R$ ${(com.commissionValue || 0).toFixed(2)}</td>
                <td>${date}</td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// 5. PRODUTOS CSV
// ==========================================
async function loadProducts() {
    try {
        const response = await fetch('ecocsv - products1.csv');
        if (!response.ok) throw new Error("Erro ao carregar o CSV");

        const csvText = await response.text();
        rawProducts = parseCSV(csvText);
        filterProducts();
    } catch (err) {
        console.error("Erro ao carregar produtos:", err);
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map((line, idx) => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
        return {
            id: idx,
            SKU: values[headers.indexOf("SKU")] || `SKU-${idx+1}`,
            Produto: values[headers.indexOf("Produto")] || "Sem nome",
            Peso: values[headers.indexOf("Peso")] || "",
            Preço: values[headers.indexOf("Preço")] || values[headers.indexOf("Preco")] || "0",
            Estoque: values[headers.indexOf("Estoque")] || "10"
        };
    });
}

function filterProducts() {
    const tbody = document.getElementById('admin-products-list');
    const search = document.getElementById('filter-product-search')?.value.toLowerCase() || "";

    const filtered = rawProducts.filter(p => {
        return (p.Produto || "").toLowerCase().includes(search) || (p.SKU || "").toLowerCase().includes(search);
    });

    tbody.innerHTML = filtered.map((p, index) => `
        <tr>
            <td><strong>${escapeHTML(p.SKU)}</strong></td>
            <td>${escapeHTML(p.Produto)}</td>
            <td>
                <input type="text" class="form-control form-control-sm" style="width: 100px;" 
                       value="${escapeHTML(p.Preço)}" onchange="updateProductField(${index}, 'Preço', this.value)">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm" style="width: 80px;" 
                       value="${parseInt(p.Estoque) || 0}" onchange="updateProductField(${index}, 'Estoque', this.value)">
            </td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${index})">
                    <i class="fa fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateProductField(index, field, value) {
    if (rawProducts[index]) rawProducts[index][field] = value;
}

function deleteProduct(index) {
    if (confirm("Deseja remover este produto?")) {
        rawProducts.splice(index, 1);
        filterProducts();
    }
}

function exportCSV() {
    if (rawProducts.length === 0) return alert("Sem produtos.");
    const headers = ["SKU", "Produto", "Peso", "Preço", "Categoria", "Estoque", "Descrição", "Imagem"];
    let csvContent = headers.join(",") + "\n";
    rawProducts.forEach(p => {
        const row = headers.map(h => `"${(p[h] || "").toString().replace(/"/g, '""')}"`);
        csvContent += row.join(",") + "\n";
    });
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ecocsv - products1.csv";
    link.click();
}

function escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

// Exposições Globais
window.saveCoupon = saveCoupon;
window.loadOrders = loadOrders;
window.updateOrderStatus = updateOrderStatus;
window.filterOrders = filterOrders;
window.filterCustomers = filterCustomers;
window.filterCoupons = filterCoupons;
window.filterCommissions = filterCommissions;
window.filterProducts = filterProducts;
window.updateProductField = updateProductField;
window.deleteProduct = deleteProduct;
window.exportCSV = exportCSV;

document.addEventListener("DOMContentLoaded", () => {
    loadOrders();
    loadCustomers();
    loadCoupons();
    loadCommissions();
    loadProducts();
});
