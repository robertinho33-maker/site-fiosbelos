/**
 * Order Service — Núcleo Operacional de Vendas V1
 *
 * Responsabilidade:
 * - validar pedidos;
 * - calcular valores;
 * - validar transições;
 * - preparar eventos de auditoria;
 * - orquestrar operações de pedido.
 *
 * O Service não conhece Firebase.
 * A persistência é recebida através do Repository.
 */

import {
    calculateOrderFinancials
} from "../contracts/order-financials.js";

import {
    validateOrderIntegrity
} from "../contracts/order-integrity.js";

import {
    canTransitionOrderStatus,
    canTransitionPaymentStatus
} from "../contracts/order-transitions.js";

import {
    PAYMENT_STATUS
} from "../contracts/order-status.js";

import {
    createAuditEvent,
    validateAuditEvent
} from "../contracts/order-audit.js";


/**
 * Criação operacional do pedido.
 */
export async function createOrderOperation({
    order,
    actorId = null,
    actorName = null,
    reason = "",
    repository = null
} = {}) {

    if (!order || typeof order !== "object") {
        throw new Error("Pedido inválido.");
    }

    if (
        !repository ||
        typeof repository.createOrderWithAudit !== "function"
    ) {
        throw new Error(
            "Repository de pedidos não configurado."
        );
    }

    const integrity =
        validateOrderIntegrity(order);

    if (!integrity.valid) {
        throw new Error(
            `Pedido inválido: ${integrity.errors.join(" | ")}`
        );
    }

    if (!order.status) {
        throw new Error(
            "Pedido deve possuir status."
        );
    }

    const auditEvent = createAuditEvent({
        type: "ORDER_CREATED",
        orderId:
            order.orderNumber ||
            order.id ||
            "pending",
        actorId,
        actorName,
        reason,
        metadata: {
            schemaVersion:
                order.schemaVersion || null
        }
    });

    const auditValidation =
        validateAuditEvent(auditEvent);

    if (!auditValidation.valid) {
        throw new Error(
            `Evento de auditoria inválido: ${auditValidation.errors.join(" | ")}`
        );
    }

    return repository.createOrderWithAudit(
        order,
        auditEvent
    );
}


/**
 * Altera o status operacional do pedido.
 *
 * Fluxo:
 *
 * pedido
 *   ↓
 * validar existência
 *   ↓
 * validar transição
 *   ↓
 * criar auditoria
 *   ↓
 * validar auditoria
 *   ↓
 * Repository
 */
export async function changeOrderStatus({
    orderId,
    nextStatus,
    actorId = null,
    actorName = null,
    reason = "",
    repository = null
} = {}) {

    if (!orderId) {
        throw new Error(
            "ID do pedido não informado."
        );
    }

    if (!nextStatus) {
        throw new Error(
            "Novo status não informado."
        );
    }

    if (
        !repository ||
        typeof repository.getOrder !== "function" ||
        typeof repository.updateOrderWithAudit !== "function"
    ) {
        throw new Error(
            "Repository de pedidos não configurado."
        );
    }

    // =====================================================
    // 1. BUSCAR PEDIDO
    // =====================================================

    const order =
        await repository.getOrder(orderId);

    if (!order) {
        throw new Error(
            `Pedido não encontrado: ${orderId}`
        );
    }

    // =====================================================
    // 2. VALIDAR INTEGRIDADE
    // =====================================================

    const integrity =
        validateOrderIntegrity(order);

    if (!integrity.valid) {
        throw new Error(
            `Pedido inválido: ${integrity.errors.join(" | ")}`
        );
    }

    // =====================================================
    // 3. VALIDAR TRANSIÇÃO
    // =====================================================

    const currentStatus =
        order.status;

    const transition =
        canTransitionOrderStatus(
            currentStatus,
            nextStatus
        );

    if (!transition) {
        throw new Error(
            `Transição de status inválida: ${currentStatus} → ${nextStatus}`
        );
    }

    // =====================================================
    // 4. CRIAR AUDITORIA
    // =====================================================

    const auditEvent =
        createAuditEvent({
            type: "ORDER_STATUS_CHANGED",
            orderId:
                order.orderNumber ||
                order.id,
            actorId,
            actorName,
            from: currentStatus,
            to: nextStatus,
            reason
        });

    // =====================================================
    // 5. VALIDAR AUDITORIA
    // =====================================================

    const auditValidation =
        validateAuditEvent(auditEvent);

    if (!auditValidation.valid) {
        throw new Error(
            `Evento de auditoria inválido: ${auditValidation.errors.join(" | ")}`
        );
    }

    // =====================================================
    // 6. PERSISTIR ATOMICAMENTE
    // =====================================================

    const changes = {
        status: nextStatus
    };

    return repository.updateOrderWithAudit(
        orderId,
        changes,
        auditEvent
    );
}


/**
 * Altera o status financeiro do pedido.
 *
 * Fluxo:
 *
 * pedido
 *   ↓
 * validar existência
 *   ↓
 * validar integridade
 *   ↓
 * validar status financeiro
 *   ↓
 * criar auditoria
 *   ↓
 * validar auditoria
 *   ↓
 * Repository
 */
export async function changeOrderPaymentStatus({
    orderId,
    nextStatus,
    actorId = null,
    actorName = null,
    reason = "",
    repository = null
} = {}) {

    if (!orderId) {
        throw new Error(
            "ID do pedido não informado."
        );
    }

    if (!nextStatus) {
        throw new Error(
            "Novo status de pagamento não informado."
        );
    }

    if (
        !repository ||
        typeof repository.getOrder !== "function" ||
        typeof repository.updateOrderWithAudit !== "function"
    ) {
        throw new Error(
            "Repository de pedidos não configurado."
        );
    }

    if (!Object.values(PAYMENT_STATUS).includes(nextStatus)) {
        throw new Error(
            `Status de pagamento inválido: ${nextStatus}`
        );
    }

    const order =
        await repository.getOrder(orderId);

    if (!order) {
        throw new Error(
            `Pedido não encontrado: ${orderId}`
        );
    }

    const integrity =
        validateOrderIntegrity(order);

    if (!integrity.valid) {
        throw new Error(
            `Pedido inválido: ${integrity.errors.join(" | ")}`
        );
    }

    const currentStatus =
        order.paymentStatus ||
        order.payment?.status ||
        PAYMENT_STATUS.PENDENTE;

    if (
        currentStatus !== nextStatus &&
        !canTransitionPaymentStatus(
            currentStatus,
            nextStatus
        )
    ) {
        throw new Error(
            `Transição de pagamento inválida: ` +
            `${currentStatus} → ${nextStatus}`
        );
    }

    const auditEvent =
        createAuditEvent({
            type: "ORDER_PAYMENT_CHANGED",
            orderId:
                order.orderNumber ||
                order.id,
            actorId,
            actorName,
            from: currentStatus,
            to: nextStatus,
            reason
        });

    const auditValidation =
        validateAuditEvent(auditEvent);

    if (!auditValidation.valid) {
        throw new Error(
            `Evento de auditoria inválido: ${auditValidation.errors.join(" | ")}`
        );
    }

    const changes = {
        paymentStatus: nextStatus,
        "payment.status": nextStatus
    };

    return repository.updateOrderWithAudit(
        orderId,
        changes,
        auditEvent
    );
}


/**
 * Cálculo financeiro.
 */
export function calculateOrder(
    items,
    coupon = null
) {
    return calculateOrderFinancials(
        items,
        coupon
    );
}


/**
 * Validação estrutural/integridade.
 */
export function validateOrder(order) {
    return validateOrderIntegrity(order);
}


/**
 * Validação isolada de transição.
 */
export function validateStatusTransition(
    currentStatus,
    nextStatus
) {
    return canTransitionOrderStatus(
        currentStatus,
        nextStatus
    );
}


/**
 * Prepara uma alteração de status sem persistir.
 *
 * Útil para operações puras e testes.
 */
export function prepareStatusChange({
    order,
    nextStatus,
    actorId,
    actorName,
    reason = ""
}) {

    if (!order || typeof order !== "object") {
        throw new Error(
            "Pedido inválido."
        );
    }

    const currentStatus =
        order.status;

    const transition =
        canTransitionOrderStatus(
            currentStatus,
            nextStatus
        );

    if (!transition) {
        throw new Error(
            `Transição de status inválida: ${currentStatus} → ${nextStatus}`
        );
    }

    const auditEvent =
        createAuditEvent({
            type: "ORDER_STATUS_CHANGED",
            orderId:
                order.orderNumber ||
                order.id,
            actorId,
            actorName,
            from: currentStatus,
            to: nextStatus,
            reason
        });

    const auditValidation =
        validateAuditEvent(auditEvent);

    if (!auditValidation.valid) {
        throw new Error(
            `Evento de auditoria inválido: ${auditValidation.errors.join(" | ")}`
        );
    }

    return {
        ...order,
        status: nextStatus,
        updatedAt:
            new Date().toISOString(),
        auditEvent
    };
}
