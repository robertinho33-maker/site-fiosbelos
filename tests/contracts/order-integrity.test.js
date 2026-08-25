import {
    validateOrderIntegrity
} from "../../js/contracts/order-integrity.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error(
            `TESTE FALHOU: ${message}`
        );
    }
}

/**
 * Pedido válido
 */
{
    const result =
        validateOrderIntegrity({
            items: [
                {
                    id: "A",
                    price: 100,
                    quantity: 2,
                    total: 200
                },
                {
                    id: "B",
                    price: 50,
                    quantity: 1,
                    total: 50
                }
            ],
            totals: {
                subtotal: 250,
                discount: 25,
                total: 225
            }
        });

    assert(
        result.valid === true,
        "pedido válido deveria passar"
    );
}

/**
 * Subtotal adulterado
 */
{
    const result =
        validateOrderIntegrity({
            items: [
                {
                    id: "A",
                    price: 100,
                    quantity: 2,
                    total: 200
                }
            ],
            totals: {
                subtotal: 999,
                discount: 0,
                total: 999
            }
        });

    assert(
        result.valid === false,
        "subtotal adulterado deveria ser rejeitado"
    );
}

/**
 * Total adulterado
 */
{
    const result =
        validateOrderIntegrity({
            items: [
                {
                    id: "A",
                    price: 100,
                    quantity: 2,
                    total: 200
                }
            ],
            totals: {
                subtotal: 200,
                discount: 20,
                total: 999
            }
        });

    assert(
        result.valid === false,
        "total adulterado deveria ser rejeitado"
    );
}

/**
 * Item adulterado
 */
{
    const result =
        validateOrderIntegrity({
            items: [
                {
                    id: "A",
                    price: 100,
                    quantity: 2,
                    total: 999
                }
            ],
            totals: {
                subtotal: 200,
                discount: 0,
                total: 200
            }
        });

    assert(
        result.valid === false,
        "total do item adulterado deveria ser rejeitado"
    );
}

console.log(
    "TODOS OS TESTES DE INTEGRIDADE PASSARAM."
);
