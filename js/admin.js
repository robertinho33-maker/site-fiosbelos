// Importações necessárias do Firestore
import { 
  collection, query, orderBy, limit, startAfter, getDocs, where,
  doc, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Inicialização do Firestore (assumindo que o app já foi inicializado em outro arquivo)
const db = getFirestore();

// Variáveis globais
let rawOrders = [], rawCustomers = [], rawCoupons = [], rawCommissions = [], rawProducts = [];
const PAGE_SIZE = 20;
let lastVisibleOrder = null;

// ==========================================
// 1. ORDERS
// ==========================================
async function loadOrdersNextPage(isInitial = false) {
  const tbody = document.getElementById('admin-orders-list');
  if (!tbody) return;

  try {
    const selectedStatus = document.getElementById('filter-order-status')?.value || "";
    let constraints = [collection(db, "orders")];

    if (selectedStatus) constraints.push(where("status", "==", selectedStatus));
    constraints.push(orderBy("createdAt", "desc"));

    if (!isInitial && lastVisibleOrder) constraints.push(startAfter(lastVisibleOrder));
    constraints.push(limit(PAGE_SIZE));

    const q = query(...constraints);
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      tbody.innerHTML = isInitial
        ? `<tr><td colspan="6" class="text-center py-4 text-muted">Nenhum pedido encontrado.</td></tr>`
        : alert("Você já está na última página.");
      return;
    }

    lastVisibleOrder = querySnapshot.docs[querySnapshot.docs.length - 1];
    rawOrders = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    renderOrdersTable(rawOrders);
  } catch (err) {
    console.error("Erro ao carregar pedidos paginados:", err);
  }
}

async function loadOrders() {
  const tbody = document.getElementById('admin-orders-list');
  if (!tbody) return;

  try {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    rawOrders = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    filterOrders();
  } catch (err) {
    console.error("Erro ao carregar pedidos:", err);
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erro ao carregar pedidos.</td></tr>`;
  }
}

function filterOrders() {
  const tbody = document.getElementById('admin-orders-list');
  if (!tbody) return;

  const search = document.getElementById('filter-order-search')?.value.toLowerCase() || "";
  const status = document.getElementById('filter-order-status')?.value || "";
  const sort = document.getElementById('filter-order-sort')?.value || "newest";

  let filtered = rawOrders.filter(o => {
    const matchesSearch = (o.customerName || "").toLowerCase().includes(search) || o.id.toLowerCase().includes(search);
    const matchesStatus = status === "" || o.status === status;
    return matchesSearch && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sort === "highest") return (b.totalAmount || 0) - (a.totalAmount || 0);
    if (sort === "lowest") return (a.totalAmount || 0) - (b.totalAmount || 0);
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
    return sort === "oldest" ? dateA - dateB : dateB - dateA;
  });

  tbody.innerHTML = filtered.length === 0
    ? `<tr><td colspan="6" class="text-center text-muted py-4">Nenhum pedido encontrado.</td></tr>`
    : filtered.map(order => {
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
// 2. CUSTOMERS
// ==========================================
async function loadCustomers() {
  try {
    const querySnapshot = await getDocs(collection(db, "customers"));
    rawCustomers = querySnapshot.docs.map(docSnap => docSnap.data());
    filterCustomers();
  } catch (err) {
    console.error("Erro ao carregar clientes:", err);
  }
}

function filterCustomers() {
  const tbody = document.getElementById('admin-customers-list');
  if (!tbody) return;

  const search = document.getElementById('filter-customer-search')?.value.toLowerCase() || "";
  const filtered = rawCustomers.filter(c =>
    (c.name || "").toLowerCase().includes(search) ||
    (c.email || "").toLowerCase().includes(search) ||
    (c.city || "").toLowerCase().includes(search)
  );

  tbody.innerHTML = filtered.length === 0
    ? `<tr><td colspan="5" class="text-center py-4 text-muted">Nenhum cliente encontrado.</td></tr>`
    : filtered.map(c => {
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
// 3. COUPONS
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
    rawCoupons = querySnapshot.docs.map(docSnap => docSnap.data());
    filterCoupons();
  } catch (err) {
    console.error("Erro ao carregar cupons:", err);
  }
}

function filterCoupons() {
  const tbody = document.getElementById('admin-coupons-list');
  if (!tbody) return;

  const search = document.getElementById('filter-coupon-search')?.value.toLowerCase() || "";
  const status = document.getElement
