/**
 * Testes da operação de mudança de status.
 *
 * O teste usa um Repository falso.
 * Nenhum acesso ao Firebase.
 */

import assert from "node:assert/strict";

import {
    changeOrderStatus
} from "../../js/services/order-service.js";

import {
    ORDER_STATUS
} from "../../js/contracts/order-status.js";


const validOrder = {
    schemaVersion: "1.0",

    orderNumber: "PED-0001",

    customerId: "customer-001",

    customer: {
        name: "Cliente Teste",
        phone: "11999999999",
        address: {
            street: "Rua Teste",
            number: "100",
            neighborhood: "Centro",
            city: "São Paulo"
        }
    },

    items: [
        {
            id: "prod-001",
            name: "Produto Teste",
            price: 100,
            quantity: 1,
            total: 100
        }
    ],

    totals: {
        subtotal: 100,
        discount: 0,
        total: 100
    },

    payment: {
        method: "PIX",
        status: "Pendente"
    },

    fulfillment: {
        method: "delivery",
        status: "Pendente"
    },

    status: ORDER_STATUS.PENDENTE
};


// =========================================================
// REPOSITORY FALSO
// =========================================================

let storedOrder = {
    ...validOrder
};

let lastUpdate = null;

const fakeRepository = {

    async getOrder(orderId) {

        if (orderId !== "firestore-id-001") {
            return null;
        }

        return {
            id: orderId,
            ...storedOrder
        };
    },

    async updateOrderWithAudit(
        orderId,
        changes,
        auditEvent
    ) {

        lastUpdate = {
            orderId,
            changes,
            auditEvent
        };

        storedOrder = {
            ...storedOrder,
            ...changes
        };

        return {
            order: {
                id: orderId,
                ...storedOrder
            },

            audit: {
                id: "audit-001",
                ...auditEvent
            }
        };
    }
};


// =========================================================
// TESTE 1 — TRANSIÇÃO VÁLIDA
// =========================================================

const result =
    await changeOrderStatus({
        orderId: "firestore-id-001",

        nextStatus:
            ORDER_STATUS.CONFIRMADO,

        actorId: "user-001",

        actorName: "Administrador",

        reason:
            "Pagamento confirmado",

        repository:
            fakeRepository
    });


assert.equal(
    result.order.status,
    ORDER_STATUS.CONFIRMADO
);

assert.equal(
    lastUpdate.orderId,
    "firestore-id-001"
);

assert.equal(
    lastUpdate.changes.status,
    ORDER_STATUS.CONFIRMADO
);

assert.equal(
    lastUpdate.auditEvent.type,
    "ORDER_STATUS_CHANGED"
);

assert.equal(
    lastUpdate.auditEvent.change.from,
    ORDER_STATUS.PENDENTE
);

assert.equal(
    lastUpdate.auditEvent.change.to,
    ORDER_STATUS.CONFIRMADO
);


// =========================================================
// TESTE 2 — PEDIDO INEXISTENTE
// =========================================================

await assert.rejects(
    () =>
        changeOrderStatus({
            orderId: "pedido-inexistente",

            nextStatus:
                ORDER_STATUS.CONFIRMADO,

            repository:
                fakeRepository
        }),

    /Pedido não encontrado/
);


// =========================================================
// TESTE 3 — TRANSIÇÃO INVÁLIDA
// =========================================================

storedOrder = {
    ...validOrder,
    status: ORDER_STATUS.PENDENTE
};

await assert.rejects(
    () =>
        changeOrderStatus({
            orderId: "firestore-id-001",

            nextStatus:
                ORDER_STATUS.CONCLUIDO,

            repository:
                fakeRepository
        }),

    /Transição de status inválida/
);


// =========================================================
// TESTE 4 — AUDITORIA
// =========================================================

storedOrder = {
    ...validOrder
};

lastUpdate = null;

await changeOrderStatus({
    orderId: "firestore-id-001",

    nextStatus:
        ORDER_STATUS.CONFIRMADO,

    actorId: "user-002",

    actorName: "Operador",

    reason: "Teste de auditoria",

    repository:
        fakeRepository
});

assert.ok(
    lastUpdate.auditEvent.createdAt
);

assert.equal(
    lastUpdate.auditEvent.actor.id,
    "user-002"
);

assert.equal(
    lastUpdate.auditEvent.actor.name,
    "Operador"
);

assert.equal(
    lastUpdate.auditEvent.reason,
    "Teste de auditoria"
);


console.log(
    "TODOS OS TESTES DE OPERAÇÃO DE STATUS PASSARAM."
);
