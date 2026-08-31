/**
 * Stock Contract — V1
 *
 * Responsabilidade:
 * - validar registros de estoque;
 * - normalizar SKU;
 * - normalizar quantidade;
 * - definir status operacional;
 *
 * O Contract não acessa Firebase.
 */

export const STOCK_STATUS = Object.freeze({
    IN_STOCK: "in_stock",
    OUT_OF_STOCK: "out_of_stock"
});


export function normalizeStockSKU(sku) {
    return String(sku || "").trim();
}


export function normalizeStockQuantity(quantity) {
    const value = Number(quantity);

    if (!Number.isFinite(value)) {
        return null;
    }

    if (!Number.isInteger(value) || value < 0) {
        return null;
    }

    return value;
}


export function getStockStatus(quantity) {
    const normalizedQuantity =
        normalizeStockQuantity(quantity);

    if (normalizedQuantity === null) {
        return "unknown";
    }

    return normalizedQuantity > 0
        ? STOCK_STATUS.IN_STOCK
        : STOCK_STATUS.OUT_OF_STOCK;
}


export function normalizeStockRecord(record, fallbackSku = "") {
    if (!record || typeof record !== "object") {
        return null;
    }

    const sku =
        normalizeStockSKU(
            record.sku || fallbackSku
        );

    if (!sku) {
        return null;
    }

    const quantity =
        normalizeStockQuantity(
            record.quantity
        );

    if (quantity === null) {
        return {
            sku,
            quantity: null,
            status: "unknown"
        };
    }

    return {
        ...record,
        sku,
        quantity,
        status: getStockStatus(quantity)
    };
}


export function validateStockRecord(record) {
    const errors = [];

    if (!record || typeof record !== "object") {
        return {
            valid: false,
            errors: ["Registro de estoque inválido."]
        };
    }

    const sku =
        normalizeStockSKU(record.sku);

    if (!sku) {
        errors.push(
            "SKU do estoque não informado."
        );
    }

    const quantity =
        normalizeStockQuantity(
            record.quantity
        );

    if (quantity === null) {
        errors.push(
            "Quantidade de estoque deve ser um número inteiro maior ou igual a zero."
        );
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
