/**
 * Audit Repository — V1
 *
 * Responsabilidade:
 * - persistir eventos de auditoria.
 *
 * Este módulo não decide se o evento é válido.
 * Essa responsabilidade pertence ao contrato de auditoria.
 */

import { db } from "../firebase-config.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const AUDIT_COLLECTION = "orderAudit";

export async function saveAuditEvent(event) {
    if (!event || typeof event !== "object") {
        throw new Error("Evento de auditoria inválido.");
    }

    const auditRef = await addDoc(
        collection(db, AUDIT_COLLECTION),
        {
            ...event,
            createdAt:
                event.createdAt ||
                serverTimestamp()
        }
    );

    return {
        id: auditRef.id,
        ...event
    };
}
