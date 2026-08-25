/**
 * Testes do ciclo de vida operacional da venda — V1
 *
 * Fluxo:
 *
 * Pendente
 *    ↓
 * Confirmado
 *    ↓
 * Em processamento
 *    ↓
 * Concluido
 */

import assert from "node:assert/strict";

import {
    validateStatusTransition
} from "../../js/services/order-service.js";

import {
    ORDER_STATUS
} from "../../js/contracts/order-status.js";


// =========================================================
// PENDENTE → CONFIRMADO
// =========================================================

assert.equal(
    validateStatusTransition(
        ORDER_STATUS.PENDENTE,
        ORDER_STATUS.CONFIRMADO
    ),
    true
);


// =========================================================
// CONFIRMADO → EM PROCESSAMENTO
// =========================================================

assert.equal(
    validateStatusTransition(
        ORDER_STATUS.CONFIRMADO,
        ORDER_STATUS.EM_PROCESSAMENTO
    ),
    true
);


// =========================================================
// EM PROCESSAMENTO → CONCLUIDO
// =========================================================

assert.equal(
    validateStatusTransition(
        ORDER_STATUS.EM_PROCESSAMENTO,
        ORDER_STATUS.CONCLUIDO
    ),
    true
);


// =========================================================
// FLUXOS INVÁLIDOS
// =========================================================

assert.equal(
    validateStatusTransition(
        ORDER_STATUS.PENDENTE,
        ORDER_STATUS.CONCLUIDO
    ),
    false
);

assert.equal(
    validateStatusTransition(
        ORDER_STATUS.CONCLUIDO,
        ORDER_STATUS.EM_PROCESSAMENTO
    ),
    false
);

assert.equal(
    validateStatusTransition(
        ORDER_STATUS.CONCLUIDO,
        ORDER_STATUS.PENDENTE
    ),
    false
);


// =========================================================
// RESULTADO
// =========================================================

console.log(
    "TODOS OS TESTES DO CICLO DE VIDA DA VENDA PASSARAM."
);
