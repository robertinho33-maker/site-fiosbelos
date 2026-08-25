/**
 * Testes da operação de fulfillment — V1
 */

import assert from "node:assert/strict";

import {
    validateFulfillmentTransition
} from "../../js/services/order-service.js";

import {
    FULFILLMENT_STATUS
} from "../../js/contracts/order-status.js";


// =========================================================
// TRANSIÇÕES PERMITIDAS
// =========================================================

assert.equal(
    validateFulfillmentTransition(
        FULFILLMENT_STATUS.PENDENTE,
        FULFILLMENT_STATUS.PREPARANDO
    ),
    true
);

assert.equal(
    validateFulfillmentTransition(
        FULFILLMENT_STATUS.PREPARANDO,
        FULFILLMENT_STATUS.ENVIADO
    ),
    true
);

assert.equal(
    validateFulfillmentTransition(
        FULFILLMENT_STATUS.ENVIADO,
        FULFILLMENT_STATUS.ENTREGUE
    ),
    true
);


// =========================================================
// TRANSIÇÕES PROIBIDAS
// =========================================================

assert.equal(
    validateFulfillmentTransition(
        FULFILLMENT_STATUS.PENDENTE,
        FULFILLMENT_STATUS.ENVIADO
    ),
    false
);

assert.equal(
    validateFulfillmentTransition(
        FULFILLMENT_STATUS.PREPARANDO,
        FULFILLMENT_STATUS.ENTREGUE
    ),
    false
);

assert.equal(
    validateFulfillmentTransition(
        FULFILLMENT_STATUS.ENTREGUE,
        FULFILLMENT_STATUS.PREPARANDO
    ),
    false
);


console.log(
    "TODOS OS TESTES DE OPERAÇÃO DE FULFILLMENT PASSARAM."
);
