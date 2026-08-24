/**
 * Normalizador de Pedido — V1
 *
 * Converte pedidos V1 e pedidos legados para uma
 * representação consistente para leitura da aplicação.
 *
 * Este módulo NÃO altera Firestore.
 */

export function getOrderSubtotal(order) {
    if (order?.totals && typeof order.totals.subtotal !== "undefined") {
        return Number(order.totals.subtotal) || 0;
    }

    return Number(order?.subtotal) || 0;
}

export function getOrderDiscount(order) {
    if (order?.totals && typeof order.totals.discount !== "undefined") {
        return Number(order.totals.discount) || 0;
    }

    return Number(order?.discountAmount) || 0;
}

export function getOrderTotal(order) {
    if (order?.totals && typeof order.totals.total !== "undefined") {
        return Number(order.totals.total) || 0;
    }

    return Number(order?.totalAmount) || 0;
}

export function getPaymentStatus(order) {
    if (order?.payment && typeof order.payment.status !== "undefined") {
        return order.payment.status;
    }

    return null;
}

export function getFulfillmentStatus(order) {
    if (
        order?.fulfillment &&
        typeof order.fulfillment.status !== "undefined"
    ) {
        return order.fulfillment.status;
    }

    return null;
}

export function getOrderStatus(order) {
    return order?.status || null;
}

export function normalizeOrder(order) {
    return {
        ...order,

        subtotal: getOrderSubtotal(order),
        discountAmount: getOrderDiscount(order),
        totalAmount: getOrderTotal(order),

        paymentStatus: getPaymentStatus(order),
        fulfillmentStatus: getFulfillmentStatus(order),
        orderStatus: getOrderStatus(order)
    };
}
