import { db } from "./firebase-config.js";
import {
    collection,
    addDoc,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// ESTADO GLOBAL
let products = [];
let cart = JSON.parse(localStorage.getItem('studio_cart')) || [];
let appliedCoupon = null;

// 1. AUTO-PREENCHIMENTO DE DADOS DO CLIENTE
function loadSavedCustomerData() {
    const savedCustomer = JSON.parse(localStorage.getItem('studio_customer'));
    if (!savedCustomer) return;

    if (document.getElementById('cust-email')) {
    document.getElementById('cust-email').value =
        savedCustomer.email || '';
}

if (document.getElementById('cust-birthDate')) {
    document.getElementById('cust-birthDate').value =
        savedCustomer.birthDate || '';
}

if (document.getElementById('cust-state')) {
    document.getElementById('cust-state').value =
        savedCustomer.state || '';
}
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
        const response = await fetch('./ecocsv - products1.csv', { cache: 'no-store' });
        if (!response.ok) throw new Error("Não foi possível carregar o arquivo CSV de produtos.");

        const csvText = await response.text();
        const rawData = parseCSV(csvText);

        products = rawData.map((item, index) => {
            const rawPrice = (item["Preço"] || item["Preco"] || "0").toString();
            const cleanPrice = rawPrice.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();

            return {
                id: String(index + 1),
                name: item["Produto"] || "Produto sem nome",
                description: item["Descrição"] || item["Descricao"] || "",
                price: parseFloat(cleanPrice) || 0,
                category: (item["Categoria"] || "Geral").trim(),
                image: item["Imagem"] || "img/products/default.jpg",
                stock: item["Estoque"] || "Em estoque"
            };
        }).filter(p => p.name !== "Produto sem nome");

        renderCategoryFilters();
        renderProducts(products);
        updateCart();
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        const grid = document.getElementById('product-grid');
        if (grid) grid.innerHTML = `<div class="col-12 text-center py-5 text-danger">Erro ao carregar os produtos do catálogo. Verifique o arquivo CSV.</div>`;
    }
}

function parseCSV(text) {
    text = String(text || '')
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    const lines = text
        .split('\n')
        .filter(line => line.trim() !== '');

    if (lines.length < 2) return [];

    const delimiter = lines[0].includes(';') ? ';' : ',';

    function parseLine(line) {
        const values = [];
        let value = '';
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const next = line[i + 1];

            if (char === '"' && insideQuotes && next === '"') {
                value += '"';
                i++;
                continue;
            }

            if (char === '"') {
                insideQuotes = !insideQuotes;
                continue;
            }

            if (char === delimiter && !insideQuotes) {
                values.push(value.trim());
                value = '';
                continue;
            }

            value += char;
        }

        values.push(value.trim());
        return values;
    }

    const headers = parseLine(lines[0]).map(header =>
        header.replace(/^\uFEFF/, '').trim()
    );

    return lines.slice(1).map(line => {
        const values = parseLine(line);
        const obj = {};

        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
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

    if (!Array.isArray(items) || items.length === 0) {
        grid.innerHTML = `
            <div class="col-12">
                <div class="catalog-empty text-center py-5">
                    <i class="fa fa-box-open fa-3x mb-3"></i>
                    <h5>Nenhum produto encontrado</h5>
                    <p>Não encontramos produtos nesta categoria.</p>
                </div>
            </div>
        `;
        return;
    }

    grid.innerHTML = items.map(product => {
        const price = Number(product.price) || 0;
        const image = product.image || 'img/products/default.jpg';
        const category = product.category || 'Geral';
        const name = product.name || 'Produto';
        const description = product.description || '';

        return `
            <div class="col-12 col-sm-6 col-lg-4 product-column">
                <article class="product-card h-100">

                    <div class="product-img-container">
                        <img
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(name)}"
                            class="product-image"
                            loading="lazy"
                            onerror="this.onerror=null;this.src='img/products/default.jpg';"
                        >
                    </div>

                    <div class="product-content d-flex flex-column">

                        <span class="product-category">
                            ${escapeHTML(category)}
                        </span>

                        <h3 class="product-name">
                            ${escapeHTML(name)}
                        </h3>

                        <p class="product-description">
                            ${escapeHTML(truncate(description, 120))}
                        </p>

                        <div class="product-footer mt-auto">

                            <div class="product-price">
                                R$ ${price.toFixed(2).replace('.', ',')}
                            </div>

                            <button
                                type="button"
                                class="btn btn-primary btn-buy-product"
                                onclick="addToCart('${escapeHTML(product.id)}')"
                                aria-label="Comprar ${escapeHTML(name)}"
                            >
                                <i class="fa fa-cart-plus me-2"></i>
                                Comprar
                            </button>

                        </div>
                    </div>
                </article>
            </div>
        `;
    }).join('');
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

// 5. VALIDAÇÃO DE CUPOM DE DESCONTO
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
            <img src="${item.image}" alt="${escapeHTML(item.name)}" style="width: 50px; height: 50px; object-fit: cover;" class="rounded me-2" onerror="this.onerror=null; this.src='img/products/default.jpg';">
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

// 7. CHECKOUT E INTEGRAÇÃO WHATSAPP
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

    const getValue = id =>
    document.getElementById(id)?.value?.trim() || '';

const customerData = {
    name: getValue('cust-name'),
    email: getValue('cust-email'),
    phone: getValue('cust-phone'),
    birthDate: getValue('cust-birthDate'),
    cep: getValue('cust-cep'),
    street: getValue('cust-street'),
    number: getValue('cust-number'),
    complement: getValue('cust-complement'),
    neighborhood: getValue('cust-neighborhood'),
    city: getValue('cust-city'),
    state: getValue('cust-state'),
    paymentMethod: getValue('cust-payment') || 'Pix',
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
      const customerPhoneKey = customerData.phone.replace(/\D/g, '');

const customerEmailKey = customerData.email
    .toLowerCase()
    .replace(/\s/g, '');

const customerKey =
    customerPhoneKey ||
    customerEmailKey ||
    crypto.randomUUID();

const customerRef = doc(
    db,
    "customers",
    customerKey
);

const existingCustomer = await getDoc(customerRef);

if (existingCustomer.exists()) {
    await setDoc(
        customerRef,
        {
            ...existingCustomer.data(),
            ...customerData,
            createdAt:
                existingCustomer.data().createdAt ||
                serverTimestamp(),
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );
} else {
    await setDoc(
        customerRef,
        {
            ...customerData,
            createdAt: serverTimestamp()
        }
    );
}
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
        let message = `*NOVO PEDIDO #${orderRef.id.slice(-6).toUpperCase()} - SHINE EXPRESS*\n\n`;
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
        message += `Aguardando confirmação do frete e chave PIX/link de pagamento.`;

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

// 8. EXPOSIÇÃO GLOBAL PARA MANIPULADORES HTML
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
