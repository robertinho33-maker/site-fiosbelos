/**
 * Operações Operacionais de Comissão — V1
 *
 * Centraliza as mudanças de estado da comissão.
 *
 * Não calcula comissão.
 * Não cria comissão.
 * Não altera pedido.
 *
 * Responsabilidade:
 * - validar transições;
 * - persistir status;
 * - manter updatedAt.
 */

import {
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db } from "../firebase-config.js";

import {
    COMMISSION_STATUS
} from "./order-status.js";

import {
    canTransitionCommissionStatus
} from "./order-transitions.js";


async function updateCommission(id, data) {
    if (!id) {
        throw new Error(
            "ID da comissão não informado."
        );
    }

    if (!data || typeof data !== "object") {
        throw new Error(
            "Dados da comissão inválidos."
        );
    }

    await updateDoc(
        doc(db, "commissions", id),
        {
            ...data,
            updatedAt: serverTimestamp()
        }
    );
}


export async function releaseCommission(commission) {
    const currentStatus =
        commission?.payoutStatus ||
        commission?.status ||
        COMMISSION_STATUS.PENDENTE;

    if (
        !canTransitionCommissionStatus(
            currentStatus,
            COMMISSION_STATUS.LIBERADA
        )
    ) {
        throw new Error(
            `Não é possível liberar a comissão: ` +
            `${currentStatus} → ${COMMISSION_STATUS.LIBERADA}`
        );
    }

    await updateCommission(
        commission.id,
        {
            payoutStatus: COMMISSION_STATUS.LIBERADA
        }
    );
}


export async function payCommission(commission) {
    const currentStatus =
        commission?.payoutStatus ||
        commission?.status ||
        COMMISSION_STATUS.PENDENTE;

    if (
        !canTransitionCommissionStatus(
            currentStatus,
            COMMISSION_STATUS.PAGA
        )
    ) {
        throw new Error(
            `Não é possível pagar a comissão: ` +
            `${currentStatus} → ${COMMISSION_STATUS.PAGA}`
        );
    }

    await updateCommission(
        commission.id,
        {
            payoutStatus: COMMISSION_STATUS.PAGA,
            paidAt: serverTimestamp()
        }
    );
}


export async function cancelCommission(commission) {
    const currentStatus =
        commission?.payoutStatus ||
        commission?.status ||
        COMMISSION_STATUS.PENDENTE;

    if (
        !canTransitionCommissionStatus(
            currentStatus,
            COMMISSION_STATUS.CANCELADA
        )
    ) {
        throw new Error(
            `Não é possível cancelar a comissão: ` +
            `${currentStatus} → ${COMMISSION_STATUS.CANCELADA}`
        );
    }

    await updateCommission(
        commission.id,
        {
            payoutStatus: COMMISSION_STATUS.CANCELADA
        }
    );
}
