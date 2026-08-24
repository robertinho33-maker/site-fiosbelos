/**
 * Contrato de Transições Operacionais — Pedido V1
 *
 * Define quais mudanças de status do pedido são permitidas.
 * Este arquivo não executa transições nem altera Firestore.
 */

import { ORDER_STATUS } from "./order-status.js";

const ALLOWED_TRANSITIONS = Object.freeze({
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

export function canTransitionOrderStatus(fromStatus, toStatus) {
    const allowedTransitions =
        ALLOWED_TRANSITIONS[fromStatus] || [];

    return allowedTransitions.includes(toStatus);
}

export { ALLOWED_TRANSITIONS };
