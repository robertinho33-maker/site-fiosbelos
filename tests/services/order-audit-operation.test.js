/**
 * Testes de Auditoria Operacional de Pedidos — V1
 *
 * Valida que as operações do Order Service:
 * - criam o evento de auditoria correto;
 * - enviam a alteração ao Repository;
 * - preservam a rastreabilidade;
 *
 * Não acessa Firebase.
 */

import assert from "node:assert/strict";

import {
    createOrderOperation,
    changeOrderStatus,
    changeOrderPaymentStatus,
    changeOrderFulfillmentStatus
} from "../../js/services/order-service.js";

import {
    PAYMENT_STATUS,
    FULFILLMENT_STATUS
} from "../../js/contracts/order-status.js";


// =========================================================
// REPOSITORY FAKE
// =========================================================

function createFakeRepository(initialOrder) {

    let order = {
        ...initialOrder
    };

    const calls = [];

    return {
        calls,

        async getOrder(id) {

            calls.push({
                operation: "getOrder",
                id
            });

            if (id !== order.id) {
                return null;
            }

            return {
                ...order
            };
        },

        async createOrderWithAudit(
            orderData,
            auditEvent
        ) {

            calls.push({
                operation: "createOrderWithAudit",
                orderData,
                auditEvent
            });

            order = {
                ...orderData
            };

            return {
                order: {
                    ...order
                },

                audit: {
                    id: "audit-create-001",
                    ...auditEvent
                }
            };
        },

        async updateOrderWithAudit(
            id,
            changes,
            auditEvent
        ) {

            calls.push({
                operation: "updateOrderWithAudit",
                id,
                changes,
                auditEvent
            });

            order = {
                ...order,
                ...changes
            };

            return {
                order: {
                    ...order
                },

                audit: {
                    id: "audit-update-001",
                    ...auditEvent
                }
            };
        }
    };
}


// =========================================================
// PEDIDO BASE
// =========================================================

function createOrder(overrides = {}) {

    return {
        id: "order-001",
        orderNumber: "PED-001",

        status: "Pendente",

        paymentStatus:
            PAYMENT_STATUS.PENDENTE,

        fulfillmentStatus:
            FULFILLMENT_STATUS.PENDENTE,

        schemaVersion: 1,

        items: [
            {
                id: "product-001",
                name: "Produto Teste",
                quantity: 1,
                price: 100,
                total: 100
            }
        ],

        totals: {
            subtotal: 100,
            discount: 0,
            total: 100
        },

        ...overrides
    };
}


// =========================================================
// CREATE ORDER
// =========================================================

{
    const repository =
        createFakeRepository(
            createOrder()
        );

    const result =
        await createOrderOperation({
            order: createOrder(),
            actorId: "user-001",
            actorName: "Administrador",
            reason: "Criação do pedido",
            repository
        });

    assert.equal(
        repository.calls.length,
        1
    );

    assert.equal(
        repository.calls[0].operation,
        "createOrderWithAudit"
    );

    assert.equal(
        result.audit.type,
        "ORDER_CREATED"
    );

    assert.equal(
        result.audit.orderId,
        "PED-001"
    );

    assert.equal(
        result.audit.actor.id,
        "user-001"
    );

    assert.equal(
        result.audit.actor.name,
        "Administrador"
    );

    assert.equal(
        result.audit.reason,
        "Criação do pedido"
    );
}


// =========================================================
// STATUS
// =========================================================

{
    const repository =
        createFakeRepository(
            createOrder()
        );

    const result =
        await changeOrderStatus({
            orderId: "order-001",
            nextStatus: "Confirmado",
            actorId: "user-002",
            actorName: "Operador",
            reason: "Pedido iniciado",
            repository
        });

    const auditCall =
        repository.calls.find(
            call =>
                call.operation ===
                "updateOrderWithAudit"
        );

    assert.ok(auditCall);

    assert.equal(
        auditCall.auditEvent.type,
        "ORDER_STATUS_CHANGED"
    );

    assert.equal(
        auditCall.auditEvent.orderId,
        "PED-001"
    );

    assert.equal(
        auditCall.auditEvent.actor.id,
        "user-002"
    );

    assert.equal(
        auditCall.auditEvent.change.from,
        "Pendente"
    );

    assert.equal(
        auditCall.auditEvent.change.to,
        "Confirmado"
    );

    assert.equal(
        result.order.status,
        "Confirmado"
    );
}


// =========================================================
// PAYMENT
// =========================================================

{
    const repository =
        createFakeRepository(
            createOrder()
        );

    const result =
        await changeOrderPaymentStatus({
            orderId: "order-001",
            nextStatus:
                PAYMENT_STATUS.PAGO,
            actorId: "user-003",
            actorName: "Caixa",
            reason: "Pagamento confirmado",
            repository
        });

    const auditCall =
        repository.calls.find(
            call =>
                call.operation ===
                "updateOrderWithAudit"
        );

    assert.ok(auditCall);

    assert.equal(
        auditCall.auditEvent.type,
        "ORDER_PAYMENT_CHANGED"
    );

    assert.equal(
        auditCall.auditEvent.orderId,
        "PED-001"
    );

    assert.equal(
        auditCall.auditEvent.actor.id,
        "user-003"
    );

    assert.equal(
        auditCall.auditEvent.change.from,
        PAYMENT_STATUS.PENDENTE
    );

    assert.equal(
        auditCall.auditEvent.change.to,
        PAYMENT_STATUS.PAGO
    );

    assert.equal(
        result.order.paymentStatus,
        PAYMENT_STATUS.PAGO
    );
}


// =========================================================
// FULFILLMENT
// =========================================================

{
    const repository =
        createFakeRepository(
            createOrder()
        );

    const result =
        await changeOrderFulfillmentStatus({
            orderId: "order-001",
            nextStatus:
                FULFILLMENT_STATUS.PREPARANDO,
            actorId: "user-004",
            actorName: "Expedição",
            reason: "Separação iniciada",
            repository
        });

    const auditCall =
        repository.calls.find(
            call =>
                call.operation ===
                "updateOrderWithAudit"
        );

    assert.ok(auditCall);

    assert.equal(
        auditCall.auditEvent.type,
        "ORDER_FULFILLMENT_CHANGED"
    );

    assert.equal(
        auditCall.auditEvent.orderId,
        "PED-001"
    );

    assert.equal(
        auditCall.auditEvent.actor.id,
        "user-004"
    );

    assert.equal(
        auditCall.auditEvent.change.from,
        FULFILLMENT_STATUS.PENDENTE
    );

    assert.equal(
        auditCall.auditEvent.change.to,
        FULFILLMENT_STATUS.PREPARANDO
    );

    assert.equal(
        result.order.fulfillmentStatus,
        FULFILLMENT_STATUS.PREPARANDO
    );
}


// =========================================================
// RESULTADO
// =========================================================

console.log(
    "TODOS OS TESTES DE AUDITORIA OPERACIONAL PASSARAM."
);
