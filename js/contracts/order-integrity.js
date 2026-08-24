/**
 * Validador de Integridade Financeira — Pedido V1
 *
 * Este módulo apenas valida um pedido.
 * Não altera Firestore e não executa nenhuma automação.
 */

const EPSILON = 0.000001;

function isValidNumber(value) {
    return Number.isFinite(Number(value));
}

function approximatelyEqual(a, b) {
    return Math.abs(Number(a) - Number(b)) < EPSILON;
}

/**
 * Valida a integridade financeira dos itens e totais do pedido.
 *
 * Regras:
 * item.total = price × quantity
 * totals.subtotal = soma dos itens
 * totals.total = subtotal - discount
 */
export function validateOrderIntegrity(order) {
    const errors = [];

    if (!order || typeof order !== "object") {
        return {
            valid: false,
            errors: ["Pedido inválido."]
        };
    }

    if (!Array.isArray(order.items) || order.items.length === 0) {
        errors.push("Pedido deve possuir pelo menos um item.");
    }

    if (!order.totals || typeof order.totals !== "object") {
        errors.push("Pedido deve possuir totals.");
    }

    if (Array.isArray(order.items)) {
        let calculatedSubtotal = 0;

        order.items.forEach((item, index) => {
            const price = Number(item?.price);
            const quantity = Number(item?.quantity);
            const total = Number(item?.total);

            if (!isValidNumber(price) || price < 0) {
                errors.push(`Item ${index}: preço inválido.`);
            }

            if (!Number.isInteger(quantity) || quantity <= 0) {
                errors.push(`Item ${index}: quantidade inválida.`);
            }

            if (!isValidNumber(total) || total < 0) {
                errors.push(`Item ${index}: total inválido.`);
            }

            if (
                isValidNumber(price) &&
                Number.isInteger(quantity) &&
                quantity > 0 &&
                isValidNumber(total)
            ) {
                const expectedTotal = price * quantity;

                if (!approximatelyEqual(total, expectedTotal)) {
                    errors.push(
                        `Item ${index}: total não corresponde a preço × quantidade.`
                    );
                }

                calculatedSubtotal += expectedTotal;
            }
        });

        if (order.totals) {
            const subtotal = Number(order.totals.subtotal);

            if (!isValidNumber(subtotal) || subtotal < 0) {
                errors.push("Subtotal inválido.");
            } else if (!approximatelyEqual(subtotal, calculatedSubtotal)) {
                errors.push(
                    "Subtotal não corresponde à soma dos itens."
                );
            }
        }
    }

    if (order.totals) {
        const subtotal = Number(order.totals.subtotal);
        const discount = Number(order.totals.discount);
        const total = Number(order.totals.total);

        if (!isValidNumber(discount) || discount < 0) {
            errors.push("Desconto inválido.");
        }

        if (!isValidNumber(total) || total < 0) {
            errors.push("Total do pedido inválido.");
        }

        if (
            isValidNumber(subtotal) &&
            isValidNumber(discount) &&
            isValidNumber(total)
        ) {
            const expectedTotal = subtotal - discount;

            if (expectedTotal < 0) {
                errors.push(
                    "Desconto não pode ser maior que o subtotal."
                );
            } else if (!approximatelyEqual(total, expectedTotal)) {
                errors.push(
                    "Total não corresponde a subtotal - desconto."
                );
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
