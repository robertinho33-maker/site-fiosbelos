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

function validateCoupon(coupon) {
    if (coupon === null || coupon === undefined) {
        return null;
    }

    if (
        typeof coupon !== "object" ||
        Array.isArray(coupon)
    ) {
        throw new Error(
            "Cupom inválido."
        );
    }

    const code =
        String(coupon.code || "").trim();

    if (!code) {
        throw new Error(
            "Cupom sem código."
        );
    }

    if (
        coupon.active !== undefined &&
        coupon.active !== true
    ) {
        throw new Error(
            "Cupom inativo."
        );
    }

    const type =
        String(coupon.type || "")
            .trim()
            .toLowerCase();

    if (
        type !== "percent" &&
        type !== "fixed"
    ) {
        throw new Error(
            "Tipo de cupom inválido."
        );
    }

    const value =
        Number(coupon.value);

    if (
        !isFiniteNumber(value) ||
        value < 0
    ) {
        throw new Error(
            "Valor de desconto inválido."
        );
    }

    if (
        type === "percent" &&
        value > 100
    ) {
        throw new Error(
            "Percentual de desconto inválido."
        );
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

    return {
        ...coupon,
        code,
        type,
        value,
        commissionPercent
    };
}

function calculateDiscount(
    subtotal,
    coupon
) {
    if (!coupon) {
        return 0;
    }

    let discount = 0;

    if (
        coupon.type === "percent"
    ) {
        discount =
            subtotal *
            coupon.value /
            100;

    } else if (
        coupon.type === "fixed"
    ) {
        discount =
            coupon.value;

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

    const validatedCoupon =
        validateCoupon(coupon);

    const discount =
        calculateDiscount(
            subtotal,
            validatedCoupon
        );

    const total =
        subtotal - discount;

   const commission =
    calculateCommission(
        subtotal,
        discount,
        validatedCoupon
    );

    return {
        subtotal,
        discount,
        total,
        commission
    };
}
