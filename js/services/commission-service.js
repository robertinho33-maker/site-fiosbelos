/**
 * Commission Service — V1
 *
 * Responsabilidade:
 * - validar operação de comissão;
 * - validar existência da comissão;
 * - validar transições;
 * - criar evento de auditoria;
 * - validar evento;
 * - delegar persistência ao Repository.
 *
 * O Service NÃO acessa Firestore diretamente.
 */

import {
    COMMISSION_STATUS
} from "../contracts/order-status.js";

import {
    canTransitionCommissionStatus
} from "../contracts/order-transitions.js";

import {
    createAuditEvent,
    validateAuditEvent
} from "../contracts/order-audit.js";


function getCurrentCommissionStatus(commission) {
    return (
        commission?.payoutStatus ||
        commission?.status ||
        COMMISSION_STATUS.PENDENTE
    );
}


/**
 * Validação isolada de transição.
 */
export function validateCommissionTransition(
    currentStatus,
    nextStatus
) {
    return canTransitionCommissionStatus(
        currentStatus,
        nextStatus
    );
}


/**
 * Altera o status operacional da comissão.
 *
 * Fluxo:
 *
 * comissão
 *   ↓
 * validar existência
 *   ↓
 * validar status
 *   ↓
 * validar transição
 *   ↓
 * criar auditoria
 *   ↓
 * validar auditoria
 *   ↓
 * Repository
 */
export async function changeCommissionStatus({
    commissionId,
    nextStatus,
    actorId = null,
    actorName = null,
    reason = "",
    repository = null
} = {}) {

    if (!commissionId) {
        throw new Error(
            "ID da comissão não informado."
        );
    }

    if (!nextStatus) {
        throw new Error(
            "Novo status da comissão não informado."
        );
    }

    if (
        !repository ||
        typeof repository.getCommission !== "function" ||
        typeof repository.updateCommissionWithAudit !== "function"
    ) {
        throw new Error(
            "Repository de comissão não configurado."
        );
    }

    if (
        !Object.values(COMMISSION_STATUS)
            .includes(nextStatus)
    ) {
        throw new Error(
            `Status de comissão inválido: ${nextStatus}`
        );
    }

    const commission =
        await repository.getCommission(
            commissionId
        );

    if (!commission) {
        throw new Error(
            `Comissão não encontrada: ${commissionId}`
        );
    }

    const currentStatus =
        getCurrentCommissionStatus(
            commission
        );

    if (
        !canTransitionCommissionStatus(
            currentStatus,
            nextStatus
        )
    ) {
        throw new Error(
            `Transição de comissão inválida: ` +
            `${currentStatus} → ${nextStatus}`
        );
    }

    const changes = {
        payoutStatus: nextStatus
    };

    if (
        nextStatus === COMMISSION_STATUS.PAGA
    ) {
        changes.paidAt = new Date();
    }

    const auditEvent =
        createAuditEvent({
            type: "ORDER_COMMISSION_CHANGED",
            orderId:
                commission.orderId ||
                commission.orderNumber ||
                commission.id,
            actorId,
            actorName,
            from: currentStatus,
            to: nextStatus,
            reason,
            metadata: {
                commissionId
            }
        });

    const auditValidation =
        validateAuditEvent(auditEvent);

    if (!auditValidation.valid) {
        throw new Error(
            `Evento de auditoria inválido: ` +
            `${auditValidation.errors.join(" | ")}`
        );
    }

    const result =
        await repository.updateCommissionWithAudit(
            commissionId,
            changes,
            auditEvent
        );

    return {
        ...result,
        previousStatus: currentStatus,
        nextStatus
    };
}


/**
 * Libera uma comissão.
 */
export async function releaseCommission({
    commissionId,
    actorId = null,
    actorName = null,
    reason = "",
    repository = null
} = {}) {

    return changeCommissionStatus({
        commissionId,
        nextStatus:
            COMMISSION_STATUS.LIBERADA,
        actorId,
        actorName,
        reason,
        repository
    });
}


/**
 * Marca uma comissão como paga.
 */
export async function payCommission({
    commissionId,
    actorId = null,
    actorName = null,
    reason = "",
    repository = null
} = {}) {

    return changeCommissionStatus({
        commissionId,
        nextStatus:
            COMMISSION_STATUS.PAGA,
        actorId,
        actorName,
        reason,
        repository
    });
}


/**
 * Cancela uma comissão.
 */
export async function cancelCommission({
    commissionId,
    actorId = null,
    actorName = null,
    reason = "",
    repository = null
} = {}) {

    return changeCommissionStatus({
        commissionId,
        nextStatus:
            COMMISSION_STATUS.CANCELADA,
        actorId,
        actorName,
        reason,
        repository
    });
}
