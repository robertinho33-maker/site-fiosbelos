/**
 * Order Repository — V1
 *
 * Responsabilidade:
 * - persistir pedidos;
 * - consultar pedidos;
 * - atualizar pedidos;
 * - persistir alterações operacionais.
 *
 * Este módulo NÃO decide regras de negócio.
 * As regras pertencem ao Order Service / Contracts.
 */

import { db } from "../firebase-config.js";

import {
    collection,
    addDoc,
    getDoc,
    doc,
    updateDoc,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ORDERS_COLLECTION = "orders";
const AUDIT_COLLECTION = "orderAudit";

export async function createOrder(orderData) {
    if (!orderData || typeof orderData !== "object") {
        throw new Error("Dados do pedido inválidos.");
    }

    const orderRef = await addDoc(
        collection(db, ORDERS_COLLECTION),
        orderData
    );

    return {
        id: orderRef.id,
        ...orderData
    };
}


/**
 * Cria o pedido e seu evento de auditoria
 * dentro de uma única operação batch.
 *
 * O Repository apenas persiste.
 * As regras já devem ter sido validadas pelo Service.
 */
export async function createOrderWithAudit(
    orderData,
    auditEvent
) {
    if (!orderData || typeof orderData !== "object") {
        throw new Error("Dados do pedido inválidos.");
    }

    if (!auditEvent || typeof auditEvent !== "object") {
        throw new Error("Evento de auditoria inválido.");
    }

    const orderRef = doc(
        collection(db, ORDERS_COLLECTION)
    );

    const auditRef = doc(
        collection(db, AUDIT_COLLECTION)
    );

    const batch = writeBatch(db);

    batch.set(orderRef, orderData);

    batch.set(auditRef, {
        ...auditEvent,
        orderId: orderRef.id,
        orderNumber: orderData.orderNumber || null,
        createdAt:
            auditEvent.createdAt ||
            serverTimestamp()
    });

    await batch.commit();

    return {
        order: {
            id: orderRef.id,
            ...orderData
        },
        audit: {
            id: auditRef.id,
            ...auditEvent,
            orderId: orderRef.id,
            orderNumber: orderData.orderNumber || null
        }
    };
}

export async function getOrder(orderId) {
    if (!orderId) {
        throw new Error("ID do pedido não informado.");
    }

    const orderRef = doc(
        db,
        ORDERS_COLLECTION,
        orderId
    );

    const snapshot = await getDoc(orderRef);

    if (!snapshot.exists()) {
        return null;
    }

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
}

export async function updateOrder(
    orderId,
    changes
) {
    if (!orderId) {
        throw new Error("ID do pedido não informado.");
    }

    if (!changes || typeof changes !== "object") {
        throw new Error("Alterações inválidas.");
    }

    const orderRef = doc(
        db,
        ORDERS_COLLECTION,
        orderId
    );

    await updateDoc(orderRef, {
        ...changes,
        updatedAt: serverTimestamp()
    });

    return getOrder(orderId);
}

/**
 * Atualiza o pedido e registra sua auditoria
 * dentro de uma única operação batch.
 *
 * O Repository não decide se a alteração é permitida.
 * Ele apenas persiste os dados já validados pelo Service.
 */
export async function updateOrderWithAudit(
    orderId,
    changes,
    auditEvent
) {
    if (!orderId) {
        throw new Error("ID do pedido não informado.");
    }

    if (!changes || typeof changes !== "object") {
        throw new Error("Alterações inválidas.");
    }

    if (!auditEvent || typeof auditEvent !== "object") {
        throw new Error("Evento de auditoria inválido.");
    }

    const orderRef = doc(
        db,
        ORDERS_COLLECTION,
        orderId
    );

    const auditRef = doc(
        collection(db, AUDIT_COLLECTION)
    );

    const batch = writeBatch(db);

    batch.update(orderRef, {
        ...changes,
        updatedAt: serverTimestamp()
    });

    batch.set(auditRef, {
        ...auditEvent,
        createdAt:
            auditEvent.createdAt ||
            serverTimestamp()
    });

    await batch.commit();

    const updatedOrder = await getOrder(orderId);

    return {
        order: updatedOrder,
        audit: {
            id: auditRef.id,
            ...auditEvent
        }
    };
}
