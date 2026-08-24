/**
 * Operações Operacionais de Pedido — V1
 *
 * Centraliza as operações de mudança de estado.
 *
 * Responsabilidades:
 * - validar transições;
 * - persistir alterações no Firestore;
 * - manter timestamp operacional.
 */

import {
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db } from "../firebase-config.js";

import {
    ORDER_STATUS,
    PAYMENT_STATUS,
    FULFILLMENT_STATUS
} from "./order-status.js";

import {
    canTransitionOrderStatus,
    canTransitionPaymentStatus,
    canTransitionFulfillmentStatus
} from "./order-transitions.js";


async function updateOrder(orderId, data) {
    if (!orderId) {
        throw new Error("ID do pedido não informado.");
    }

    if (!data || typeof data !== "object") {
        throw new Error("Dados da operação inválidos.");
    }

    await updateDoc(
        doc(db, "orders", orderId),
        {
            ...data,
            updatedAt: serverTimestamp()
        }
    );
}


/**
 * Confirma um pedido pendente.
 */
export async function confirmOrder(order) {
    const currentStatus =
        order?.orderStatus ||
        order?.status ||
        null;

    if (
        !canTransitionOrderStatus(
            currentStatus,
            ORDER_STATUS.CONFIRMADO
        )
    ) {
        throw new Error(
            `Não é possível confirmar o pedido: ` +
            `${currentStatus} → ${ORDER_STATUS.CONFIRMADO}`
        );
    }

    await updateOrder(
        order.id,
        {
            status: ORDER_STATUS.CONFIRMADO
        }
    );
}


/**
 * Inicia o processamento de um pedido confirmado.
 */
export async function startOrderProcessing(order) {
    const currentStatus =
        order?.orderStatus ||
        order?.status ||
        null;

    if (
        !canTransitionOrderStatus(
            currentStatus,
            ORDER_STATUS.EM_PROCESSAMENTO
        )
    ) {
        throw new Error(
            `Não é possível iniciar o processamento: ` +
            `${currentStatus} → ${ORDER_STATUS.EM_PROCESSAMENTO}`
        );
    }

    await updateOrder(
        order.id,
        {
            status: ORDER_STATUS.EM_PROCESSAMENTO
        }
    );
}


/**
 * Conclui um pedido em processamento.
 */
export async function completeOrder(order) {
    const currentStatus =
        order?.orderStatus ||
        order?.status ||
        null;

    if (
        !canTransitionOrderStatus(
            currentStatus,
            ORDER_STATUS.CONCLUIDO
        )
    ) {
        throw new Error(
            `Não é possível concluir o pedido: ` +
            `${currentStatus} → ${ORDER_STATUS.CONCLUIDO}`
        );
    }

    await updateOrder(
        order.id,
        {
            status: ORDER_STATUS.CONCLUIDO
        }
    );
}


/**
 * Cancela um pedido.
 */
export async function cancelOrder(order) {
    const currentStatus =
        order?.orderStatus ||
        order?.status ||
        null;

    if (
        !canTransitionOrderStatus(
            currentStatus,
            ORDER_STATUS.CANCELADO
        )
    ) {
        throw new Error(
            `Não é possível cancelar o pedido: ` +
            `${currentStatus} → ${ORDER_STATUS.CANCELADO}`
        );
    }

    await updateOrder(
        order.id,
        {
            status: ORDER_STATUS.CANCELADO
        }
    );
}


/**
 * Atualiza o status financeiro do pedido.
 */
export async function updatePaymentStatus(order, status) {
    const currentStatus =
        order?.paymentStatus ||
        order?.payment?.status ||
        null;

    if (!Object.values(PAYMENT_STATUS).includes(status)) {
        throw new Error(
            `Status de pagamento inválido: ${status}`
        );
    }

    if (
        currentStatus &&
        !canTransitionPaymentStatus(
            currentStatus,
            status
        )
    ) {
        throw new Error(
            `Transição de pagamento não permitida: ` +
            `${currentStatus} → ${status}`
        );
    }

    await updateOrder(
        order.id,
        {
            "payment.status": status
        }
    );
}


/**
 * Atualiza o status de fulfillment.
 */
export async function updateFulfillmentStatus(order, status) {
    const currentStatus =
        order?.fulfillmentStatus ||
        order?.fulfillment?.status ||
        null;

    if (!Object.values(FULFILLMENT_STATUS).includes(status)) {
        throw new Error(
            `Status de fulfillment inválido: ${status}`
        );
    }

    if (
        currentStatus &&
        !canTransitionFulfillmentStatus(
            currentStatus,
            status
        )
    ) {
        throw new Error(
            `Transição de fulfillment não permitida: ` +
            `${currentStatus} → ${status}`
        );
    }

    await updateOrder(
        order.id,
        {
            "fulfillment.status": status
        }
    );
}
