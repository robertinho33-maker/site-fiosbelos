/**
 * Máquina de Estados do Pedido — V1
 *
 * Responsabilidade:
 * - validar estados;
 * - validar coerência entre estados;
 * - validar transições do pedido.
 *
 * Este módulo:
 * - não altera Firestore;
 * - não altera o objeto original;
 * - não executa automações.
 */

import {
    ORDER_STATUS,
    PAYMENT_STATUS,
    FULFILLMENT_STATUS,
    COMMISSION_STATUS
} from "./order-status.js";


function isValidOrderStatus(status) {
    return Object.values(ORDER_STATUS).includes(status);
}


function isValidPaymentStatus(status) {
    return Object.values(PAYMENT_STATUS).includes(status);
}


function isValidFulfillmentStatus(status) {
    return Object.values(FULFILLMENT_STATUS).includes(status);
}


function isValidCommissionStatus(status) {
    return Object.values(COMMISSION_STATUS).includes(status);
}


/**
 * Valida a coerência operacional atual de um pedido.
 */
export function validateOrderState(order) {
    const errors = [];

    if (!order || typeof order !== "object") {
        return {
            valid: false,
            errors: ["Pedido inválido."]
        };
    }

    const orderStatus = order.status;
    const paymentStatus = order.payment?.status;
    const fulfillmentStatus = order.fulfillment?.status;
    const commissionStatus = order.commission?.status;

    if (!isValidOrderStatus(orderStatus)) {
        errors.push("Status do pedido inválido.");
    }

    if (!isValidPaymentStatus(paymentStatus)) {
        errors.push("Status de pagamento inválido.");
    }

    if (!isValidFulfillmentStatus(fulfillmentStatus)) {
        errors.push("Status de entrega inválido.");
    }

    if (
        commissionStatus !== undefined &&
        !isValidCommissionStatus(commissionStatus)
    ) {
        errors.push("Status de comissão inválido.");
    }


    /*
     * Pedido concluído exige pagamento confirmado.
     */
    if (
        orderStatus === ORDER_STATUS.CONCLUIDO &&
        paymentStatus !== PAYMENT_STATUS.PAGO
    ) {
        errors.push(
            "Pedido concluído exige pagamento confirmado."
        );
    }


    /*
     * Entrega concluída exige pagamento confirmado.
     */
    if (
        fulfillmentStatus === FULFILLMENT_STATUS.ENTREGUE &&
        paymentStatus !== PAYMENT_STATUS.PAGO
    ) {
        errors.push(
            "Entrega concluída exige pagamento confirmado."
        );
    }


    /*
     * Comissão pendente exige valor positivo.
     */
    if (
        commissionStatus === COMMISSION_STATUS.PENDENTE &&
        Number(order.commission?.amount || 0) <= 0
    ) {
        errors.push(
            "Comissão pendente exige valor de comissão."
        );
    }


    return {
        valid: errors.length === 0,
        errors
    };
}


/**
 * Verifica se uma transição comercial é permitida.
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
 *
 * Cancelamento:
 *
 * Pendente --------→ Cancelado
 * Confirmado ------→ Cancelado
 * Em processamento → Cancelado
 */
export function canTransitionOrderStatus(
    currentStatus,
    nextStatus
) {
    if (
        !isValidOrderStatus(currentStatus) ||
        !isValidOrderStatus(nextStatus)
    ) {
        return false;
    }

    /*
     * Repetir o mesmo estado não é uma transição.
     * Consideramos permitido para facilitar operações idempotentes.
     */
    if (currentStatus === nextStatus) {
        return true;
    }


    const transitions = {
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
    };


    return (
        transitions[currentStatus] || []
    ).includes(nextStatus);
}
