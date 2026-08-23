import { db } from "./firebase-config.js";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ESTADO GLOBAL
let products = [];
let cart = JSON.parse(localStorage.getItem('studio_cart')) || [];
let appliedCoupon = null;

// 1. AUTO-PREENCHIMENTO DE DADOS DO CLIENTE
function loadSavedCustomerData() {
    const savedCustomer = JSON.parse(localStorage.getItem('studio_customer'));
    if (!savedCustomer) return;

    if (document.getElementById('cust-name')) document.getElementById('cust-name').value = savedCustomer.name || '';
    if (document.getElementById('cust-phone')) document.getElementById('cust-phone').value = savedCustomer.phone || '';
    if (document.getElementById('cust-cep')) document.getElementById('cust-cep').value = savedCustomer.cep || '';
    if (document.getElementById('cust-street')) document.getElementById('cust-street').value = savedCustomer.street || '';
    if (document.getElementById('cust-number')) document.getElementById('cust-number').value = savedCustomer.number || '';
    if (document.getElementById('cust-complement')) document.getElementById('cust-complement').value = savedCustomer.complement || '';
    if (document.getElementById('cust-neighborhood')) document.getElementById('cust-neighborhood').value = savedCustomer.neighborhood || '';
    if (document.getElementById('cust-city')) document.getElementById('cust-city').value = savedCustomer.city || '';
    if (document.getElementById('cust-payment')) document.getElementById('cust-payment').value = savedCustomer.paymentMethod || 'Pix';
}

// 2. CARREGAR E PARSEAR O CSV DE PRODUTOS
async function loadProductsFromCSV() {
    try {
        const response = await fetch('ecocsv - products1.csv');
        if (!response.ok) throw new Error("Não foi possível carregar o CSV.");

        const csvText = await response.text();
        const rawData = parseCSV(csvText);

        products = rawData.map((item, index) => {
            const rawPrice = (item["Preço"] || item["Preco"] || "0").toString();
            const cleanPrice = rawPrice.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();

            return {
                id: String(index + 1),
                name: item["Produto"] || "Produto sem nome",
                description: item["Descrição"] || "",
                price: parseFloat(cleanPrice) || 0,
                category: (item["Categoria"] || "Geral").trim(),
                image: item["Imagem"] || "images/products/default.jpg",
                stock: item["Estoque"] || "Em estoque"
            };
        }).filter(p => p.name !== "Produto sem nome");

        renderCategoryFilters();
        renderProducts(products);
        updateCart();
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        const grid = document.getElementById('product-grid');
        if (grid) grid.innerHTML = `<div class="col-12 text-center py-5 text-danger">Erro ao carregar os produtos. Verifique o arquivo CSV.</div>`;
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).map(line => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || "";
        });
        return obj;
    });
}

// 3. RENDERIZAÇÃO DE FILTROS E PRODUTOS
function renderCategoryFilters() {
    const filterContainer = document.getElementById('category-filters');
    if (!filterContainer) return;

    const categories = ['Todos', ...new Set(products.map(p => p.category))].sort();

    filterContainer.innerHTML = categories.map((cat, index) => `
        <button type="button" 
                class="btn btn-outline-primary filter-btn ${index === 0 ? 'active' : ''}" 
                onclick="filterProducts('${escapeHTML(cat)}')">
            ${escapeHTML(cat)}
        </button>
    `).join('');
}

function filterProducts(category) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.trim().toLowerCase() === category.toLowerCase()) {
            btn.classList.add('active');
        }
    });

    if (category.toLowerCase() === 'todos') {
        renderProducts(products);
    } else {
        const filtered = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
        renderProducts(filtered);
    }
}

function renderProducts(items) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    if (items.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">Nenhum produto encontrado nesta categoria.</p></div>';
        return;
    }

    grid.innerHTML = items.map(product => `
        <div class="col-md-6 col-lg-4 wow fadeIn">
            <div class="card h-100 border-0 shadow-sm product-card bg-light">
                <div class="product-img-container rounded-top">
                    <img src="${product.image}" 
                         alt="${escapeHTML(product.name)}" 
                         class="img-fluid"
                         onerror="this.onerror=null; this.src='images/products/default.jpg';" />
                </div>
                <div class="card-body d-flex flex-column justify-content-between p-4">
                    <div>
                        <span class="badge bg-primary text-dark mb-2">${escapeHTML(product.category)}</span>
                        <h4 class="card-title font-work-sans text-dark fs-5">${escapeHTML(product.name)}</h4>
                        <p class="card-text text-muted small">${escapeHTML(truncate(product.description, 100))}</p>
                    </div>
                    <div class="mt-4 pt-3 border-top d-flex align-items-center justify-content-between">
                        <span class="fs-4 font-weight-bold text-dark">R$ ${product.price.toFixed(2).replace('.', ',')}</span>
                        <button onclick="addToCart('${product.id}')" class="btn btn-primary btn-sm text-uppercase font-weight-bold px-3">
                            <i class="fa fa-cart-plus me-1"></i> Comprar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function truncate(str, length) {
    return str.length > length ? str.substring(0, length) + '...' : str;
}

function escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

// 4. GERENCIAMENTO DO CARRINHO
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    updateCart();

    const offcanvasEl = document.getElementById('cartOffcanvas');
    if (offcanvasEl) {
        const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl) || new bootstrap.Offcanvas(offcanvasEl);
        bsOffcanvas.show();
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
}

function changeQuantity(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCart();
        }
    }
}

// 5. CUPOM DE DESCONTO
async function applyCoupon() {
    const input = document.getElementById('coupon-code');
    const msgEl = document.getElementById('coupon-message');
    if (!input) return;

    const rawCode = input.value.trim();
    const normalizedCode = rawCode.toLowerCase();

    if (!normalizedCode) {
        if (msgEl) {
            msgEl.className = "form-text small text-danger";
            msgEl.innerText = "Informe um código de cupom.";
        }
        return;
    }

    try {
        let couponRef = doc(db, "coupons", normalizedCode);
        let couponSnap = await getDoc(couponRef);

        if (!couponSnap.exists()) {
            couponRef = doc(db, "coupons", normalizedCode.toUpperCase());
            couponSnap = await getDoc(couponRef);
        }

        if (!couponSnap.exists() || !couponSnap.data().active) {
            if (msgEl) {
                msgEl.className = "form-text small text-danger";
                msgEl.innerText = "Cupom inválido ou expirado.";
            }
            appliedCoupon = null;
            updateCart();
            return;
        }

        appliedCoupon = { id: couponSnap.id, code: couponSnap.data().code || rawCode.toUpperCase(), ...couponSnap.data() };
        if (msgEl) {
            msgEl.className = "form-text small text-success";
            msgEl.innerText = `Cupom ${appliedCoupon.code} aplicado com sucesso!`;
        }
        updateCart();
    } catch (err) {
        console.error("Erro ao validar cupom:", err);
        if (msgEl) {
            msgEl.className = "form-text small text-danger";
            msgEl.innerText = "Erro ao validar cupom.";
        }
    }
}

// 6. ATUALIZAÇÃO DO CARRINHO E TOTAIS
function updateCart() {
    localStorage.setItem('studio_cart', JSON.stringify(cart));

    const cartItemsContainer = document.getElementById('cart-items');
    const badgeCount = document.getElementById('cart-badge-count');
    const subtotalEl = document.getElementById('cart-subtotal');
    const discountEl = document.getElementById('cart-discount');
    const totalEl = document.getElementById('cart-total');

    if (!cartItemsContainer) return;

    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    let discountValue = 0;
    if (appliedCoupon) {
        if (appliedCoupon.type === 'percent') {
            discountValue = (subtotal * appliedCoupon.value) / 100;
        } else if (appliedCoupon.type === 'fixed') {
            discountValue = appliedCoupon.value;
        }
    }
    if (discountValue > subtotal) discountValue = subtotal;

    const finalTotal = subtotal - discountValue;

    if (badgeCount) badgeCount.innerText = totalCount;
    if (subtotalEl) subtotalEl.innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    if (discountEl) discountEl.innerText = `- R$ ${discountValue.toFixed(2).replace('.', ',')}`;
    if (totalEl) totalEl.innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fa fa-shopping-basket fa-3x mb-3"></i>
                <p>Seu carrinho está vazio.</p>
            </div>
        `;
        return;
    }

    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="d-flex align-items-center justify-content-between p-2 mb-2 bg-light rounded border">
            <img src="${item.image}" alt="${escapeHTML(item.name)}" style="width: 50px; height: 50px; object-fit: cover;" class="rounded me-2" onerror="this.onerror=null; this.src='images/products/default.jpg';">
            <div class="flex-grow-1 me-2">
                <h6 class="mb-0 text-truncate" style="max-width: 130px;">${escapeHTML(item.name)}</h6>
                <small class="text-muted">R$ ${item.price.toFixed(2).replace('.', ',')}</small>
            </div>
            <div class="d-flex align-items-center gap-1">
                <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="changeQuantity('${item.id}', -1)">-</button>
                <span class="px-2 font-weight-bold">${item.quantity}</span>
                <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="changeQuantity('${item.id}', 1)">+</button>
            </div>
            <button class="btn btn-sm text-danger ms-2" onclick="removeFromCart('${item.id}')">
                <i class="fa fa-trash"></i>
            </button>
        </div>
    `).join('');
}

// 7. CHECKOUT E WHATSAPP
function openCheckoutModal() {
    if (cart.length === 0) {
        alert("Seu carrinho está vazio!");
        return;
    }

    const offcanvasEl = document.getElementById('cartOffcanvas');
    if (offcanvasEl) {
        const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
        if (bsOffcanvas) bsOffcanvas.hide();
    }

    const checkoutModal = new bootstrap.Modal(document.getElementById('checkoutModal'));
    checkoutModal.show();
}

async function processCheckout(event) {
    event.preventDefault();

    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Registrando pedido...';

    const customerData = {
        name: document.getElementById('cust-name').value,
        phone: document.getElementById('cust-phone').value,
        cep: document.getElementById('cust-cep').value,
        street: document.getElementById('cust-street').value,
        number: document.getElementById('cust-number').value,
        complement: document.getElementById('cust-complement').value || '',
        neighborhood: document.getElementById('cust-neighborhood').value,
        city: document.getElementById('cust-city').value,
        paymentMethod: document.getElementById('cust-payment').value,
        updatedAt: serverTimestamp()
    };

    localStorage.setItem('studio_customer', JSON.stringify(customerData));

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    let calcDiscount = 0;
    let calcCommission = 0;

    if (appliedCoupon) {
        if (appliedCoupon.type === 'percent') {
            calcDiscount = (subtotal * appliedCoupon.value) / 100;
        } else {
            calcDiscount = appliedCoupon.value;
        }
        if (calcDiscount > subtotal) calcDiscount = subtotal;

        if (appliedCoupon.commissionPercent) {
            const baseVal = subtotal - calcDiscount;
            calcCommission = (baseVal * appliedCoupon.commissionPercent) / 100;
        }
    }

    const finalTotal = subtotal - calcDiscount;

    const orderData = {
        customer: customerData,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity
        })),
        subtotal: subtotal,
        discountAmount: calcDiscount,
        totalAmount: finalTotal,
        coupon: appliedCoupon ? {
            code: appliedCoupon.code,
            affiliateName: appliedCoupon.affiliateName || null,
            commissionAmount: calcCommission
        } : null,
        status: "Pendente",
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "customers"), customerData);
        const orderRef = await addDoc(collection(db, "orders"), orderData);

        if (appliedCoupon && calcCommission > 0) {
            await addDoc(collection(db, "commissions"), {
                orderId: orderRef.id,
                affiliateName: appliedCoupon.affiliateName || "Geral",
                code: appliedCoupon.code,
                pixKey: appliedCoupon.pixKey || "Não informada",
                orderTotal: finalTotal,
                commissionPercent: appliedCoupon.commissionPercent || 0,
                commissionValue: calcCommission,
                payoutStatus: "Pendente",
                createdAt: serverTimestamp()
            });
        }

        const whatsappTarget = "5511986215473";
        let message = `*NOVO PEDIDO #${orderRef.id.slice(-6).toUpperCase()}*\n\n`;
        message += `*CLIENTE:* ${customerData.name}\n`;
        message += `*CONTATO:* ${customerData.phone}\n\n`;
        message += `*ENDEREÇO DE ENTREGA:*\n`;
        message += `${customerData.street}, Nº ${customerData.number}${customerData.complement ? ' (' + customerData.complement + ')' : ''}\n`;
        message += `Bairro: ${customerData.neighborhood} - ${customerData.city}\n`;
        message += `CEP: ${customerData.cep}\n\n`;
        message += `*FORMA DE PAGAMENTO:* ${customerData.paymentMethod}\n\n`;
        message += `*ITENS DO PEDIDO:*\n`;

        cart.forEach(item => {
            message += `• ${item.name} (x${item.quantity}) - R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}\n`;
        });

        if (appliedCoupon) {
            message += `\n*CUPOM APLICADO:* ${appliedCoupon.code} (-R$ ${calcDiscount.toFixed(2).replace('.', ',')})`;
        }
        message += `\n*SUBTOTAL:* R$ ${subtotal.toFixed(2).replace('.', ',')}`;
        message += `\n*TOTAL FINAL:* R$ ${finalTotal.toFixed(2).replace('.', ',')}\n\n`;
        message += `Aguardando confirmação do frete.`;

        localStorage.removeItem('studio_cart');
        cart = [];
        appliedCoupon = null;
        updateCart();

        window.open(`https://wa.me/${whatsappTarget}?text=${encodeURIComponent(message)}`, '_blank');

        const checkoutModalEl = document.getElementById('checkoutModal');
        const modalInstance = bootstrap.Modal.getInstance(checkoutModalEl);
        if (modalInstance) modalInstance.hide();

    } catch (error) {
        console.error("Erro ao salvar o pedido:", error);
        alert("Ocorreu um erro ao registrar seu pedido.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fab fa-whatsapp me-2"></i>Enviar Pedido via WhatsApp';
    }
}

// 8. EXPOSIÇÃO GLOBAL DE FUNÇÕES
window.filterProducts = filterProducts;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.changeQuantity = changeQuantity;
window.applyCoupon = applyCoupon;
window.openCheckoutModal = openCheckoutModal;
window.processCheckout = processCheckout;

document.addEventListener("DOMContentLoaded", () => {
    loadProductsFromCSV();
    loadSavedCustomerData();
});
