import {
    calculateOrderFinancials
} from "../../js/contracts/order-financials.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error(
            `TESTE FALHOU: ${message}`
        );
    }
}

function assertEqual(
    actual,
    expected,
    message
) {
    if (actual !== expected) {
        throw new Error(
            `TESTE FALHOU: ${message} ` +
            `(esperado: ${expected}, recebido: ${actual})`
        );
    }
}

/**
 * TESTE 1
 * Subtotal simples
 */
{
    const result =
        calculateOrderFinancials([
            {
                id: "A",
                price: 100,
                quantity: 2
            }
        ]);

    assertEqual(
        result.subtotal,
        200,
        "subtotal"
    );

    assertEqual(
        result.discount,
        0,
        "desconto sem cupom"
    );

    assertEqual(
        result.total,
        200,
        "total"
    );
}

/**
 * TESTE 2
 * Cupom percentual
 */
{
    const result =
        calculateOrderFinancials(
            [
                {
                    id: "A",
                    price: 100,
                    quantity: 2
                }
            ],
            {
                type: "percent",
                value: 10,
                commissionPercent: 5
            }
        );

    assertEqual(
        result.subtotal,
        200,
        "subtotal com cupom"
    );

    assertEqual(
        result.discount,
        20,
        "desconto percentual"
    );

    assertEqual(
        result.total,
        180,
        "total com desconto"
    );

    assertEqual(
        result.commission,
        9,
        "comissão"
    );
}

/**
 * TESTE 3
 * Cupom fixo
 */
{
    const result =
        calculateOrderFinancials(
            [
                {
                    id: "A",
                    price: 100,
                    quantity: 2
                }
            ],
            {
                type: "fixed",
                value: 30
            }
        );

    assertEqual(
        result.discount,
        30,
        "desconto fixo"
    );

    assertEqual(
        result.total,
        170,
        "total após desconto"
    );
}

/**
 * TESTE 4
 * Desconto nunca pode ultrapassar subtotal
 */
{
    const result =
        calculateOrderFinancials(
            [
                {
                    id: "A",
                    price: 100,
                    quantity: 1
                }
            ],
            {
                type: "fixed",
                value: 500
            }
        );

    assertEqual(
        result.discount,
        100,
        "desconto limitado ao subtotal"
    );

    assertEqual(
        result.total,
        0,
        "total mínimo zero"
    );
}

/**
 * TESTE 5
 * Quantidade fracionada deve ser rejeitada
 */
{
    let rejected = false;

    try {
        calculateOrderFinancials([
            {
                id: "A",
                price: 100,
                quantity: 1.5
            }
        ]);
    } catch {
        rejected = true;
    }

    assert(
        rejected,
        "quantidade fracionada deve ser rejeitada"
    );
}

/**
 * TESTE 6
 * Preço negativo deve ser rejeitado
 */
{
    let rejected = false;

    try {
        calculateOrderFinancials([
            {
                id: "A",
                price: -10,
                quantity: 1
            }
        ]);
    } catch {
        rejected = true;
    }

    assert(
        rejected,
        "preço negativo deve ser rejeitado"
    );
}

/**
 * TESTE 7
 * Cupom percentual acima de 100%
 */
{
    let rejected = false;

    try {
        calculateOrderFinancials(
            [
                {
                    id: "A",
                    price: 100,
                    quantity: 1
                }
            ],
            {
                type: "percent",
                value: 101
            }
        );
    } catch {
        rejected = true;
    }

    assert(
        rejected,
        "cupom acima de 100% deve ser rejeitado"
    );
}

console.log(
    "TODOS OS TESTES FINANCEIROS PASSARAM."
);
