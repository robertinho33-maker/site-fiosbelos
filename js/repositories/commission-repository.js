/**
 * Commission Repository — V1
 *
 * Responsabilidade:
 * - consultar comissão;
 * - atualizar comissão;
 * - persistir dados.
 *
 * Este módulo NÃO decide regras de negócio.
 */

import { db } from "../firebase-config.js";

import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


const COMMISSIONS_COLLECTION = "commissions";


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
