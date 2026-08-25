/**
 * Contrato de Auditoria de Pedido — V1
 *
 * Responsabilidade:
 * - criar eventos de auditoria;
 * - validar eventos;
 * - preservar rastreabilidade.
 *
 * Este módulo:
 * - não escreve no Firestore;
 * - não altera pedidos;
 * - não executa automações.
 */

const AUDIT_EVENT_TYPES = Object.freeze({
    CREATED: "ORDER_CREATED",
    STATUS_CHANGED: "ORDER_STATUS_CHANGED",
    PAYMENT_CHANGED: "ORDER_PAYMENT_CHANGED",
    FULFILLMENT_CHANGED: "ORDER_FULFILLMENT_CHANGED",
    COMMISSION_CHANGED: "ORDER_COMMISSION_CHANGED",
    UPDATED: "ORDER_UPDATED",
    CANCELLED: "ORDER_CANCELLED"
});


function isValidString(value) {
    return (
        typeof value === "string" &&
        value.trim().length > 0
    );
}


function isValidEventType(type) {
    return Object.values(AUDIT_EVENT_TYPES)
        .includes(type);
}


/**
 * Cria um evento de auditoria.
 *
 * Não altera o objeto original.
 */
export function createAuditEvent({
    type,
    orderId,
    actorId = null,
    actorName = null,
    from = null,
    to = null,
    reason = null,
    metadata = {}
} = {}) {

    const event = {
        type,
        orderId,
        actor: {
            id: actorId,
            name: actorName
        },
        change: {
            from,
            to
        },
        reason,
        metadata,
        createdAt: new Date().toISOString()
    };

    return event;
}


/**
 * Valida um evento de auditoria.
 */
export function validateAuditEvent(event) {
    const errors = [];

    if (!event || typeof event !== "object") {
        return {
            valid: false,
            errors: ["Evento de auditoria inválido."]
        };
    }


    if (!isValidEventType(event.type)) {
        errors.push(
            "Tipo de evento de auditoria inválido."
        );
    }


    if (!isValidString(event.orderId)) {
        errors.push(
            "Evento de auditoria deve possuir orderId."
        );
    }


    if (!event.actor || typeof event.actor !== "object") {
        errors.push(
            "Evento de auditoria deve possuir actor."
        );
    }


    if (
        event.actor &&
        event.actor.id !== null &&
        event.actor.id !== undefined &&
        !isValidString(event.actor.id)
    ) {
        errors.push(
            "Identificador do autor da alteração inválido."
        );
    }


    if (
        event.change &&
        typeof event.change !== "object"
    ) {
        errors.push(
            "Estrutura de alteração inválida."
        );
    }


    if (
        event.metadata === null ||
        typeof event.metadata !== "object"
    ) {
        errors.push(
            "Metadata de auditoria inválida."
        );
    }


    if (!isValidString(event.createdAt)) {
        errors.push(
            "Evento de auditoria deve possuir createdAt."
        );
    }


    return {
        valid: errors.length === 0,
        errors
    };
}


export {
    AUDIT_EVENT_TYPES
};
