/**
 * Testes do Order Service — V1
 *
 * Testa a camada de orquestração do núcleo de vendas.
 *
 * Não acessa Firestore diretamente.
 */

import assert from "node:assert/strict";

import {
    validateOrder,
    validateStatusTransition
} from "../../js/services/order-service.js";

import {
    ORDER_STATUS
} from "../../js/contracts/order-status.js";


// =========================================================
// PEDIDO BASE
// =========================================================

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
        status: "Pendente"
    },

    fulfillment: {
        status: "Pendente"
    },

    status: ORDER_STATUS.PENDENTE
};


// =========================================================
// TESTE 1 — PEDIDO VÁLIDO
// =========================================================

const validResult = validateOrder(validOrder);

assert.equal(
    validResult.valid,
    true,
    "Pedido válido deveria passar."
);


// =========================================================
// TESTE 2 — PEDIDO INVÁLIDO
// =========================================================

const invalidOrder = {
    ...validOrder,

    totals: {
        subtotal: 999,
        discount: 20,
        total: 979
    }
};

const invalidResult = validateOrder(
    invalidOrder
);

assert.equal(
    invalidResult.valid,
    false,
    "Pedido financeiramente inconsistente deveria ser rejeitado."
);


// =========================================================
// TESTE 3 — TRANSIÇÃO VÁLIDA
// =========================================================

assert.equal(
    validateStatusTransition(
        ORDER_STATUS.PENDENTE,
        ORDER_STATUS.CONFIRMADO
    ),
    true,
    "Transição Pendente → Confirmado deveria ser válida."
);


// =========================================================
// TESTE 4 — TRANSIÇÃO INVÁLIDA
// =========================================================

assert.equal(
    validateStatusTransition(
        ORDER_STATUS.PENDENTE,
        ORDER_STATUS.CONCLUIDO
    ),
    false,
    "Transição Pendente → Concluído deveria ser inválida."
);


// =========================================================
// RESULTADO
// =========================================================

console.log(
    "TODOS OS TESTES DO ORDER SERVICE PASSARAM."
);
