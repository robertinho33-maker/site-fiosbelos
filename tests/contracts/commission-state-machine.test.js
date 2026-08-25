/**
 * Testes da máquina de estados de comissão — V1
 */

import assert from "node:assert/strict";

import {
    canTransitionCommissionStatus
} from "../../js/contracts/order-transitions.js";

import {
    COMMISSION_STATUS
} from "../../js/contracts/order-status.js";


// =========================================================
// TRANSIÇÕES PERMITIDAS
// =========================================================

assert.equal(
    canTransitionCommissionStatus(
        COMMISSION_STATUS.PENDENTE,
        COMMISSION_STATUS.LIBERADA
    ),
    true
);

assert.equal(
    canTransitionCommissionStatus(
        COMMISSION_STATUS.PENDENTE,
        COMMISSION_STATUS.CANCELADA
    ),
    true
);

assert.equal(
    canTransitionCommissionStatus(
        COMMISSION_STATUS.LIBERADA,
        COMMISSION_STATUS.PAGA
    ),
    true
);

assert.equal(
    canTransitionCommissionStatus(
        COMMISSION_STATUS.LIBERADA,
        COMMISSION_STATUS.CANCELADA
    ),
    true
);


// =========================================================
// TRANSIÇÕES PROIBIDAS
// =========================================================

assert.equal(
    canTransitionCommissionStatus(
        COMMISSION_STATUS.PAGA,
        COMMISSION_STATUS.PENDENTE
    ),
    false
);

assert.equal(
    canTransitionCommissionStatus(
        COMMISSION_STATUS.PAGA,
        COMMISSION_STATUS.CANCELADA
    ),
    false
);

assert.equal(
    canTransitionCommissionStatus(
        COMMISSION_STATUS.CANCELADA,
        COMMISSION_STATUS.PENDENTE
    ),
    false
);

assert.equal(
    canTransitionCommissionStatus(
        COMMISSION_STATUS.CANCELADA,
        COMMISSION_STATUS.PAGA
    ),
    false
);

assert.equal(
    canTransitionCommissionStatus(
        COMMISSION_STATUS.NAO_APLICAVEL,
        COMMISSION_STATUS.PENDENTE
    ),
    false
);


// =========================================================
// RESULTADO
// =========================================================

console.log(
    "TODOS OS TESTES DA MÁQUINA DE ESTADOS DE COMISSÃO PASSARAM."
);
