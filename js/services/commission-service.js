/**
 * Commission Service — V1
 *
 * Responsabilidade:
 * - validar operação de comissão;
 * - validar existência da comissão;
 * - validar transições;
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


function getCurrentCommissionStatus(commission) {
    return (
        commission?.payoutStatus ||
        commission?.status ||
        COMMISSION_STATUS.PENDENTE
    );
}


/**
 * Validação isolada de transição.
 *
 * Não persiste e não altera a comissão.
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
 * Repository
 */
export async function changeCommissionStatus({
    commissionId,
    nextStatus,
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
        typeof repository.updateCommission !== "function"
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

    const updatedCommission =
        await repository.updateCommission(
            commissionId,
            changes
        );

    return {
        commission: updatedCommission,
        previousStatus: currentStatus,
        nextStatus
    };
}


/**
 * Libera uma comissão.
 */
export async function releaseCommission({
    commissionId,
    repository = null
} = {}) {

    return changeCommissionStatus({
        commissionId,
        nextStatus:
            COMMISSION_STATUS.LIBERADA,
        repository
    });
}


/**
 * Marca uma comissão como paga.
 */
export async function payCommission({
    commissionId,
    repository = null
} = {}) {

    return changeCommissionStatus({
        commissionId,
        nextStatus:
            COMMISSION_STATUS.PAGA,
        repository
    });
}


/**
 * Cancela uma comissão.
 */
export async function cancelCommission({
    commissionId,
    repository = null
} = {}) {

    return changeCommissionStatus({
        commissionId,
        nextStatus:
            COMMISSION_STATUS.CANCELADA,
        repository
    });
}
