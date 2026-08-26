/**
 * Commission Repository — V1
 *
 * Responsabilidade:
 * - consultar comissão;
 * - atualizar comissão;
 * - atualizar comissão + auditoria atomicamente.
 *
 * Este módulo NÃO decide regras de negócio.
 */

import { db } from "../firebase-config.js";

import {
    collection,
    doc,
    getDoc,
    updateDoc,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


const COMMISSIONS_COLLECTION = "commissions";
const AUDIT_COLLECTION = "orderAudit";


export async function getCommission(commissionId) {

    if (!commissionId) {
        throw new Error(
            "ID da comissão não informado."
        );
    }

    const commissionRef = doc(
        db,
        COMMISSIONS_COLLECTION,
        commissionId
    );

    const snapshot = await getDoc(
        commissionRef
    );

    if (!snapshot.exists()) {
        return null;
    }

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
}


export async function updateCommission(
    commissionId,
    changes
) {

    if (!commissionId) {
        throw new Error(
            "ID da comissão não informado."
        );
    }

    if (
        !changes ||
        typeof changes !== "object"
    ) {
        throw new Error(
            "Alterações da comissão inválidas."
        );
    }

    const commissionRef = doc(
        db,
        COMMISSIONS_COLLECTION,
        commissionId
    );

    await updateDoc(
        commissionRef,
        {
            ...changes,
            updatedAt: serverTimestamp()
        }
    );

    return getCommission(
        commissionId
    );
}


/**
 * Atualiza comissão e registra auditoria
 * dentro de uma única operação batch.
 *
 * O Repository apenas persiste.
 */
export async function updateCommissionWithAudit(
    commissionId,
    changes,
    auditEvent
) {

    if (!commissionId) {
        throw new Error(
            "ID da comissão não informado."
        );
    }

    if (
        !changes ||
        typeof changes !== "object"
    ) {
        throw new Error(
            "Alterações da comissão inválidas."
        );
    }

    if (
        !auditEvent ||
        typeof auditEvent !== "object"
    ) {
        throw new Error(
            "Evento de auditoria inválido."
        );
    }

    const commissionRef = doc(
        db,
        COMMISSIONS_COLLECTION,
        commissionId
    );

    const auditRef = doc(
        collection(db, AUDIT_COLLECTION)
    );

    const batch = writeBatch(db);

    batch.update(
        commissionRef,
        {
            ...changes,
            updatedAt: serverTimestamp()
        }
    );

    batch.set(
        auditRef,
        {
            ...auditEvent,
            commissionId,
            createdAt:
                auditEvent.createdAt ||
                serverTimestamp()
        }
    );

    await batch.commit();

    const updatedCommission =
        await getCommission(
            commissionId
        );

    return {
        commission: updatedCommission,

        audit: {
            id: auditRef.id,
            ...auditEvent,
            commissionId
        }
    };
}
