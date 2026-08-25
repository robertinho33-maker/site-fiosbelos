/**
 * Testes da operação financeira do pedido — V1
 */

import assert from "node:assert/strict";

import {
    validatePaymentTransition
} from "../../js/services/order-service.js";

import {
    PAYMENT_STATUS
} from "../../js/contracts/order-status.js";


// =========================================================
// TRANSIÇÕES PERMITIDAS
// =========================================================

assert.equal(
    validatePaymentTransition(
        PAYMENT_STATUS.PENDENTE,
        PAYMENT_STATUS.PAGO
    ),
    true
);

assert.equal(
    validatePaymentTransition(
        PAYMENT_STATUS.PENDENTE,
        PAYMENT_STATUS.RECUSADO
    ),
    true
);

assert.equal(
    validatePaymentTransition(
        PAYMENT_STATUS.PENDENTE,
        PAYMENT_STATUS.CANCELADO
    ),
    true
);

assert.equal(
    validatePaymentTransition(
        PAYMENT_STATUS.RECUSADO,
        PAYMENT_STATUS.PENDENTE
    ),
    true
);

assert.equal(
    validatePaymentTransition(
        PAYMENT_STATUS.RECUSADO,
        PAYMENT_STATUS.CANCELADO
    ),
    true
);


// =========================================================
// TRANSIÇÕES PROIBIDAS
// =========================================================

assert.equal(
    validatePaymentTransition(
        PAYMENT_STATUS.PAGO,
        PAYMENT_STATUS.PENDENTE
    ),
    false
);

assert.equal(
    validatePaymentTransition(
        PAYMENT_STATUS.PAGO,
        PAYMENT_STATUS.RECUSADO
    ),
    false
);

assert.equal(
    validatePaymentTransition(
        PAYMENT_STATUS.CANCELADO,
        PAYMENT_STATUS.PENDENTE
    ),
    false
);

assert.equal(
    validatePaymentTransition(
        PAYMENT_STATUS.CANCELADO,
        PAYMENT_STATUS.PAGO
    ),
    false
);


console.log(
    "TODOS OS TESTES DE OPERAÇÃO FINANCEIRA PASSARAM."
);
