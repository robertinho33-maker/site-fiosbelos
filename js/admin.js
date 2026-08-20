// Importa o banco de dados 'db' do seu arquivo local de configuração
import { db } from "./firebase-config.js";

// Importa as funções do Firestore diretamente do SDK do Firebase
import { 
    collection, 
    addDoc, 
    doc, 
    setDoc, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
let products = [];

// 1. CARREGAR PRODUTOS DO CSV
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

// 2. RENDERIZAR E EDITAR TABELA DE PRODUTOS
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
    if (products[index]) {
        products[index][field] = value;
    }
}

function deleteProduct(index) {
    if (confirm("Deseja remover este produto da lista?")) {
        products.splice(index, 1);
        renderProductsTable();
    }
}

// 3. ADICIONAR NOVO PRODUTO
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
    alert("Produto adicionado com sucesso! Lembre-se de baixar o novo CSV para atualizar sua loja.");
}

// 4. EXPORTAR ARQUIVO CSV NOVO
function exportCSV() {
    if (products.length === 0) {
        alert("Sem produtos para exportar.");
        return;
    }

    const headers = ["SKU", "Produto", "Peso", "Preço", "Categoria", "Estoque", "Descrição", "Imagem"];
    let csvContent = headers.join(",") + "\n";

    products.forEach(p => {
        const row = headers.map(header => {
            let val = p[header] || "";
            val = val.toString().replace(/"/g, '""');
            return `"${val}"`;
        });
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ecocsv - products1.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 5. CADASTRAR NOVO CUPOM NO FIREBASE
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

// 6. CARREGAR CUPONS DO FIREBASE
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

function escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

// EXPOSIÇÃO GLOBAL
window.saveProduct = saveProduct;
window.updateProductField = updateProductField;
window.deleteProduct = deleteProduct;
window.exportCSV = exportCSV;
window.saveCoupon = saveCoupon;

document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    loadCoupons();
});
