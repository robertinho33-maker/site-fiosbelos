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

let products = [];

// ==========================================
// 1. GESTÃO DE PEDIDOS (ORDERS)
// ==========================================
async function loadOrders() {
    const tbody = document.getElementById('admin-orders-list');
    if (!tbody) return;

    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Nenhum pedido encontrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        querySnapshot.forEach(docSnap => {
            const order = docSnap.data();
            const id = docSnap.id;
            const date = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/I';
            
            tbody.innerHTML += `
                <tr>
                    <td><small class="fw-bold">#${id.substring(0, 8)}</small></td>
                    <td>${date}</td>
                    <td>${escapeHTML(order.customerName || 'Cliente')}</td>
                    <td><strong>R$ ${(order.totalAmount || 0).toFixed(2)}</strong></td>
                    <td>${order.couponCode ? `<span class="badge bg-light text-dark">${order.couponCode}</span>` : '-'}</td>
                    <td>
                        <select class="form-select form-select-sm" onchange="updateOrderStatus('${id}', this.value)">
                            <option value="Pendente" ${order.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                            <option value="Pago" ${order.status === 'Pago' ? 'selected' : ''}>Pago</option>
                            <option value="Enviado" ${order.status === 'Enviado' ? 'selected' : ''}>Enviado</option>
                            <option value="Cancelado" ${order.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="alert('Itens: ${order.items?.map(i => i.name).join(', ')}')">
                            <i class="fa fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Erro ao carregar pedidos:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Erro ao carregar pedidos. Verifique o console.</td></tr>`;
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, { status: newStatus });
        alert(`Status do pedido #${orderId.substring(0,8)} atualizado para ${newStatus}!`);
    } catch (err) {
        console.error("Erro ao atualizar status:", err);
        alert("Erro ao atualizar o status no banco de dados.");
    }
}

// ==========================================
// 2. GESTÃO DE CLIENTES (CUSTOMERS)
// ==========================================
async function loadCustomers() {
    const tbody = document.getElementById('admin-customers-list');
    if (!tbody) return;

    try {
        const querySnapshot = await getDocs(collection(db, "customers"));
        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Nenhum cliente cadastrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        querySnapshot.forEach(docSnap => {
            const c = docSnap.data();
            const date = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('pt-BR') : '-';

            tbody.innerHTML += `
                <tr>
                    <td><strong>${escapeHTML(c.name || 'Sem nome')}</strong></td>
                    <td>${escapeHTML(c.email || '-')}</td>
                    <td>${escapeHTML(c.phone || '-')}</td>
                    <td>${escapeHTML(c.city ? `${c.city}/${c.state}` : '-')}</td>
                    <td>${date}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Erro ao carregar clientes:", err);
    }
}

// ==========================================
// 3. COMISSÕES DE AFILIADOS (COMMISSIONS)
// ==========================================
async function loadCommissions() {
    const tbody = document.getElementById('admin-commissions-list');
    if (!tbody) return;

    try {
        const querySnapshot = await getDocs(collection(db, "commissions"));
        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhuma comissão registrada.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        querySnapshot.forEach(docSnap => {
            const com = docSnap.data();
            const date = com.createdAt?.toDate ? com.createdAt.toDate().toLocaleDateString('pt-BR') : '-';

            tbody.innerHTML += `
                <tr>
                    <td><strong>${escapeHTML(com.affiliateName || 'Geral')}</strong></td>
                    <td><span class="badge bg-secondary">${escapeHTML(com.code || '-')}</span></td>
                    <td>R$ ${(com.orderTotal || 0).toFixed(2)}</td>
                    <td>${com.commissionPercent || 0}%</td>
                    <td class="text-success fw-bold">R$ ${(com.commissionValue || 0).toFixed(2)}</td>
                    <td>${date}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Erro ao carregar comissões:", err);
    }
}

// ==========================================
// 4. CUPONS DO FIREBASE
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
        alert(`Cupom ${couponData.code} cadastrado com sucesso!`);
        document.getElementById('form-coupon').reset();
        loadCoupons();
    } catch (err) {
        console.error("Erro ao salvar cupom:", err);
        alert("Erro ao salvar o cupom no Firebase.");
    }
}

async function loadCoupons() {
    const tbody = document.getElementById('admin-coupons-list');
    if (!tbody) return;

    try {
        const querySnapshot = await getDocs(collection(db, "coupons"));
        tbody.innerHTML = "";

        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            tbody.innerHTML += `
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
            `;
        });
    } catch (err) {
        console.error("Erro ao carregar cupons:", err);
    }
}

// ==========================================
// 5. PRODUTOS & CSV LOCAL
// ==========================================
async function loadProducts() {
    try {
        const response = await fetch('ecocsv - products1.csv');
        if (!response.ok) throw new Error("Erro ao carregar o CSV");

        const csvText = await response.text();
        products = parseCSV(csvText);
        renderProductsTable();
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
            Categoria: values[headers.indexOf("Categoria")] || "Geral",
            Estoque: values[headers.indexOf("Estoque")] || "10",
            Descrição: values[headers.indexOf("Descrição")] || values[headers.indexOf("Descricao")] || "",
            Imagem: values[headers.indexOf("Imagem")] || "images/products/default.jpg"
        };
    });
}

function renderProductsTable() {
    const tbody = document.getElementById('admin-products-list');
    if (!tbody) return;

    tbody.innerHTML = products.map((p, index) => `
        <tr>
            <td><strong>${escapeHTML(p.SKU)}</strong></td>
            <td>${escapeHTML(p.Produto)}</td>
            <td>
                <input type="text" class="form-control form-control-sm" style="width: 100px;" 
                       value="${escapeHTML(p.Preço)}" 
                       onchange="updateProductField(${index}, 'Preço', this.value)">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm" style="width: 80px;" 
                       value="${parseInt(p.Estoque) || 0}" 
                       onchange="updateProductField(${index}, 'Estoque', this.value)">
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
    if (products[index]) products[index][field] = value;
}

function deleteProduct(index) {
    if (confirm("Deseja remover este produto?")) {
        products.splice(index, 1);
        renderProductsTable();
    }
}

function saveProduct(e) {
    e.preventDefault();
    const newProd = {
        id: products.length,
        SKU: document.getElementById('prod-sku').value.trim(),
        Produto: document.getElementById('prod-name').value.trim(),
        Peso: document.getElementById('prod-weight').value.trim(),
        Preço: document.getElementById('prod-price').value.trim(),
        Categoria: document.getElementById('prod-category').value.trim(),
        Estoque: document.getElementById('prod-stock').value.trim(),
        Descrição: document.getElementById('prod-desc').value.trim(),
        Imagem: document.getElementById('prod-image').value.trim() || 'images/products/default.jpg'
    };
    products.push(newProd);
    renderProductsTable();
    document.getElementById('form-product').reset();
    alert("Produto adicionado com sucesso! Baixe o CSV atualizado.");
}

function exportCSV() {
    if (products.length === 0) return alert("Sem produtos.");
    const headers = ["SKU", "Produto", "Peso", "Preço", "Categoria", "Estoque", "Descrição", "Imagem"];
    let csvContent = headers.join(",") + "\n";
    products.forEach(p => {
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

// Exposições globais
window.saveProduct = saveProduct;
window.updateProductField = updateProductField;
window.deleteProduct = deleteProduct;
window.exportCSV = exportCSV;
window.saveCoupon = saveCoupon;
window.loadOrders = loadOrders;
window.updateOrderStatus = updateOrderStatus;

document.addEventListener("DOMContentLoaded", () => {
    loadOrders();
    loadCustomers();
    loadCoupons();
    loadCommissions();
    loadProducts();
});
