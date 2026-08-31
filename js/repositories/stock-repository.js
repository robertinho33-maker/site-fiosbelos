/**
 * Stock Repository — V1
 *
 * Responsabilidade:
 * - acessar a coleção inventory do Firestore;
 * - buscar registros de estoque;
 *
 * O Repository não contém regras de negócio.
 */

import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db } from "../firebase-config.js";


const INVENTORY_COLLECTION = "inventory";


export async function getStock(sku) {
    const normalizedSKU =
        String(sku || "").trim();

    if (!normalizedSKU) {
        throw new Error(
            "SKU não informado para consulta de estoque."
        );
    }

    const reference =
        doc(
            db,
            INVENTORY_COLLECTION,
            normalizedSKU
        );

    const snapshot =
        await getDoc(reference);

    if (!snapshot.exists()) {
        return null;
    }

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
}


export async function getAllStock() {
    const reference =
        collection(
            db,
            INVENTORY_COLLECTION
        );

    const snapshot =
        await getDocs(reference);

    return snapshot.docs.map(
        document => ({
            id: document.id,
            ...document.data()
        })
    );
}


export async function setStock(
    sku,
    data
) {
    const normalizedSKU =
        String(sku || "").trim();

    if (!normalizedSKU) {
        throw new Error(
            "SKU não informado para salvar estoque."
        );
    }

    if (!data || typeof data !== "object") {
        throw new Error(
            "Dados de estoque inválidos."
        );
    }

    const reference =
        doc(
            db,
            INVENTORY_COLLECTION,
            normalizedSKU
        );

    await setDoc(
        reference,
        {
            ...data,
            sku: normalizedSKU
        },
        {
            merge: true
        }
    );

    return getStock(normalizedSKU);
}


export async function deleteStock(sku) {
    const normalizedSKU =
        String(sku || "").trim();

    if (!normalizedSKU) {
        throw new Error(
            "SKU não informado para excluir estoque."
        );
    }

    const reference =
        doc(
            db,
            INVENTORY_COLLECTION,
            normalizedSKU
        );

    await deleteDoc(reference);

    return {
        sku: normalizedSKU,
        deleted: true
    };
}
