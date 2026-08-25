/**
 * Contrato Estrutural do Pedido — V1
 *
 * Responsabilidade:
 * - validar a estrutura básica de um pedido;
 * - garantir a presença dos blocos obrigatórios;
 * - garantir tipos básicos;
 * - não calcular valores;
 * - não alterar Firestore.
 */

const REQUIRED_SCHEMA_VERSION = "1.0";

function isObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function addError(errors, message) {
    errors.push(message);
}

export function validateOrderSchema(order) {
    const errors = [];

    if (!isObject(order)) {
        return {
            valid: false,
            errors: ["Pedido deve ser um objeto."]
        };
    }

    // =====================================================
    // IDENTIDADE
    // =====================================================

    if (
        order.schemaVersion !==
        REQUIRED_SCHEMA_VERSION
    ) {
        addError(
            errors,
            `schemaVersion deve ser ${REQUIRED_SCHEMA_VERSION}.`
        );
    }

    if (
        typeof order.orderNumber !== "string" ||
        !order.orderNumber.trim()
    ) {
        addError(
            errors,
            "orderNumber é obrigatório."
        );
    }

    if (
        typeof order.customerId !== "string" ||
        !order.customerId.trim()
    ) {
        addError(
            errors,
            "customerId é obrigatório."
        );
    }

    // =====================================================
    // CLIENTE
    // =====================================================

    if (!isObject(order.customer)) {
        addError(
            errors,
            "customer é obrigatório."
        );
    } else {
        if (
            typeof order.customer.name !== "string" ||
            !order.customer.name.trim()
        ) {
            addError(
                errors,
                "customer.name é obrigatório."
            );
        }

        if (
            typeof order.customer.phone !== "string" ||
            !order.customer.phone.trim()
        ) {
            addError(
                errors,
                "customer.phone é obrigatório."
            );
        }

        if (
            !isObject(order.customer.address)
        ) {
            addError(
                errors,
                "customer.address é obrigatório."
            );
        }
    }

    // =====================================================
    // ITENS
    // =====================================================

    if (
        !Array.isArray(order.items) ||
        order.items.length === 0
    ) {
        addError(
            errors,
            "items deve possuir pelo menos um item."
        );
    }

    if (Array.isArray(order.items)) {
        order.items.forEach(
            (item, index) => {
                if (!isObject(item)) {
                    addError(
                        errors,
                        `items[${index}] deve ser um objeto.`
                    );
                    return;
                }

                if (
                    typeof item.id !== "string" ||
                    !item.id.trim()
                ) {
                    addError(
                        errors,
                        `items[${index}].id é obrigatório.`
                    );
                }

                if (
                    typeof item.name !== "string" ||
                    !item.name.trim()
                ) {
                    addError(
                        errors,
                        `items[${index}].name é obrigatório.`
                    );
                }

                if (
                    !Number.isFinite(
                        Number(item.price)
                    )
                ) {
                    addError(
                        errors,
                        `items[${index}].price inválido.`
                    );
                }

                if (
                    !Number.isInteger(
                        Number(item.quantity)
                    ) ||
                    Number(item.quantity) <= 0
                ) {
                    addError(
                        errors,
                        `items[${index}].quantity inválida.`
                    );
                }

                if (
                    !Number.isFinite(
                        Number(item.total)
                    )
                ) {
                    addError(
                        errors,
                        `items[${index}].total inválido.`
                    );
                }
            }
        );
    }

    // =====================================================
    // TOTAIS
    // =====================================================

    if (!isObject(order.totals)) {
        addError(
            errors,
            "totals é obrigatório."
        );
    } else {
        for (const field of [
            "subtotal",
            "discount",
            "total"
        ]) {
            if (
                !Number.isFinite(
                    Number(order.totals[field])
                )
            ) {
                addError(
                    errors,
                    `totals.${field} inválido.`
                );
            }
        }
    }

    // =====================================================
    // PAGAMENTO
    // =====================================================

    if (!isObject(order.payment)) {
        addError(
            errors,
            "payment é obrigatório."
        );
    } else {
        if (
            typeof order.payment.method !== "string" ||
            !order.payment.method.trim()
        ) {
            addError(
                errors,
                "payment.method é obrigatório."
            );
        }

        if (
            typeof order.payment.status !== "string" ||
            !order.payment.status.trim()
        ) {
            addError(
                errors,
                "payment.status é obrigatório."
            );
        }
    }

    // =====================================================
    // ENTREGA
    // =====================================================

    if (!isObject(order.fulfillment)) {
        addError(
            errors,
            "fulfillment é obrigatório."
        );
    } else if (
        typeof order.fulfillment.status !== "string" ||
        !order.fulfillment.status.trim()
    ) {
        addError(
            errors,
            "fulfillment.status é obrigatório."
        );
    }

    // =====================================================
    // COMISSÃO
    // =====================================================

    if (!isObject(order.commission)) {
        addError(
            errors,
            "commission é obrigatório."
        );
    } else {
        if (
            typeof order.commission.applicable !==
            "boolean"
        ) {
            addError(
                errors,
                "commission.applicable deve ser boolean."
            );
        }

        if (
            !Number.isFinite(
                Number(order.commission.amount)
            )
        ) {
            addError(
                errors,
                "commission.amount inválido."
            );
        }

        if (
            typeof order.commission.status !== "string" ||
            !order.commission.status.trim()
        ) {
            addError(
                errors,
                "commission.status é obrigatório."
            );
        }
    }

    // =====================================================
    // STATUS
    // =====================================================

    if (
        typeof order.status !== "string" ||
        !order.status.trim()
    ) {
        addError(
            errors,
            "status do pedido é obrigatório."
        );
    }

    // =====================================================
    // RESULTADO
    // =====================================================

    return {
        valid: errors.length === 0,
        errors
    };
}
