/**
 * Stock Service — V1
 *
 * Responsabilidade:
 * - carregar estoque operacional;
 * - normalizar registros;
 * - construir Stock Map.
 *
 * O Service não acessa Firebase diretamente.
 *
 * O Repository é injetado pelo consumidor.
 */

import {
    normalizeStockRecord
} from "../contracts/stock-contract.js";


export async function loadStockMap({
    repository = null
} = {}) {

    if (
        !repository ||
        typeof repository.getAllStock !==
        "function"
    ) {
        throw new Error(
            "Repository de estoque não configurado."
        );
    }

    const records =
        await repository.getAllStock();

    if (!Array.isArray(records)) {
        throw new Error(
            "Repository de estoque retornou dados inválidos."
        );
    }

    const stockMap = new Map();

    for (const record of records) {

        const normalized =
            normalizeStockRecord(
                record,
                record?.id || ""
            );

        if (!normalized) {
            continue;
        }

        stockMap.set(
            normalized.sku,
            normalized
        );
    }

    return stockMap;
}
