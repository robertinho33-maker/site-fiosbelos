/**
 * Contrato de Transições Operacionais — Pedido V1
 *
 * Define quais mudanças de estado são permitidas.
 * Este arquivo não executa operações nem altera Firestore.
 */

import {
    ORDER_STATUS,
    PAYMENT_STATUS,
    FULFILLMENT_STATUS,
    COMMISSION_STATUS
} from "./order-status.js";


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


export function canTransitionOrderStatus(
    fromStatus,
    toStatus
) {
    const allowed =
        ALLOWED_ORDER_TRANSITIONS[fromStatus] || [];

    return allowed.includes(toStatus);
}


export function canTransitionPaymentStatus(
    fromStatus,
    toStatus
) {
    const allowed =
        ALLOWED_PAYMENT_TRANSITIONS[fromStatus] || [];

    return allowed.includes(toStatus);
}


export function canTransitionFulfillmentStatus(
    fromStatus,
    toStatus
) {
    const allowed =
        ALLOWED_FULFILLMENT_TRANSITIONS[fromStatus] || [];

    return allowed.includes(toStatus);
}


export function canTransitionCommissionStatus(
    fromStatus,
    toStatus
) {
    const allowed =
        ALLOWED_COMMISSION_TRANSITIONS[fromStatus] || [];

    return allowed.includes(toStatus);
}


export {
    ALLOWED_ORDER_TRANSITIONS,
    ALLOWED_PAYMENT_TRANSITIONS,
    ALLOWED_FULFILLMENT_TRANSITIONS,
    ALLOWED_COMMISSION_TRANSITIONS
};
