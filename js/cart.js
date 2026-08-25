import { db } from "./firebase-config.js";

import {
    collection,
    addDoc,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    ORDER_STATUS,
    PAYMENT_STATUS,
    FULFILLMENT_STATUS,
    COMMISSION_STATUS
} from "./contracts/order-status.js";

import {
    validateOrderIntegrity
} from "./contracts/order-integrity.js";

import {
    normalizeOrder,
    getOrderTotal
} from "./contracts/order-normalizer.js";

import {
    calculateOrderFinancials
} from "./contracts/order-financials.js";

import {
    createOrderOperation
} from "./services/order-service.js";


// =========================================================
// DECLARAÇÃO OBRIGATÓRIA DE TODAS AS VARIÁVEIS GLOBAIS
// (Devem estar no topo antes de qualquer execução)
// =========================================================
let cart = [];

function loadSavedCart() {
    try {
        const saved = JSON.parse(localStorage.getItem("studio_cart") || "[]");

        if (!Array.isArray(saved)) {
            return [];
        }

        return saved
            .filter(item => item && typeof item === "object")
            .map(item => ({
                ...item,
                id: String(item.id || "").trim(),
                quantity: Number(item.quantity)
            }))
            .filter(item =>
                item.id &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0
            );
    } catch (error) {
        console.warn("Carrinho salvo inválido. Carrinho será reiniciado.", error);
        localStorage.removeItem("studio_cart");
        return [];
    }
}

cart = loadSavedCart();
let appliedCoupon = null;
let products = [];
let orders = [];
let customers = [];
let coupons = [];
let commissions = [];

// =========================================================
// FUNÇÕES UTILITÁRIAS
// =========================================================
const money = value =>
    Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

const normalize = value =>
    String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

const onlyDigits = value =>
    String(value || "").replace(/\D/g, "");

const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

function getTimestamp(value) {
    if (!value) return 0;

    if (typeof value.toMillis === "function") {
        return value.toMillis();
    }

    if (typeof value.toDate === "function") {
        return value.toDate().getTime();
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 0
        : date.getTime();
}

function formatDate(value) {
    const timestamp = getTimestamp(value);

    return timestamp
        ? new Date(timestamp).toLocaleDateString("pt-BR")
        : "-";
}

function normalizePrice(value) {
    if (typeof value === "number") {
        return value;
    }

    let text = String(value || "0")
        .replace(/\s/g, "")
        .replace("R$", "");

    if (text.includes(",") && text.includes(".")) {
        text = text
            .replace(/\./g, "")
            .replace(",", ".");
    } else {
        text = text.replace(",", ".");
    }

    return Number(text) || 0;
}

function getCustomerFromOrder(order) {
    if (order.customer && typeof order.customer === "object") {
        return {
            name: order.customer.name || "",
            email: order.customer.email || "",
            phone: order.customer.phone || "",
            birthDate: order.customer.birthDate || "",
            cep: order.customer.cep || "",
            street: order.customer.street || "",
            number: order.customer.number || "",
            complement: order.customer.complement || "",
            neighborhood: order.customer.neighborhood || "",
            city: order.customer.city || "",
            state: order.customer.state || "",
            paymentMethod: order.customer.paymentMethod || ""
        };
    }

    // Compatibilidade com pedidos antigos
    return {
        name:
            order.customerName ||
            order.nomeCliente ||
            order.name ||
            "Cliente",

        email:
            order.email ||
            "",

        phone:
            order.phone ||
            order.telefone ||
            "",

        birthDate:
            order.birthDate ||
            "",

        city:
            order.city ||
            "",

        state:
            order.state ||
            "",

        paymentMethod:
            order.paymentMethod ||
            ""
    };
}

function getCouponFromOrder(order) {
    if (order.coupon && typeof order.coupon === "object") {
        return order.coupon;
    }

    return {
        code: order.couponCode || "",
        affiliateName: "",
        commissionAmount: 0
    };
}

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
function syncCartWithProducts() {
    if (!Array.isArray(cart) || !Array.isArray(products)) {
        cart = [];
        return;
    }

    const productMap = new Map(
        products.map(product => [String(product.id).trim(), product])
    );

    const syncedCart = [];
    const seenIds = new Set();

    for (const item of cart) {
        const id = String(item.id || "").trim();

        if (!id || seenIds.has(id)) {
            continue;
        }

        const product = productMap.get(id);

        if (!product) {
            console.warn(`Produto removido do catálogo: ${id}`);
            continue;
        }

        const quantity = Number(item.quantity);

        if (!Number.isInteger(quantity) || quantity <= 0) {
            continue;
        }

        syncedCart.push({
            ...product,
            quantity
        });

        seenIds.add(id);
    }

    cart = syncedCart;

    localStorage.setItem(
        "studio_cart",
        JSON.stringify(cart)
    );
}

async function loadProductsFromJSON() {
    try {
        const response = await fetch("./products.normalized.json", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Não foi possível carregar products.normalized.json (${response.status})`
            );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error(
                "products.normalized.json não contém um array."
            );
        }

        products = data
            .filter(product => product && typeof product === "object")
            .map(product => ({
                id: String(product.sku || "").trim(),
                sku: String(product.sku || "").trim(),
                name: String(product.name || "Produto sem nome").trim(),
                description: String(product.description || "").trim(),
                price: Number(product.price) || 0,
                category: String(product.category || "Geral").trim(),
                image: String(
                    product.image || "img/products/default.jpg"
                ).trim(),
                stock: product.stockStatus || "in_stock",
                stockStatus: product.stockStatus || "in_stock",
                stockQuantity:
                    Number.isInteger(product.stockQuantity)
                        ? product.stockQuantity
                        : null,
                weight: product.weight || ""
            }))
            .filter(product => product.id && product.name);

        console.log(
            `✅ ${products.length} produtos carregados de products.normalized.json`
        );

        renderCategoryFilters();
        renderProducts(products);
        syncCartWithProducts();
        updateCart();

    } catch (error) {
        console.error(
            "❌ Erro ao carregar catálogo normalizado:",
            error
        );

        const grid = document.getElementById("product-grid");

        if (grid) {
            grid.innerHTML = `
                <div class="col-12 text-center py-5 text-danger">
                    Erro ao carregar o catálogo de produtos.
                </div>
            `;
        }
    }
}

function renderOrders() {
    const tbody = document.getElementById("admin-orders-list");

    if (!tbody) return;

    const search = normalize(
        document.getElementById("orders-search")?.value
    );

    const status =
        document.getElementById("orders-status-filter")?.value || "";

    const dateFrom =
        document.getElementById("orders-date-from")?.value || "";

    const dateTo =
        document.getElementById("orders-date-to")?.value || "";

    const filtered = orders.filter(order => {

        const customer = getCustomerFromOrder(order);

        const searchable = normalize(`
            ${order.id}
            ${customer.name}
            ${customer.phone}
            ${customer.email}
        `);

        if (
            search &&
            !searchable.includes(search)
        ) {
            return false;
        }

        if (
            status &&
            order.status !== status
        ) {
            return false;
        }

        const timestamp =
            getTimestamp(order.createdAt);

        if (dateFrom) {
            const start =
                new Date(`${dateFrom}T00:00:00`).getTime();

            if (timestamp < start) {
                return false;
            }
        }

        if (dateTo) {
            const end =
                new Date(`${dateTo}T23:59:59`).getTime();

            if (timestamp > end) {
                return false;
            }
        }

        return true;
    });

    const total = filtered.reduce(
        (sum, order) =>
            sum + Number(order.totalAmount || 0),
        0
    );

    const paid = filtered
        .filter(order => order.status === "Pago")
        .reduce(
            (sum, order) =>
                sum + Number(order.totalAmount || 0),
            0
        );

    const pending = filtered
        .filter(order => order.status === "Pendente")
        .reduce(
            (sum, order) =>
                sum + Number(order.totalAmount || 0),
            0
        );

    const average =
        filtered.length
            ? total / filtered.length
            : 0;

    setSummary("orders-summary", [
        {
            label: "Pedidos",
            value: filtered.length
        },
        {
            label: "Valor filtrado",
            value: money(total)
        },
        {
            label: "Recebido",
            value: money(paid)
        },
        {
            label: "Pendente",
            value: money(pending)
        },
        {
            label: "Ticket médio",
            value: money(average)
        }
    ]);

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="admin-empty">
                    Nenhum pedido encontrado.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = filtered.map(order => {

        const customer =
            getCustomerFromOrder(order);

        const coupon =
            getCouponFromOrder(order);

        return `
            <tr>

                <td>
                    <strong>
                        #${escapeHTML(
                            order.id.substring(0, 8)
                        )}
                    </strong>
                </td>

                <td>
                    ${formatDate(order.createdAt)}
                </td>

                <td>
                    <strong>
                        ${escapeHTML(
                            customer.name || "Cliente"
                        )}
                    </strong>

                    <br>

                    <small class="text-muted">
                        ${escapeHTML(
                            customer.phone || "-"
                        )}
                    </small>
                </td>

                <td>
                    <strong>
                        ${money(order.totalAmount)}
                    </strong>
                </td>

                <td>
                    ${
                        coupon.code
                            ? `
                                <span class="badge bg-light text-dark">
                                    ${escapeHTML(coupon.code)}
                                </span>
                              `
                            : "-"
                    }
                </td>

                <td>
                    <select
                        class="form-select form-select-sm admin-status"
                        onchange="
                            updateOrderStatus(
                                '${order.id}',
                                this.value
                            )
                        "
                    >
                        ${
                            [
                                "Pendente",
                                "Pago",
                                "Enviado",
                                "Cancelado"
                            ]
                            .map(statusOption => `
                                <option
                                    value="${statusOption}"
                                    ${
                                        order.status === statusOption
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    ${statusOption}
                                </option>
                            `)
                            .join("")
                        }
                    </select>
                </td>

                <td>
                    <button
                        class="btn btn-sm btn-outline-primary"
                        onclick="
                            viewOrder('${order.id}')
                        "
                        title="Ver pedido"
                    >
                        <i class="fa fa-eye"></i>
                    </button>
                </td>

            </tr>
        `;

    }).join("");
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

    const totalCount = cart.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
    );

    let financials;

    try {
        financials = calculateOrderFinancials(
            cart,
            appliedCoupon
        );
    } catch (error) {
        console.error(
            "Erro no cálculo financeiro do carrinho:",
            error
        );

        financials = {
            subtotal: 0,
            discount: 0,
            total: 0,
            commission: 0
        };
    }

    const {
        subtotal,
        discount: discountValue,
        total: finalTotal
    } = financials;

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

async function generateOrderNumber() {
    const counterRef = doc(db, "counters", "orders");

    const sequence = await runTransaction(db, async transaction => {
        const counterSnap = await transaction.get(counterRef);

        const currentNumber = counterSnap.exists()
            ? Number(counterSnap.data().lastNumber) || 0
            : 0;

        const nextNumber = currentNumber + 1;

        transaction.set(
            counterRef,
            {
                lastNumber: nextNumber,
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );

        return nextNumber;
    });

    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `PED-${year}${month}${day}-${String(sequence).padStart(4, "0")}`;
}

async function processCheckout(event) {
    event.preventDefault();

    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Registrando pedido...';

    // FUNÇÃO AUXILIAR ÚNICA PARA OBTER VALORES DOS INPUTS
    const getValue = (...ids) => {
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el && el.value !== undefined) {
                return el.value.trim();
            }
        }
        return "";
    };

    // 1. DADOS DO CLIENTE
    const customerData = {
        name: getValue("cust-name"),
        email: getValue("cust-email", "cust-mail"),
        phone: getValue("cust-phone"),
        birthDate: getValue("cust-birthDate", "cust-birth-date", "cust-nascimento"),
        cep: getValue("cust-cep"),
        street: getValue("cust-street"),
        number: getValue("cust-number"),
        complement: getValue("cust-complement"),
        neighborhood: getValue("cust-neighborhood"),
        city: getValue("cust-city"),
        state: getValue("cust-state", "cust-uf"),
        paymentMethod: getValue("cust-payment") || "Pix",
        updatedAt: serverTimestamp()
    };

    if (!customerData.name) {
        alert("Informe o nome do cliente.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fab fa-whatsapp me-2"></i>Enviar Pedido via WhatsApp';
        return;
    }

    if (!customerData.phone) {
        alert("Informe o telefone do cliente.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fab fa-whatsapp me-2"></i>Enviar Pedido via WhatsApp';
        return;
    }

    // 2. IDENTIDADE ÚNICA DO CLIENTE (CHAVE PADRONIZADA)
    const normalizedPhone = customerData.phone.replace(/\D/g, "");
    const normalizedEmail = customerData.email.toLowerCase().trim();

    let customerId;
    if (normalizedPhone) {
        customerId = `phone_${normalizedPhone}`;
    } else if (normalizedEmail) {
        customerId = `email_${normalizedEmail.replace(/[^a-z0-9]/gi, "_")}`;
    } else {
        const fallback = `${customerData.name}_${customerData.city}`
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "");

        customerId = `customer_${fallback || Date.now()}`;
    }

    // 3. CÁLCULO DE VALORES E COMISSÃO
    const financials = calculateOrderFinancials(
        cart,
        appliedCoupon
    );

    const {
        subtotal,
        discount: calcDiscount,
        total: finalTotal,
        commission: calcCommission
    } = financials;

    const orderNumber = await generateOrderNumber();

    // 4. ESTRUTURAÇÃO DO PEDIDO
    // Modelo operacional: mantém os campos antigos para compatibilidade
    // e adiciona estruturas explícitas para pagamento, entrega e comissão.
   const orderData = {
    // =====================================================
    // SCHEMA V1 — CONTRATO CANÔNICO DO PEDIDO
    // =====================================================
    schemaVersion: "1.0",

    // Identidade do pedido
    orderNumber,
    customerId,

    // =====================================================
    // CLIENTE
    // =====================================================
    customer: {
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        birthDate: customerData.birthDate || null,

        address: {
            cep: customerData.cep || "",
            street: customerData.street || "",
            number: customerData.number || "",
            complement: customerData.complement || "",
            neighborhood: customerData.neighborhood || "",
            city: customerData.city || "",
            state: customerData.state || ""
        }
    },

    // =====================================================
    // ITENS
    // =====================================================
    items: cart.map(item => ({
        id: item.id,
        sku: item.sku || item.id,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        total:
            (Number(item.price) || 0) *
            (Number(item.quantity) || 1)
    })),

    // =====================================================
    // TOTAIS — ÚNICA FONTE DE VERDADE FINANCEIRA
    // =====================================================
    totals: {
        subtotal,
        discount: calcDiscount,
        total: finalTotal
    },

    // =====================================================
    // PAGAMENTO
    // =====================================================
    payment: {
        method: customerData.paymentMethod || "Pix",
        status: PAYMENT_STATUS.PENDENTE
    },

    // =====================================================
    // ENTREGA
    // =====================================================
    fulfillment: {
        status: FULFILLMENT_STATUS.PENDENTE
    },
    // =====================================================
    // CUPOM
    // =====================================================
    coupon: appliedCoupon
        ? {
            code: appliedCoupon.code,
            affiliateName: appliedCoupon.affiliateName || null,
            commissionAmount: calcCommission
        }
        : null,

    // =====================================================
    // COMISSÃO
    // =====================================================
    commission: {
        applicable: Boolean(
            appliedCoupon && calcCommission > 0
        ),
        amount: calcCommission,
        status:
        calcCommission > 0
            ? COMMISSION_STATUS.PENDENTE
            : COMMISSION_STATUS.NAO_APLICAVEL
    },

    // =====================================================
    // STATUS COMERCIAL
    // =====================================================
    status: ORDER_STATUS.PENDENTE,
    // =====================================================
    // AUDITORIA
    // =====================================================
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
};
        // =====================================================
    // VALIDAÇÃO DE INTEGRIDADE — SCHEMA V1
    // Nenhum pedido inválido pode ser persistido.
    // =====================================================
    const integrity = validateOrderIntegrity(orderData);

    if (!integrity.valid) {
        console.error(
            "Pedido rejeitado por falha de integridade:",
            integrity.errors
        );

        throw new Error(
            `Pedido inválido: ${integrity.errors.join(" | ")}`
        );
    }

    try {
        // 5. SALVAR/ATUALIZAR CLIENTE NO FIRESTORE
        const customerRef = doc(db, "customers", customerId);
        const existingCustomer = await getDoc(customerRef);

        if (existingCustomer.exists()) {
            await setDoc(
                customerRef,
                {
                    ...existingCustomer.data(),
                    ...customerData,
                    createdAt: existingCustomer.data().createdAt || serverTimestamp(),
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

        // SALVAR DADOS NO LOCALSTORAGE
        localStorage.setItem("studio_customer", JSON.stringify(customerData));

        // 6. CRIAR PEDIDO PELO NÚCLEO OPERACIONAL
        const createdOrder = await createOrderOperation({
            order: orderData,
            actorId: customerId,
            actorName: customerData.name,
            reason: "Pedido criado pelo checkout"
        });

        const orderRef = {
            id: createdOrder.order.id
        };

        // 7. REGISTRAR COMISSÃO (SE HOUVER CUPOM)
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

        // 8. GERAR MENSAGEM DO WHATSAPP
        const whatsappTarget = "5511986215473";
        let message = `*NOVO PEDIDO #${orderNumber} - SHINE EXPRESS*\n\n`;
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

        // LIMPAR CARRINHO E REDIRECIONAR
        localStorage.removeItem('studio_cart');
        cart = [];
        appliedCoupon = null;
        if (typeof updateCart === 'function') updateCart();

        window.open(`https://wa.me/${whatsappTarget}?text=${encodeURIComponent(message)}`, '_blank');

        const checkoutModalEl = document.getElementById('checkoutModal');
        if (checkoutModalEl) {
            const modalInstance = bootstrap.Modal.getInstance(checkoutModalEl);
            if (modalInstance) modalInstance.hide();
        }

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
    loadProductsFromJSON();
    loadSavedCustomerData();
});
