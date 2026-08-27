/**
 * Contrato de Transições Operacionais — Pedido V1
 *
 * Responsabilidade:
 * - definir quais mudanças de estado são permitidas;
 * - centralizar as regras de transição;
 * - não executar operações;
 * - não alterar Firestore;
 * - não alterar pedidos.
 *
 * Este arquivo é a ÚNICA autoridade sobre transições.
 */

import {
    ORDER_STATUS,
    PAYMENT_STATUS,
    FULFILLMENT_STATUS,
    COMMISSION_STATUS
} from "./order-status.js";


// =========================================================
// TRANSIÇÕES DO PEDIDO
// =========================================================

const ALLOWED_ORDER_TRANSITIONS = Object.freeze({

    [ORDER_STATUS.PENDENTE]: [
        ORDER_STATUS.CONFIRMADO,
        ORDER_STATUS.CANCELADO
    ],

    [ORDER_STATUS.CONFIRMADO]: [
        ORDER_STATUS.EM_PROCESSAMENTO,
        ORDER_STATUS.CANCELADO
    ],

    [ORDER_STATUS.EM_PROCESSAMENTO]: [
        ORDER_STATUS.CONCLUIDO,
        ORDER_STATUS.CANCELADO
    ],

    [ORDER_STATUS.CONCLUIDO]: [],

    [ORDER_STATUS.CANCELADO]: []
});


// =========================================================
// TRANSIÇÕES DE PAGAMENTO
// =========================================================

const ALLOWED_PAYMENT_TRANSITIONS = Object.freeze({

    [PAYMENT_STATUS.PENDENTE]: [
        PAYMENT_STATUS.PAGO,
        PAYMENT_STATUS.RECUSADO,
        PAYMENT_STATUS.CANCELADO
    ],

    [PAYMENT_STATUS.PAGO]: [],

    [PAYMENT_STATUS.RECUSADO]: [
        PAYMENT_STATUS.PENDENTE,
        PAYMENT_STATUS.CANCELADO
    ],

    [PAYMENT_STATUS.CANCELADO]: []
});


// =========================================================
// TRANSIÇÕES DE FULFILLMENT
// =========================================================

const ALLOWED_FULFILLMENT_TRANSITIONS = Object.freeze({

    [FULFILLMENT_STATUS.PENDENTE]: [
        FULFILLMENT_STATUS.PREPARANDO,
        FULFILLMENT_STATUS.CANCELADO
    ],

    [FULFILLMENT_STATUS.PREPARANDO]: [
        FULFILLMENT_STATUS.ENVIADO,
        FULFILLMENT_STATUS.CANCELADO
    ],

    [FULFILLMENT_STATUS.ENVIADO]: [
        FULFILLMENT_STATUS.ENTREGUE
    ],

    [FULFILLMENT_STATUS.ENTREGUE]: [],

    [FULFILLMENT_STATUS.CANCELADO]: []
});


// =========================================================
// TRANSIÇÕES DE COMISSÃO
// =========================================================

const ALLOWED_COMMISSION_TRANSITIONS = Object.freeze({

    [COMMISSION_STATUS.NAO_APLICAVEL]: [],

    [COMMISSION_STATUS.PENDENTE]: [
        COMMISSION_STATUS.LIBERADA,
        COMMISSION_STATUS.CANCELADA
    ],

    [COMMISSION_STATUS.LIBERADA]: [
        COMMISSION_STATUS.PAGA,
        COMMISSION_STATUS.CANCELADA
    ],

    [COMMISSION_STATUS.PAGA]: [],

    [COMMISSION_STATUS.CANCELADA]: []
});


// =========================================================
// FUNÇÃO INTERNA
// =========================================================

function canTransition(
    transitionMap,
    fromStatus,
    toStatus
) {

    if (!fromStatus || !toStatus) {
        return false;
    }

    /*
     * Repetir o mesmo estado é permitido.
     *
     * Isso torna a operação idempotente.
     */
    if (fromStatus === toStatus) {
        return true;
    }

    const allowed =
        transitionMap[fromStatus] || [];

    return allowed.includes(toStatus);
}


// =========================================================
// PEDIDO
// =========================================================

export function canTransitionOrderStatus(
    fromStatus,
    toStatus
) {
    return canTransition(
        ALLOWED_ORDER_TRANSITIONS,
        fromStatus,
        toStatus
    );
}


// =========================================================
// PAGAMENTO
// =========================================================

export function canTransitionPaymentStatus(
    fromStatus,
    toStatus
) {
    return canTransition(
        ALLOWED_PAYMENT_TRANSITIONS,
        fromStatus,
        toStatus
    );
}


// =========================================================
// FULFILLMENT
// =========================================================

export function canTransitionFulfillmentStatus(
    fromStatus,
    toStatus
) {
    return canTransition(
        ALLOWED_FULFILLMENT_TRANSITIONS,
        fromStatus,
        toStatus
    );
}


// =========================================================
// COMISSÃO
// =========================================================

export function canTransitionCommissionStatus(
    fromStatus,
    toStatus
) {
    return canTransition(
        ALLOWED_COMMISSION_TRANSITIONS,
        fromStatus,
        toStatus
    );
}


// =========================================================
// EXPORTAÇÃO DAS TABELAS
// =========================================================

export {
    ALLOWED_ORDER_TRANSITIONS,
    ALLOWED_PAYMENT_TRANSITIONS,
    ALLOWED_FULFILLMENT_TRANSITIONS,
    ALLOWED_COMMISSION_TRANSITIONS
};