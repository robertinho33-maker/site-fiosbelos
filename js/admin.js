import { db } from "./firebase-config.js";

import {
    collection,
    doc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    normalizeOrder
} from "./contracts/order-normalizer.js";

import {
    validateOrderIntegrity
} from "./contracts/order-integrity.js";

import {
    confirmOrder,
    startOrderProcessing,
    completeOrder,
    cancelOrder,
    updatePaymentStatus,
    updateFulfillmentStatus,

} from "./contracts/order-operations.js";

import {
    releaseCommission,
    payCommission,
    cancelCommission
} from "./contracts/commission-operations.js";

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase-config.js";

const functions = getFunctions(app);
const setUserRole = httpsCallable(functions, "setUserRole");

// Exemplo: atribuir papel admin
await setUserRole({ uid: "USER_UID_AQUI", role: "admin" });

// Exemplo: atribuir papel influencer
await setUserRole({ uid: "USER_UID_AQUI", role: "influencer" });


let products = [];
let orders = [];
let customers = [];
let coupons = [];
let commissions = [];

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

const escapeHTML = str =>
    String(str ?? "").replace(/[&<>"']/g, m => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[m]);

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
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
    const timestamp = getTimestamp(value);
    return timestamp
        ? new Date(timestamp).toLocaleDateString("pt-BR")
        : "-";
}

function formatDateTime(value) {
    const timestamp = getTimestamp(value);

    return timestamp
        ? new Date(timestamp).toLocaleString("pt-BR")
        : "-";
}

function normalizePrice(value) {
    if (typeof value === "number") return value;

    let text = String(value || "0")
        .replace(/\s/g, "")
        .replace("R$", "");

    if (text.includes(",") && text.includes(".")) {
        text = text.replace(/\./g, "").replace(",", ".");
    } else {
        text = text.replace(",", ".");
    }

    return Number(text) || 0;
}

function getCustomerFromOrder(order) {
    return order.customer || {
        name: order.customerName || order.nomeCliente || "Cliente",
        email: order.email || "",
        phone: order.phone || order.telefone || "",
        city: order.city || "",
        state: order.state || "",
        birthDate: order.birthDate || ""
    };
}

function getCouponFromOrder(order) {
    return order.coupon || {
        code: order.couponCode || "",
        affiliateName: "",
        commissionAmount: 0
    };
}

/* =========================================================
   ESTILO DO PAINEL
========================================================= */

function injectAdminStyles() {
    if (document.getElementById("admin-dashboard-runtime-style")) return;

    const style = document.createElement("style");
    style.id = "admin-dashboard-runtime-style";

    style.textContent = `
        .admin-section-card {
            background: #fff;
            border: 1px solid #e9ecef;
            border-radius: 18px;
            box-shadow: 0 8px 30px rgba(0,0,0,.05);
            padding: 22px;
            margin-bottom: 28px;
        }

        .admin-section-card table {
            margin-bottom: 0;
        }

        .admin-section-card .table-responsive {
            border-radius: 14px;
            overflow-x: auto;
        }

        .admin-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
            margin-bottom: 18px;
            padding: 14px;
            background: #f8f9fa;
            border: 1px solid #edf0f2;
            border-radius: 14px;
        }

        .admin-toolbar .form-control,
        .admin-toolbar .form-select {
            min-height: 42px;
        }

        .admin-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
            gap: 12px;
            margin-bottom: 18px;
        }

        .admin-summary-card {
            background: linear-gradient(135deg, #fff, #f8f9fa);
            border: 1px solid #e9ecef;
            border-radius: 15px;
            padding: 16px;
        }

        .admin-summary-card small {
            display: block;
            color: #6c757d;
            margin-bottom: 5px;
        }

        .admin-summary-card strong {
            display: block;
            font-size: 1.25rem;
        }

        .admin-table {
            vertical-align: middle;
        }

        .admin-table thead th {
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
            white-space: nowrap;
            font-size: .78rem;
            text-transform: uppercase;
            letter-spacing: .04em;
            color: #6c757d;
        }

        .admin-table tbody tr {
            transition: background .2s ease;
        }

        .admin-table tbody tr:hover {
            background: #fafafa;
        }

        .admin-table td {
            padding: 13px 12px;
        }

        .admin-thumb {
            width: 52px;
            height: 52px;
            object-fit: contain;
            background: #f8f9fa;
            border: 1px solid #eee;
            border-radius: 10px;
            padding: 4px;
        }

        .admin-image-url {
            min-width: 250px;
        }

        .admin-status {
            min-width: 120px;
        }

        .admin-empty {
            padding: 40px 20px !important;
            text-align: center;
            color: #6c757d;
        }

        .admin-danger-text {
            color: #dc3545;
        }

        .admin-success-text {
            color: #198754;
        }

        .admin-period {
            min-width: 145px;
        }

        .admin-actions {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }

        .admin-modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,.45);
            z-index: 1055;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .admin-modal-box {
            width: min(650px, 100%);
            max-height: 90vh;
            overflow-y: auto;
            background: #fff;
            border-radius: 18px;
            padding: 24px;
            box-shadow: 0 25px 80px rgba(0,0,0,.25);
        }

        @media(max-width: 768px) {
            .admin-section-card {
                padding: 14px;
            }

            .admin-toolbar {
                flex-direction: column;
                align-items: stretch;
            }

            .admin-toolbar > * {
                width: 100% !important;
            }
        }
    `;

    document.head.appendChild(style);
}

/* =========================================================
   UTILITÁRIOS DE UI
========================================================= */

function findTableContainer(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return null;

    return (
        tbody.closest(".admin-section-card") ||
        tbody.closest(".card") ||
        tbody.closest("section") ||
        tbody.parentElement?.parentElement
    );
}

function createToolbar(tbodyId, toolbarId, html) {
    if (document.getElementById(toolbarId)) {
        return document.getElementById(toolbarId);
    }

    const container = findTableContainer(tbodyId);
    if (!container) return null;

    const toolbar = document.createElement("div");
    toolbar.id = toolbarId;
    toolbar.className = "admin-toolbar";
    toolbar.innerHTML = html;

    const tableResponsive = container.querySelector(".table-responsive");

    if (tableResponsive) {
        tableResponsive.parentNode.insertBefore(toolbar, tableResponsive);
    } else {
        const table = container.querySelector("table");

        if (table) {
            table.parentNode.insertBefore(toolbar, table);
        } else {
            container.insertBefore(toolbar, container.firstChild);
        }
    }

    return toolbar;
}

function createSummary(tbodyId, summaryId) {
    if (document.getElementById(summaryId)) {
        return document.getElementById(summaryId);
    }

    const container = findTableContainer(tbodyId);
    if (!container) return null;

    const summary = document.createElement("div");
    summary.id = summaryId;
    summary.className = "admin-summary";

    const toolbar = container.querySelector(".admin-toolbar");

    if (toolbar) {
        toolbar.parentNode.insertBefore(summary, toolbar);
    } else {
        const table = container.querySelector("table");

        if (table) {
            table.parentNode.insertBefore(summary, table);
        } else {
            container.insertBefore(summary, container.firstChild);
        }
    }

    return summary;
}

function setSummary(summaryId, cards) {
    const el = document.getElementById(summaryId);
    if (!el) return;

    el.innerHTML = cards.map(card => `
        <div class="admin-summary-card">
            <small>${escapeHTML(card.label)}</small>
            <strong>${escapeHTML(card.value)}</strong>
        </div>
    `).join("");
}

function showAdminModal(title, body, buttons = "") {
    closeAdminModal();

    const wrapper = document.createElement("div");
    wrapper.id = "admin-runtime-modal";
    wrapper.className = "admin-modal-backdrop";

    wrapper.innerHTML = `
        <div class="admin-modal-box">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4 class="mb-0">${escapeHTML(title)}</h4>
                <button type="button" class="btn btn-sm btn-light" onclick="closeAdminModal()">
                    <i class="fa fa-times"></i>
                </button>
            </div>

            ${body}

            ${buttons ? `
                <div class="d-flex justify-content-end gap-2 mt-4">
                    ${buttons}
                </div>
            ` : ""}
        </div>
    `;

    document.body.appendChild(wrapper);
}

function closeAdminModal() {
    document.getElementById("admin-runtime-modal")?.remove();
}

window.closeAdminModal = closeAdminModal;

/* =========================================================
   1. PEDIDOS
========================================================= */

async function loadOrders() {
    const tbody = document.getElementById("admin-orders-list");
    if (!tbody) return;

    try {
        // Não usamos orderBy aqui.
        // Isso evita problemas com pedidos antigos sem createdAt.
        const snapshot = await getDocs(collection(db, "orders"));

      orders = snapshot.docs.map(item => {
    const normalizedOrder =
        normalizeOrder({
            id: item.id,
            ...item.data()
        });

    const integrity =
        validateOrderIntegrity(
            normalizedOrder
        );

    return {
        ...normalizedOrder,

        integrity: {
            valid: integrity.valid,
            errors: integrity.errors
        }
    };
});

        orders.sort(
            (a, b) =>
                getTimestamp(b.createdAt) -
                getTimestamp(a.createdAt)
        );

        createOrderInterface();
        renderOrders();

    } catch (error) {
        console.error("Erro ao carregar pedidos:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="admin-empty admin-danger-text">
                    <i class="fa fa-exclamation-triangle fa-2x mb-2"></i>
                    <br>
                    Não foi possível carregar os pedidos.
                    <br>
                    <small>${escapeHTML(error.message)}</small>
                </td>
            </tr>
        `;
    }
}

function createOrderInterface() {
    createToolbar(
        "admin-orders-list",
        "orders-toolbar",
        `
            <input
                id="orders-search"
                class="form-control"
                style="max-width:260px"
                placeholder="Pesquisar cliente, pedido ou telefone..."
                oninput="renderOrders()"
            >

            <select
                id="orders-status-filter"
                class="form-select"
                style="max-width:180px"
                onchange="renderOrders()"
            >
                <option value="">Todos os status</option>
                <option value="Pendente">Pendente</option>
                <option value="Confirmado">Confirmado</option>
                <option value="Em processamento">Em processamento</option>
                <option value="Concluido">Concluído</option>
                <option value="Cancelado">Cancelado</option>
            </select>

            <input
                id="orders-date-from"
                type="date"
                class="form-control admin-period"
                onchange="renderOrders()"
            >

            <input
                id="orders-date-to"
                type="date"
                class="form-control admin-period"
                onchange="renderOrders()"
            >

            <button
                class="btn btn-outline-secondary"
                onclick="clearOrderFilters()"
            >
                <i class="fa fa-eraser me-1"></i>
                Limpar
            </button>
        `
    );

    createSummary("admin-orders-list", "orders-summary");

    const tbody = document.getElementById("admin-orders-list");

    const table = tbody.closest("table");

    if (table) {
        table.classList.add("admin-table");

        const headers = table.querySelector("thead tr");

        if (headers) {
            headers.innerHTML = `
                <th>Pedido</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Cupom</th>
                <th>Integridade</th>
                <th>Status</th>
                <th>Ações</th>
            `;
        }
    }
}

function clearOrderFilters() {
    ["orders-search", "orders-status-filter", "orders-date-from", "orders-date-to"]
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });

    renderOrders();
}

function renderOrders() {
    const tbody = document.getElementById("admin-orders-list");
    if (!tbody) return;

    const search = normalize(
        document.getElementById("orders-search")?.value
    );

    const status = document.getElementById("orders-status-filter")?.value;

    const dateFrom =
        document.getElementById("orders-date-from")?.value || "";

    const dateTo =
        document.getElementById("orders-date-to")?.value || "";

    const filtered = orders.filter(order => {
        const customer = getCustomerFromOrder(order);
        const id = order.id || "";

        const searchable = normalize(`
            ${id}
            ${customer.name}
            ${customer.phone}
            ${customer.email}
        `);

        if (search && !searchable.includes(search)) {
            return false;
        }

        if (status && order.status !== status) {
            return false;
        }

        const timestamp = getTimestamp(order.createdAt);

        if (dateFrom) {
            const start = new Date(`${dateFrom}T00:00:00`).getTime();

            if (timestamp < start) return false;
        }

        if (dateTo) {
            const end = new Date(`${dateTo}T23:59:59`).getTime();

            if (timestamp > end) return false;
        }

        return true;
    });

    const total = filtered.reduce(
        (sum, order) => sum + Number(order.totalAmount || 0),
        0
    );

    const paid = filtered
        .filter(order => order.paymentStatus === "Pago")
        .reduce(
            (sum, order) => sum + Number(order.totalAmount || 0),
            0
        );

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
            label: "Pedidos pagos",
            value: money(paid)
        },
        {
            label: "Ticket médio",
            value: money(filtered.length ? total / filtered.length : 0)
        }
    ]);

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="admin-empty">
                    Nenhum pedido encontrado com os filtros atuais.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(order => {
        const customer = getCustomerFromOrder(order);
        const coupon = getCouponFromOrder(order);

        return `
            <tr>
                <td>
                    <strong>#${escapeHTML(order.id.substring(0, 8))}</strong>
                </td>

                <td>
                    <small>${formatDate(order.createdAt)}</small>
                </td>

                <td>
                    <strong>${escapeHTML(customer.name || "Cliente")}</strong>
                    <br>
                    <small class="text-muted">
                        ${escapeHTML(customer.phone || "Telefone não informado")}
                    </small>
                </td>

                <td>
                    <strong>${money(order.totalAmount)}</strong>
                </td>


                    <td>
    ${
        order.integrity?.valid
            ? `
                <span
                    class="badge bg-success"
                    title="Dados financeiros íntegros"
                >
                    <i class="fa fa-check me-1"></i>
                    Íntegro
                </span>
              `
            : `
                <span
                    class="badge bg-danger"
                    title="${escapeHTML(
                        (order.integrity?.errors || []).join(" | ")
                    )}"
                >
                    <i class="fa fa-exclamation-triangle me-1"></i>
                    Revisar
                </span>
              `
    }
</td>



                <td>
                    <select
                        class="form-select form-select-sm admin-status"
                        onchange="updateOrderStatus('${order.id}', this.value)"
                    >
                        ${[
    "Pendente",
    "Confirmado",
    "Em processamento",
    "Concluido",
    "Cancelado"
]
                            .map(
                                statusOption => `
                                <option
                                    value="${statusOption}"
                                    ${
                                        order.orderStatus === statusOption
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    ${statusOption}
                                </option>
                            `
                            )
                            .join("")}
                    </select>
                </td>

                <td>
                    <div class="admin-actions">
                        <button
                            class="btn btn-sm btn-outline-primary"
                            onclick="viewOrder('${order.id}')"
                            title="Ver pedido"
                        >
                            <i class="fa fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const order = orders.find(item => item.id === orderId);

        if (!order) {
            throw new Error("Pedido não encontrado.");
        }

        switch (newStatus) {
            case "Confirmado":
                await confirmOrder(order);
                break;

            case "Em processamento":
                await startOrderProcessing(order);
                break;

            case "Concluido":
                await completeOrder(order);
                break;

            case "Cancelado":
                await cancelOrder(order);
                break;

            default:
                throw new Error(
                    `Status operacional inválido: ${newStatus}`
                );
        }

        order.status = newStatus;
        order.orderStatus = newStatus;

        renderOrders();

    } catch (error) {
        console.error(
            "Erro ao atualizar pedido:",
            error
        );

        alert(
            error?.message ||
            "Não foi possível atualizar o status do pedido."
        );

        renderOrders();
    }
}

async function handlePaymentStatus(orderId, newStatus) {
    try {
        const order = orders.find(item => item.id === orderId);

        if (!order) {
            throw new Error("Pedido não encontrado.");
        }

        await updatePaymentStatus(order, newStatus);

        order.paymentStatus = newStatus;

        if (!order.payment) {
            order.payment = {};
        }

        order.payment.status = newStatus;

        renderOrders();

    } catch (error) {
        console.error(
            "Erro ao atualizar pagamento:",
            error
        );

        alert(
            error?.message ||
            "Não foi possível atualizar o pagamento."
        );

        renderOrders();
    }
}


async function handleFulfillmentStatus(orderId, newStatus) {
    try {
        const order = orders.find(item => item.id === orderId);

        if (!order) {
            throw new Error("Pedido não encontrado.");
        }

        await updateFulfillmentStatus(order, newStatus);

        order.fulfillmentStatus = newStatus;

        if (!order.fulfillment) {
            order.fulfillment = {};
        }

        order.fulfillment.status = newStatus;

        renderOrders();

    } catch (error) {
        console.error(
            "Erro ao atualizar fulfillment:",
            error
        );

        alert(
            error?.message ||
            "Não foi possível atualizar o fulfillment."
        );

        renderOrders();
    }
}


window.handlePaymentStatus = handlePaymentStatus;
window.handleFulfillmentStatus = handleFulfillmentStatus;

function viewOrder(orderId) {
    const order = orders.find(item => item.id === orderId);

    if (!order) return;

    const customer = getCustomerFromOrder(order);
    const coupon = getCouponFromOrder(order);

    const items = Array.isArray(order.items)
        ? order.items
        : [];

    showAdminModal(
        `Pedido #${order.id.substring(0, 8)}`,
        `
            <div class="row g-3">

                <div class="col-md-6">
                    <label class="form-label">Cliente</label>
                    <div class="form-control bg-light">
                        ${escapeHTML(customer.name || "-")}
                    </div>
                </div>

                <div class="col-md-6">
                    <label class="form-label">Telefone</label>
                    <div class="form-control bg-light">
                        ${escapeHTML(customer.phone || "-")}
                    </div>
                </div>

                <div class="col-md-6">
                    <label class="form-label">E-mail</label>
                    <div class="form-control bg-light">
                        ${escapeHTML(customer.email || "-")}
                    </div>
                </div>

                <div class="col-md-6">
                    <label class="form-label">Pagamento</label>
                    <div class="form-control bg-light">
                        ${escapeHTML(customer.paymentMethod || "-")}
                    </div>
                </div>

                <div class="col-md-6">
    <label class="form-label">Status do pagamento</label>

    <select
        class="form-select"
        onchange="handlePaymentStatus('${order.id}', this.value)"
    >
        ${[
            "Pendente",
            "Pago",
            "Recusado",
            "Cancelado"
        ]
            .map(status => `
                <option
                    value="${status}"
                    ${
                        order.paymentStatus === status
                            ? "selected"
                            : ""
                    }
                >
                    ${status}
                </option>
            `)
            .join("")}
    </select>
</div>

<div class="col-md-6">
    <label class="form-label">Fulfillment</label>

    <select
        class="form-select"
        onchange="handleFulfillmentStatus('${order.id}', this.value)"
    >
        ${[
            "Pendente",
            "Preparando",
            "Enviado",
            "Entregue",
            "Cancelado"
        ]
            .map(status => `
                <option
                    value="${status}"
                    ${
                        order.fulfillmentStatus === status
                            ? "selected"
                            : ""
                    }
                >
                    ${status}
                </option>
            `)
            .join("")}
    </select>
</div>

                <div class="col-12">
                    <label class="form-label">Itens</label>

                    <div class="list-group">
                        ${
                            items.length
                                ? items.map(item => `
                                    <div class="list-group-item d-flex justify-content-between">
                                        <span>
                                            ${escapeHTML(item.name || "Produto")}
                                            × ${Number(item.quantity || 1)}
                                        </span>
                                        <strong>
                                            ${money(item.total || (item.price * item.quantity))}
                                        </strong>
                                    </div>
                                `).join("")
                                : `
                                    <div class="list-group-item text-muted">
                                        Nenhum item registrado.
                                    </div>
                                `
                        }
                    </div>
                </div>

                                <div class="col-md-4">
                    <small class="text-muted">Subtotal</small>
                    <h5>${money(order.subtotal)}</h5>
                </div>

                <div class="col-md-4">
                    <small class="text-muted">Desconto</small>
                    <h5 class="text-danger">
                        - ${money(order.discountAmount)}
                    </h5>
                </div>

                <div class="col-md-4">
                    <small class="text-muted">Total</small>
                    <h4>${money(order.totalAmount)}</h4>
                </div>

                <div class="col-md-4">
                    <small class="text-muted">Status do pedido</small>
                    <div class="form-control bg-light">
                        ${escapeHTML(order.orderStatus || "Pendente")}
                    </div>
                </div>

                <div class="col-md-4">
                    <small class="text-muted">Pagamento</small>
                    <div class="form-control bg-light">
                        ${escapeHTML(order.paymentStatus || "Não informado")}
                    </div>
                </div>

                <div class="col-md-4">
                    <small class="text-muted">Entrega</small>
                    <div class="form-control bg-light">
                        ${escapeHTML(
                            order.fulfillmentStatus || "Não informado"
                        )}
                    </div>
                </div>

                ${
                    coupon.code
                        ? `
                            <div class="col-12">
                                <div class="alert alert-light">
                                    Cupom:
                                    <strong>${escapeHTML(coupon.code)}</strong>
                                </div>
                            </div>
                        `
                        : ""
                }

            </div>
        `
    );
}

window.updateOrderStatus = updateOrderStatus;
window.viewOrder = viewOrder;
window.renderOrders = renderOrders;
window.clearOrderFilters = clearOrderFilters;

/* =========================================================
   2. CLIENTES
========================================================= */

async function loadCustomers() {
    const tbody = document.getElementById("admin-customers-list");
    if (!tbody) return;

    try {
        const snapshot = await getDocs(collection(db, "customers"));

        customers = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        createCustomerInterface();
        renderCustomers();

    } catch (error) {
        console.error("Erro ao carregar clientes:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="admin-empty admin-danger-text">
                    Erro ao carregar clientes.
                </td>
            </tr>
        `;
    }
}

function customerKey(customer) {
    const phone = onlyDigits(customer.phone);

    if (phone) {
        return `phone:${phone}`;
    }

    const email = normalize(customer.email);

    if (email) {
        return `email:${email}`;
    }

    return `name:${normalize(customer.name)}|city:${normalize(customer.city)}`;
}

function mergeCustomers() {
    const map = new Map();

    customers.forEach(customer => {
        const key = customerKey(customer);

        if (!map.has(key)) {
            map.set(key, {
                ...customer,
                _ids: [customer.id]
            });
            return;
        }

        const current = map.get(key);

        current._ids.push(customer.id);

        const fields = [
            "name",
            "email",
            "phone",
            "city",
            "state",
            "birthDate",
            "cep",
            "street",
            "number",
            "neighborhood"
        ];

        fields.forEach(field => {
            if (!current[field] && customer[field]) {
                current[field] = customer[field];
            }
        });

        if (
            getTimestamp(customer.createdAt) &&
            (
                !getTimestamp(current.createdAt) ||
                getTimestamp(customer.createdAt) <
                    getTimestamp(current.createdAt)
            )
        ) {
            current.createdAt = customer.createdAt;
        }
    });

    return [...map.values()];
}

function calculateCustomerConsumption(customer) {
    const phone = onlyDigits(customer.phone);
    const email = normalize(customer.email);
    const name = normalize(customer.name);

    return orders
        .filter(order => {
            const c = getCustomerFromOrder(order);

            const orderPhone = onlyDigits(c.phone);
            const orderEmail = normalize(c.email);
            const orderName = normalize(c.name);

            if (phone && orderPhone && phone === orderPhone) {
                return true;
            }

            if (email && orderEmail && email === orderEmail) {
                return true;
            }

            return (
                !phone &&
                !email &&
                name &&
                orderName === name
            );
        })
        .reduce(
            (sum, order) => sum + Number(order.totalAmount || 0),
            0
        );
}

function createCustomerInterface() {
    createToolbar(
        "admin-customers-list",
        "customers-toolbar",
        `
            <input
                id="customers-search"
                class="form-control"
                placeholder="Pesquisar nome, telefone ou e-mail..."
                oninput="renderCustomers()"
            >

            <button
                class="btn btn-outline-secondary"
                onclick="clearCustomerFilter()"
            >
                <i class="fa fa-eraser me-1"></i>
                Limpar
            </button>
        `
    );

    createSummary("admin-customers-list", "customers-summary");

    const tbody = document.getElementById("admin-customers-list");
    const table = tbody.closest("table");

    if (table) {
        table.classList.add("admin-table");

        const headers = table.querySelector("thead tr");

        if (headers) {
            headers.innerHTML = `
                <th>Cliente</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Cidade / UF</th>
                <th>Nascimento</th>
                <th>Cadastro</th>
                <th>Consumo</th>
                <th>Pedidos</th>
            `;
        }
    }
}

function clearCustomerFilter() {
    const input = document.getElementById("customers-search");

    if (input) input.value = "";

    renderCustomers();
}

function renderCustomers() {
    const tbody = document.getElementById("admin-customers-list");
    if (!tbody) return;

    const search = normalize(
        document.getElementById("customers-search")?.value
    );

    const uniqueCustomers = mergeCustomers();

    const filtered = uniqueCustomers.filter(customer => {
        if (!search) return true;

        return normalize(`
            ${customer.name}
            ${customer.email}
            ${customer.phone}
            ${customer.city}
            ${customer.state}
        `).includes(search);
    });

    const consumption = filtered.reduce(
        (sum, customer) =>
            sum + calculateCustomerConsumption(customer),
        0
    );

    setSummary("customers-summary", [
        {
            label: "Clientes únicos",
            value: filtered.length
        },
        {
            label: "Cadastros no banco",
            value: customers.length
        },
        {
            label: "Duplicidades detectadas",
            value: Math.max(customers.length - uniqueCustomers.length, 0)
        },
        {
            label: "Consumo total",
            value: money(consumption)
        }
    ]);

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="admin-empty">
                    Nenhum cliente encontrado.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(customer => {
        const consumptionValue =
            calculateCustomerConsumption(customer);

        const customerOrders = orders.filter(order => {
            const c = getCustomerFromOrder(order);

            const p1 = onlyDigits(customer.phone);
            const p2 = onlyDigits(c.phone);

            if (p1 && p2) return p1 === p2;

            return normalize(customer.name) === normalize(c.name);
        }).length;

        return `
            <tr>
                <td>
                    <strong>
                        ${escapeHTML(customer.name || "Sem nome")}
                    </strong>
                </td>

                <td>
                    ${escapeHTML(customer.email || "-")}
                </td>

                <td>
                    ${escapeHTML(customer.phone || "-")}
                </td>

                <td>
                    ${
                        customer.city
                            ? `${escapeHTML(customer.city)} / ${escapeHTML(customer.state || "-")}`
                            : "-"
                    }
                </td>

                <td>
                    ${escapeHTML(customer.birthDate || "-")}
                </td>

                <td>
                    ${formatDate(customer.createdAt)}
                </td>

                <td>
                    <strong class="admin-success-text">
                        ${money(consumptionValue)}
                    </strong>
                </td>

                <td>
                    <span class="badge bg-light text-dark">
                        ${customerOrders}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

window.renderCustomers = renderCustomers;
window.clearCustomerFilter = clearCustomerFilter;

/* =========================================================
   3. COMISSÕES
========================================================= */

async function loadCommissions() {
    const tbody = document.getElementById("admin-commissions-list");
    if (!tbody) return;

    try {
        const snapshot = await getDocs(
            collection(db, "commissions")
        );

        commissions = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        commissions.sort(
            (a, b) =>
                getTimestamp(b.createdAt) -
                getTimestamp(a.createdAt)
        );

        createCommissionInterface();
        renderCommissions();

    } catch (error) {
        console.error("Erro ao carregar comissões:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="admin-empty admin-danger-text">
                    Erro ao carregar comissões.
                </td>
            </tr>
        `;
    }
}

function createCommissionInterface() {
    createToolbar(
        "admin-commissions-list",
        "commissions-toolbar",
        `
            <label class="mb-0 small text-muted">
                De
            </label>

            <input
                id="commissions-date-from"
                type="date"
                class="form-control admin-period"
                onchange="renderCommissions()"
            >

            <label class="mb-0 small text-muted">
                Até
            </label>

            <input
                id="commissions-date-to"
                type="date"
                class="form-control admin-period"
                onchange="renderCommissions()"
            >

            <select
                id="commissions-status"
                class="form-select"
                style="max-width:180px"
                onchange="renderCommissions()"
            >
                <option value="">Todos os pagamentos</option>
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
            </select>

            <input
                id="commissions-search"
                class="form-control"
                placeholder="Afiliado ou cupom..."
                oninput="renderCommissions()"
            >

            <button
                class="btn btn-outline-secondary"
                onclick="clearCommissionFilters()"
            >
                <i class="fa fa-eraser me-1"></i>
                Limpar
            </button>
        `
    );

    createSummary("admin-commissions-list", "commissions-summary");

    const tbody = document.getElementById("admin-commissions-list");
    const table = tbody.closest("table");

    if (table) {
        table.classList.add("admin-table");

        const headers = table.querySelector("thead tr");

        if (headers) {
            headers.innerHTML = `
                <th>Afiliado</th>
                <th>Cupom</th>
                <th>Pedido</th>
                <th>%</th>
                <th>Comissão</th>
                <th>Data</th>
                <th>Pagamento</th>
            `;
        }
    }
}

function clearCommissionFilters() {
    [
        "commissions-date-from",
        "commissions-date-to",
        "commissions-status",
        "commissions-search"
    ].forEach(id => {
        const el = document.getElementById(id);

        if (el) el.value = "";
    });

    renderCommissions();
}

function renderCommissions() {
    const tbody = document.getElementById("admin-commissions-list");
    if (!tbody) return;

    const dateFrom =
        document.getElementById("commissions-date-from")?.value || "";

    const dateTo =
        document.getElementById("commissions-date-to")?.value || "";

    const status =
        document.getElementById("commissions-status")?.value || "";

    const search = normalize(
        document.getElementById("commissions-search")?.value
    );

    const filtered = commissions.filter(commission => {
        const timestamp = getTimestamp(commission.createdAt);

        if (dateFrom) {
            const start =
                new Date(`${dateFrom}T00:00:00`).getTime();

            if (timestamp < start) return false;
        }

        if (dateTo) {
            const end =
                new Date(`${dateTo}T23:59:59`).getTime();

            if (timestamp > end) return false;
        }

        if (
            status &&
            (commission.payoutStatus || "Pendente") !== status
        ) {
            return false;
        }

        if (search) {
            const text = normalize(`
                ${commission.affiliateName}
                ${commission.code}
            `);

            if (!text.includes(search)) return false;
        }

        return true;
    });

    const commissionTotal = filtered.reduce(
        (sum, item) =>
            sum + Number(item.commissionValue || 0),
        0
    );

    const orderTotal = filtered.reduce(
        (sum, item) =>
            sum + Number(item.orderTotal || 0),
        0
    );

    const pending = filtered
        .filter(item => (item.payoutStatus || "Pendente") === "Pendente")
        .reduce(
            (sum, item) =>
                sum + Number(item.commissionValue || 0),
            0
        );

    setSummary("commissions-summary", [
        {
            label: "Registros",
            value: filtered.length
        },
        {
            label: "Vendas",
            value: money(orderTotal)
        },
        {
            label: "Comissões",
            value: money(commissionTotal)
        },
        {
            label: "A pagar",
            value: money(pending)
        }
    ]);

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="admin-empty">
                    Nenhuma comissão encontrada no período.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(item => `
        <tr>
            <td>
                <strong>
                    ${escapeHTML(item.affiliateName || "Geral")}
                </strong>
            </td>

            <td>
                <span class="badge bg-light text-dark">
                    ${escapeHTML(item.code || "-")}
                </span>
            </td>

            <td>
                ${money(item.orderTotal)}
            </td>

            <td>
                ${Number(item.commissionPercent || 0)}%
            </td>

            <td>
                <strong class="admin-success-text">
                    ${money(item.commissionValue)}
                </strong>
            </td>

            <td>
                ${formatDate(item.createdAt)}
            </td>

            <td>
                <select
                    class="form-select form-select-sm"
                    onchange="updateCommissionStatus('${item.id}', this.value)"
                >
                    <option
                        value="Pendente"
                        ${
                            (item.payoutStatus || "Pendente") === "Pendente"
                                ? "selected"
                                : ""
                        }
                    >
                        Pendente
                    </option>

                    <option
                        value="Pago"
                        ${
                            item.payoutStatus === "Pago"
                                ? "selected"
                                : ""
                        }
                    >
                        Pago
                    </option>
                </select>
            </td>
        </tr>
    `).join("");
}

async function updateCommissionStatus(id, status) {
    try {
        const item = commissions.find(
            commission => commission.id === id
        );

        if (!item) {
            throw new Error("Comissão não encontrada.");
        }

        switch (status) {
            case "Liberada":
                await releaseCommission(item);
                break;

            case "Paga":
                await payCommission(item);
                break;

            case "Cancelada":
                await cancelCommission(item);
                break;

            default:
                throw new Error(
                    `Status de comissão inválido: ${status}`
                );
        }

        item.payoutStatus = status;

        renderCommissions();

    } catch (error) {
        console.error(
            "Erro ao atualizar comissão:",
            error
        );

        alert(
            error?.message ||
            "Não foi possível atualizar a comissão."
        );

        renderCommissions();
    }
}

window.renderCommissions = renderCommissions;
window.clearCommissionFilters = clearCommissionFilters;
window.updateCommissionStatus = updateCommissionStatus;

/* =========================================================
   4. CUPONS
========================================================= */

async function saveCoupon(event) {
    event.preventDefault();

    const codeInput =
        document.getElementById("coup-code")?.value.trim();

    if (!codeInput) {
        alert("Informe o código do cupom.");
        return;
    }

    const code = codeInput.toUpperCase();
    const id = normalize(code);

    const couponData = {
        code,
        type:
            document.getElementById("coup-type")?.value ||
            "percent",

        value:
            Number(
                document.getElementById("coup-value")?.value || 0
            ),

        commissionPercent:
            Number(
                document.getElementById("coup-commission")?.value || 0
            ),

        affiliateName:
            document
                .getElementById("coup-affiliate")
                ?.value
                .trim() || "Geral",

        active: true,
        updatedAt: serverTimestamp()
    };

    try {
        await setDoc(
            doc(db, "coupons", id),
            couponData,
            { merge: true }
        );

        alert(`Cupom ${code} salvo com sucesso.`);

        document.getElementById("form-coupon")?.reset();

        await loadCoupons();

    } catch (error) {
        console.error("Erro ao salvar cupom:", error);
        alert("Erro ao salvar o cupom.");
    }
}

async function loadCoupons() {
    const tbody = document.getElementById("admin-coupons-list");
    if (!tbody) return;

    try {
        const snapshot = await getDocs(
            collection(db, "coupons")
        );

        coupons = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        createCouponInterface();
        renderCoupons();

    } catch (error) {
        console.error("Erro ao carregar cupons:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="admin-empty admin-danger-text">
                    Erro ao carregar cupons.
                </td>
            </tr>
        `;
    }
}

function createCouponInterface() {
    createToolbar(
        "admin-coupons-list",
        "coupons-toolbar",
        `
            <input
                id="coupons-search"
                class="form-control"
                placeholder="Pesquisar cupom ou afiliado..."
                oninput="renderCoupons()"
            >

            <select
                id="coupons-status"
                class="form-select"
                style="max-width:180px"
                onchange="renderCoupons()"
            >
                <option value="">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
            </select>

            <button
                class="btn btn-outline-secondary"
                onclick="clearCouponFilters()"
            >
                <i class="fa fa-eraser me-1"></i>
                Limpar
            </button>
        `
    );

    createSummary("admin-coupons-list", "coupons-summary");

    const tbody = document.getElementById("admin-coupons-list");
    const table = tbody.closest("table");

    if (table) {
        table.classList.add("admin-table");

        const headers = table.querySelector("thead tr");

        if (headers) {
            headers.innerHTML = `
                <th>Código</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Afiliado</th>
                <th>Comissão</th>
                <th>Status</th>
                <th>Ações</th>
            `;
        }
    }
}

function clearCouponFilters() {
    const search = document.getElementById("coupons-search");
    const status = document.getElementById("coupons-status");

    if (search) search.value = "";
    if (status) status.value = "";

    renderCoupons();
}

function renderCoupons() {
    const tbody = document.getElementById("admin-coupons-list");
    if (!tbody) return;

    const search = normalize(
        document.getElementById("coupons-search")?.value
    );

    const status =
        document.getElementById("coupons-status")?.value || "";

    const filtered = coupons.filter(coupon => {
        const text = normalize(`
            ${coupon.code}
            ${coupon.affiliateName}
        `);

        if (search && !text.includes(search)) {
            return false;
        }

        if (status === "active" && !coupon.active) {
            return false;
        }

        if (status === "inactive" && coupon.active) {
            return false;
        }

        return true;
    });

    setSummary("coupons-summary", [
        {
            label: "Cupons",
            value: filtered.length
        },
        {
            label: "Ativos",
            value: filtered.filter(item => item.active).length
        },
        {
            label: "Inativos",
            value: filtered.filter(item => !item.active).length
        }
    ]);

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="admin-empty">
                    Nenhum cupom encontrado.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(coupon => `
        <tr>
            <td>
                <strong>${escapeHTML(coupon.code || coupon.id)}</strong>
            </td>

            <td>
                ${
                    coupon.type === "percent"
                        ? "Porcentagem"
                        : "Valor fixo"
                }
            </td>

            <td>
                ${
                    coupon.type === "percent"
                        ? `${Number(coupon.value || 0)}%`
                        : money(coupon.value)
                }
            </td>

            <td>
                ${escapeHTML(coupon.affiliateName || "Geral")}
            </td>

            <td>
                ${Number(coupon.commissionPercent || 0)}%
            </td>

            <td>
                <span
                    class="badge ${
                        coupon.active
                            ? "bg-success"
                            : "bg-secondary"
                    }"
                >
                    ${coupon.active ? "Ativo" : "Inativo"}
                </span>
            </td>

            <td>
                <div class="admin-actions">
                    <button
                        class="btn btn-sm btn-outline-primary"
                        onclick="editCoupon('${coupon.id}')"
                        title="Editar"
                    >
                        <i class="fa fa-edit"></i>
                    </button>

                    <button
                        class="btn btn-sm ${
                            coupon.active
                                ? "btn-outline-warning"
                                : "btn-outline-success"
                        }"
                        onclick="toggleCoupon('${coupon.id}')"
                        title="${
                            coupon.active
                                ? "Desativar"
                                : "Ativar"
                        }"
                    >
                        <i class="fa fa-power-off"></i>
                    </button>

                    <button
                        class="btn btn-sm btn-outline-danger"
                        onclick="deleteCoupon('${coupon.id}')"
                        title="Excluir"
                    >
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
}

function editCoupon(id) {
    const coupon = coupons.find(item => item.id === id);

    if (!coupon) return;

    showAdminModal(
        "Editar cupom",
        `
            <form id="edit-coupon-form">

                <div class="mb-3">
                    <label class="form-label">
                        Código
                    </label>

                    <input
                        id="edit-coupon-code"
                        class="form-control"
                        value="${escapeHTML(coupon.code || id)}"
                        required
                    >
                </div>

                <div class="mb-3">
                    <label class="form-label">
                        Tipo
                    </label>

                    <select
                        id="edit-coupon-type"
                        class="form-select"
                    >
                        <option
                            value="percent"
                            ${
                                coupon.type === "percent"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Porcentagem
                        </option>

                        <option
                            value="fixed"
                            ${
                                coupon.type === "fixed"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Valor fixo
                        </option>
                    </select>
                </div>

                <div class="mb-3">
                    <label class="form-label">
                        Valor
                    </label>

                    <input
                        id="edit-coupon-value"
                        type="number"
                        step="0.01"
                        class="form-control"
                        value="${Number(coupon.value || 0)}"
                    >
                </div>

                <div class="mb-3">
                    <label class="form-label">
                        Comissão %
                    </label>

                    <input
                        id="edit-coupon-commission"
                        type="number"
                        step="0.01"
                        class="form-control"
                        value="${Number(coupon.commissionPercent || 0)}"
                    >
                </div>

                <div class="mb-3">
                    <label class="form-label">
                        Afiliado
                    </label>

                    <input
                        id="edit-coupon-affiliate"
                        class="form-control"
                        value="${escapeHTML(coupon.affiliateName || "Geral")}"
                    >
                </div>

            </form>
        `,
        `
            <button
                class="btn btn-light"
                onclick="closeAdminModal()"
            >
                Cancelar
            </button>

            <button
                class="btn btn-primary"
                onclick="saveEditedCoupon('${id}')"
            >
                <i class="fa fa-save me-1"></i>
                Salvar
            </button>
        `
    );
}

async function saveEditedCoupon(oldId) {
    const code =
        document
            .getElementById("edit-coupon-code")
            ?.value
            .trim()
            .toUpperCase();

    if (!code) return;

    const newId = normalize(code);

    const data = {
        code,
        type:
            document.getElementById("edit-coupon-type")?.value ||
            "percent",

        value:
            Number(
                document.getElementById("edit-coupon-value")?.value || 0
            ),

        commissionPercent:
            Number(
                document.getElementById("edit-coupon-commission")?.value || 0
            ),

        affiliateName:
            document
                .getElementById("edit-coupon-affiliate")
                ?.value
                .trim() || "Geral",

        updatedAt: serverTimestamp()
    };

    try {
        if (oldId !== newId) {
            await setDoc(
                doc(db, "coupons", newId),
                {
                    ...data,
                    active: true
                }
            );

            await deleteDoc(doc(db, "coupons", oldId));
        } else {
            await updateDoc(
                doc(db, "coupons", oldId),
                data
            );
        }

        closeAdminModal();
        await loadCoupons();

    } catch (error) {
        console.error(error);
        alert("Erro ao atualizar o cupom.");
    }
}

async function toggleCoupon(id) {
    const coupon = coupons.find(item => item.id === id);

    if (!coupon) return;

    try {
        await updateDoc(
            doc(db, "coupons", id),
            {
                active: !coupon.active,
                updatedAt: serverTimestamp()
            }
        );

        coupon.active = !coupon.active;

        renderCoupons();

    } catch (error) {
        console.error(error);
        alert("Não foi possível alterar o status do cupom.");
    }
}

async function deleteCoupon(id) {
    const coupon = coupons.find(item => item.id === id);

    if (!coupon) return;

    if (
        !confirm(
            `Excluir o cupom ${coupon.code || id}?`
        )
    ) {
        return;
    }

    try {
        await deleteDoc(doc(db, "coupons", id));

        coupons = coupons.filter(
            item => item.id !== id
        );

        renderCoupons();

    } catch (error) {
        console.error(error);
        alert("Não foi possível excluir o cupom.");
    }
}

window.saveCoupon = saveCoupon;
window.renderCoupons = renderCoupons;
window.clearCouponFilters = clearCouponFilters;
window.editCoupon = editCoupon;
window.saveEditedCoupon = saveEditedCoupon;
window.toggleCoupon = toggleCoupon;
window.deleteCoupon = deleteCoupon;

/* =========================================================
   5. PRODUTOS / CSV
========================================================= */

async function loadProducts() {
    try {
        const response =
            await fetch("ecocsv - products1.csv");

        if (!response.ok) {
            throw new Error(
                "Erro ao carregar ecocsv - products1.csv"
            );
        }

        const csvText = await response.text();

        products = parseCSV(csvText);

        createProductInterface();
        renderProductsTable();

    } catch (error) {
        console.error(
            "Erro ao carregar produtos:",
            error
        );

        const tbody =
            document.getElementById("admin-products-list");

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="admin-empty admin-danger-text">
                        Erro ao carregar catálogo.
                        <br>
                        <small>
                            ${escapeHTML(error.message)}
                        </small>
                    </td>
                </tr>
            `;
        }
    }
}

function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && insideQuotes && next === '"') {
            field += '"';
            i++;
            continue;
        }

        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }

        if (char === "," && !insideQuotes) {
            row.push(field.trim());
            field = "";
            continue;
        }

        if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {
            if (char === "\r" && next === "\n") {
                i++;
            }

            row.push(field.trim());
            field = "";

            if (row.some(value => value !== "")) {
                rows.push(row);
            }

            row = [];
            continue;
        }

        field += char;
    }

    if (field || row.length) {
        row.push(field.trim());
        rows.push(row);
    }

    if (rows.length < 2) return [];

    const headers = rows[0].map(
        header => header.trim()
    );

    const indexOf = (...names) => {
        for (const name of names) {
            const index = headers.findIndex(
                header =>
                    normalize(header) ===
                    normalize(name)
            );

            if (index >= 0) return index;
        }

        return -1;
    };

    const get = (values, ...names) => {
        const index = indexOf(...names);

        return index >= 0
            ? values[index] || ""
            : "";
    };

    return rows.slice(1).map((values, index) => ({
        id: index,

        SKU:
            get(values, "SKU") ||
            `SKU-${index + 1}`,

        Produto:
            get(values, "Produto") ||
            "Sem nome",

        Peso:
            get(values, "Peso", "peso"),

        Preço:
            get(values, "Preço", "Preco") ||
            "0",

        Categoria:
            get(values, "Categoria") ||
            "Geral",

        Estoque:
            get(values, "Estoque") ||
            "0",

        Descrição:
            get(values, "Descrição", "Descricao"),

        Imagem:
            get(
                values,
                "Imagem",
                "URL",
                "URL da imagem",
                "link_foto_principal",
                "Link Foto Principal"
            )
    }));
}

function createProductInterface() {
    createToolbar(
        "admin-products-list",
        "products-toolbar",
        `
            <input
                id="products-search"
                class="form-control"
                placeholder="Pesquisar SKU ou produto..."
                oninput="renderProductsTable()"
            >

            <select
                id="products-stock-filter"
                class="form-select"
                style="max-width:180px"
                onchange="renderProductsTable()"
            >
                <option value="">Todos os estoques</option>
                <option value="available">Em estoque</option>
                <option value="zero">Sem estoque</option>
            </select>

            <button
                class="btn btn-outline-primary"
                onclick="exportCSV()"
            >
                <i class="fa fa-download me-1"></i>
                Exportar CSV
            </button>
        `
    );

    createSummary("admin-products-list", "products-summary");

    const tbody = document.getElementById("admin-products-list");
    const table = tbody.closest("table");

    if (table) {
        table.classList.add("admin-table");

        const headers = table.querySelector("thead tr");

        if (headers) {
            headers.innerHTML = `
                <th>Imagem</th>
                <th>SKU</th>
                <th>Produto</th>
                <th>Preço</th>
                <th>Estoque</th>
                <th>URL da imagem</th>
                <th>Ações</th>
            `;
        }
    }
}

function renderProductsTable() {
    const tbody =
        document.getElementById("admin-products-list");

    if (!tbody) return;

    const search = normalize(
        document.getElementById("products-search")?.value
    );

    const stockFilter =
        document.getElementById("products-stock-filter")?.value ||
        "";

    const filtered = products.filter(product => {
        const text = normalize(`
            ${product.SKU}
            ${product.Produto}
            ${product.Categoria}
        `);

        if (search && !text.includes(search)) {
            return false;
        }

        const stock = Number(product.Estoque || 0);

        if (stockFilter === "available" && stock <= 0) {
            return false;
        }

        if (stockFilter === "zero" && stock > 0) {
            return false;
        }

        return true;
    });

    const stockTotal = filtered.reduce(
        (sum, product) =>
            sum + Number(product.Estoque || 0),
        0
    );

    const catalogValue = filtered.reduce(
        (sum, product) =>
            sum +
            normalizePrice(product.Preço) *
                Number(product.Estoque || 0),
        0
    );

    setSummary("products-summary", [
        {
            label: "Produtos",
            value: filtered.length
        },
        {
            label: "Unidades em estoque",
            value: stockTotal
        },
        {
            label: "Sem estoque",
            value: filtered.filter(
                product =>
                    Number(product.Estoque || 0) <= 0
            ).length
        },
        {
            label: "Valor do estoque",
            value: money(catalogValue)
        }
    ]);

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="admin-empty">
                    Nenhum produto encontrado.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(product => {
        const originalIndex =
            products.findIndex(
                item => item.id === product.id
            );

        const image =
            product.Imagem ||
            "img/products/default.jpg";

        return `
            <tr>

                <td>
                    <img
                        src="${escapeHTML(image)}"
                        class="admin-thumb"
                        alt="${escapeHTML(product.Produto)}"
                        onerror="
                            this.onerror=null;
                            this.src='img/products/default.jpg';
                        "
                    >
                </td>

                <td>
                    <strong>
                        ${escapeHTML(product.SKU)}
                    </strong>
                </td>

                <td>
                    <strong>
                        ${escapeHTML(product.Produto)}
                    </strong>

                    <br>

                    <small class="text-muted">
                        ${escapeHTML(product.Categoria)}
                    </small>
                </td>

                <td>
                    <input
                        type="text"
                        class="form-control form-control-sm"
                        value="${escapeHTML(product.Preço)}"
                        onchange="
                            updateProductField(
                                ${originalIndex},
                                'Preço',
                                this.value
                            )
                        "
                    >
                </td>

                <td>
                    <input
                        type="number"
                        min="0"
                        class="form-control form-control-sm"
                        value="${Number(product.Estoque || 0)}"
                        onchange="
                            updateProductField(
                                ${originalIndex},
                                'Estoque',
                                this.value
                            )
                        "
                    >
                </td>

                <td>
                    <input
                        type="url"
                        class="form-control form-control-sm admin-image-url"
                        value="${escapeHTML(product.Imagem || "")}"
                        placeholder="https://..."
                        onchange="
                            updateProductField(
                                ${originalIndex},
                                'Imagem',
                                this.value
                            )
                        "
                    >
                </td>

                <td>
                    <div class="admin-actions">

                        <button
                            class="btn btn-sm btn-outline-success"
                            onclick="
                                updateProductField(
                                    ${originalIndex},
                                    'Imagem',
                                    prompt(
                                        'URL da imagem:',
                                        '${escapeHTML(product.Imagem || "")}'
                                    ) || ''
                                );
                                renderProductsTable();
                            "
                            title="Alterar URL"
                        >
                            <i class="fa fa-image"></i>
                        </button>

                        <button
                            class="btn btn-sm btn-outline-danger"
                            onclick="deleteProduct(${originalIndex})"
                            title="Remover"
                        >
                            <i class="fa fa-trash"></i>
                        </button>

                    </div>
                </td>

            </tr>
        `;
    }).join("");
}

function updateProductField(index, field, value) {
    if (!products[index]) return;

    products[index][field] = value;

    if (field === "Imagem") {
        renderProductsTable();
    }
}

function deleteProduct(index) {
    if (!products[index]) return;

    if (
        !confirm(
            `Remover "${products[index].Produto}" do catálogo carregado?`
        )
    ) {
        return;
    }

    products.splice(index, 1);

    renderProductsTable();
}

function saveProduct(event) {
    event.preventDefault();

    const product = {
        id: products.length,

        SKU:
            document.getElementById("prod-sku")?.value.trim() ||
            `SKU-${products.length + 1}`,

        Produto:
            document.getElementById("prod-name")?.value.trim() ||
            "Sem nome",

        Peso:
            document.getElementById("prod-weight")?.value.trim() ||
            "",

        Preço:
            document.getElementById("prod-price")?.value.trim() ||
            "0",

        Categoria:
            document.getElementById("prod-category")?.value.trim() ||
            "Geral",

        Estoque:
            document.getElementById("prod-stock")?.value.trim() ||
            "0",

        Descrição:
            document.getElementById("prod-desc")?.value.trim() ||
            "",

        Imagem:
            document.getElementById("prod-image")?.value.trim() ||
            ""
    };

    products.push(product);

    renderProductsTable();

    document.getElementById("form-product")?.reset();

    alert(
        "Produto adicionado ao catálogo em memória. " +
        "Use Exportar CSV para salvar as alterações."
    );
}

function exportCSV() {
    if (!products.length) {
        alert("Não há produtos para exportar.");
        return;
    }

    const headers = [
        "Produto",
        "peso",
        "Preço",
        "Categoria",
        "Estoque",
        "Descrição",
        "SKU",
        "Imagem"
    ];

    const rows = [
        headers.join(","),
        ...products.map(product =>
            headers
                .map(header =>
                    `"${String(
                        product[header] ?? ""
                    ).replace(/"/g, '""')}"`
                )
                .join(",")
        )
    ];

    const blob = new Blob(
        ["\ufeff" + rows.join("\n")],
        {
            type: "text/csv;charset=utf-8;"
        }
    );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;
    link.download =
        "ecocsv - products1-atualizado.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

window.saveProduct = saveProduct;
window.updateProductField = updateProductField;
window.deleteProduct = deleteProduct;
window.exportCSV = exportCSV;
window.renderProductsTable = renderProductsTable;

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    injectAdminStyles();

    await Promise.all([
        loadOrders(),
        loadCustomers(),
        loadCoupons(),
        loadCommissions(),
        loadProducts()
    ]);
});
