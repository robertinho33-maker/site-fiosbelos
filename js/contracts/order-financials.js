/**
 * Contrato Financeiro do Pedido — V1
 *
 * Responsabilidade:
 * - validar itens financeiros;
 * - calcular subtotal;
 * - calcular desconto;
 * - calcular total;
 * - calcular comissão.
 *
 * Este módulo:
 * - NÃO altera Firestore;
 * - NÃO altera o carrinho;
 * - NÃO salva dados;
 * - NÃO executa operações externas.
 */

const EPSILON = 0.000001;

function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
}

function approximatelyEqual(a, b) {
    return Math.abs(
        Number(a) - Number(b)
    ) < EPSILON;
}

function validateItem(item, index) {
    if (!item || typeof item !== "object") {
        throw new Error(
            `Item ${index} inválido para cálculo financeiro.`
        );
    }

    const price = Number(item.price);
    const quantity = Number(item.quantity);

    if (
        !isFiniteNumber(price) ||
        price < 0
    ) {
        throw new Error(
            `Item ${index}: preço inválido.`
        );
    }

    if (
        !Number.isInteger(quantity) ||
        quantity <= 0
    ) {
        throw new Error(
            `Item ${index}: quantidade inválida.`
        );
    }

    return {
        price,
        quantity
    };
}

function calculateSubtotal(items) {
    if (!Array.isArray(items)) {
        throw new Error(
            "Itens do pedido devem ser um array."
        );
    }

    if (items.length === 0) {
        throw new Error(
            "Pedido deve possuir pelo menos um item."
        );
    }

    return items.reduce(
        (sum, item, index) => {
            const {
                price,
                quantity
            } = validateItem(item, index);

            return sum + (
                price * quantity
            );
        },
        0
    );
}

function calculateDiscount(
    subtotal,
    coupon
) {
    if (!coupon) {
        return 0;
    }

    if (
        typeof coupon !== "object"
    ) {
        throw new Error(
            "Cupom inválido."
        );
    }

    const value = Number(
        coupon.value
    );

    if (
        !isFiniteNumber(value) ||
        value < 0
    ) {
        throw new Error(
            "Valor de desconto inválido."
        );
    }

    let discount = 0;

    if (
        coupon.type === "percent"
    ) {
        if (value > 100) {
            throw new Error(
                "Percentual de desconto inválido."
            );
        }

        discount =
            subtotal * value / 100;
    } else if (
        coupon.type === "fixed"
    ) {
        discount = value;
    } else {
        throw new Error(
            "Tipo de cupom inválido."
        );
    }

    return Math.min(
        Math.max(discount, 0),
        subtotal
    );
}

function calculateCommission(
    subtotal,
    discount,
    coupon
) {
    if (!coupon) {
        return 0;
    }

    const commissionPercent =
        Number(
            coupon.commissionPercent || 0
        );

    if (
        !isFiniteNumber(
            commissionPercent
        ) ||
        commissionPercent < 0 ||
        commissionPercent > 100
    ) {
        throw new Error(
            "Percentual de comissão inválido."
        );
    }

    const commissionBase =
        subtotal - discount;

    return (
        commissionBase *
        commissionPercent
    ) / 100;
}

export function calculateOrderFinancials(
    items = [],
    coupon = null
) {
    const subtotal =
        calculateSubtotal(items);

    const discount =
        calculateDiscount(
            subtotal,
            coupon
        );

    const total =
        subtotal - discount;

    const commission =
        calculateCommission(
            subtotal,
            discount,
            coupon
        );

    return {
        subtotal,
        discount,
        total,
        commission
    };
}
