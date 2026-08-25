/**
 * Testes da operação de pagamento — V1
 *
 * O Service deve:
 * - buscar o pedido;
 * - validar integridade;
 * - validar transição financeira;
 * - criar auditoria;
 * - persistir através do Repository.
 */

import assert from "node:assert/strict";

import {
    changeOrderPaymentStatus
} from "../../js/services/order-service.js";

import {
    ORDER_STATUS,
    PAYMENT_STATUS
} from "../../js/contracts/order-status.js";


const validOrder = {
    id: "order-test-001",
    orderNumber: "PED-001",
    schemaVersion: "1.0",

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
            quantity: 2,
            total: 200
        }
    ],

    totals: {
        subtotal: 200,
        discount: 20,
        total: 180
    },

    payment: {
        method: "pix",
        status: PAYMENT_STATUS.PENDENTE
    },

    fulfillment: {
        status: "Pendente"
    },

    status: ORDER_STATUS.CONFIRMADO,
    paymentStatus: PAYMENT_STATUS.PENDENTE
};


function createRepository(order = validOrder) {
    const calls = [];

    return {
        calls,

        async getOrder(orderId) {
            calls.push({
                operation: "getOrder",
                orderId
            });

            return order;
        },

        async updateOrderWithAudit(
            orderId,
            changes,
            auditEvent
        ) {
            calls.push({
                operation: "updateOrderWithAudit",
                orderId,
                changes,
                auditEvent
            });

            return {
                order: {
                    ...order,
                    ...changes,
                    paymentStatus:
                        changes.paymentStatus ||
                        order.paymentStatus
                },
                audit: {
                    id: "audit-test-001",
                    ...auditEvent
                }
            };
        }
    };
}


// =========================================================
// PENDENTE → PAGO
// =========================================================

{
    const repository = createRepository();

    const result =
        await changeOrderPaymentStatus({
            orderId: "order-test-001",
            nextStatus: PAYMENT_STATUS.PAGO,
            actorName: "Painel Administrativo",
            reason: "Pagamento confirmado.",
            repository
        });

    assert.equal(
        result.order.paymentStatus,
        PAYMENT_STATUS.PAGO
    );

    assert.equal(
        repository.calls.length,
        2
    );

    assert.equal(
        repository.calls[1].changes.paymentStatus,
        PAYMENT_STATUS.PAGO
    );

    assert.equal(
        repository.calls[1].auditEvent.type,
        "ORDER_PAYMENT_CHANGED"
    );
}


// =========================================================
// TRANSIÇÃO INVÁLIDA
// =========================================================

{
    const repository =
        createRepository({
            ...validOrder,
            paymentStatus: PAYMENT_STATUS.PAGO
        });

    await assert.rejects(
        () =>
            changeOrderPaymentStatus({
                orderId: "order-test-001",
                nextStatus: PAYMENT_STATUS.PENDENTE,
                repository
            }),
        /Transição de pagamento inválida/
    );
}


// =========================================================
// PEDIDO INEXISTENTE
// =========================================================

{
    const repository = createRepository(null);

    await assert.rejects(
        () =>
            changeOrderPaymentStatus({
                orderId: "order-inexistente",
                nextStatus: PAYMENT_STATUS.PAGO,
                repository
            }),
        /Pedido não encontrado/
    );
}


console.log(
    "TODOS OS TESTES DE OPERAÇÃO DE PAGAMENTO PASSARAM."
);
