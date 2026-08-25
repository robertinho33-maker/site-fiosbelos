import {
    validateOrderSchema
} from "../../js/contracts/order-schema.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error(
            `TESTE FALHOU: ${message}`
        );
    }
}

const validOrder = {
    schemaVersion: "1.0",
    orderNumber: "PED-000001",
    customerId: "customer_123",

    customer: {
        name: "Cliente Teste",
        email: "teste@example.com",
        phone: "11999999999",
        address: {}
    },

    items: [
        {
            id: "A",
            sku: "A",
            name: "Produto Teste",
            price: 100,
            quantity: 2,
            total: 200
        }
    ],

    totals: {
        subtotal: 200,
        discount: 20,
        total: 180
    },

    payment: {
        method: "Pix",
        status: "PENDENTE"
    },

    fulfillment: {
        status: "PENDENTE"
    },

    coupon: null,

    commission: {
        applicable: false,
        amount: 0,
        status: "NAO_APLICAVEL"
    },

    status: "PENDENTE",

    createdAt: {},
    updatedAt: {}
};

/**
 * Pedido válido
 */
{
    const result =
        validateOrderSchema(
            validOrder
        );

    assert(
        result.valid === true,
        "pedido válido deveria passar"
    );
}

/**
 * Schema incorreto
 */
{
    const result =
        validateOrderSchema({
            ...validOrder,
            schemaVersion: "9.9"
        });

    assert(
        result.valid === false,
        "schema inválido deveria ser rejeitado"
    );
}

/**
 * Sem itens
 */
{
    const result =
        validateOrderSchema({
            ...validOrder,
            items: []
        });

    assert(
        result.valid === false,
        "pedido sem itens deveria ser rejeitado"
    );
}

/**
 * Sem cliente
 */
{
    const result =
        validateOrderSchema({
            ...validOrder,
            customer: null
        });

    assert(
        result.valid === false,
        "pedido sem cliente deveria ser rejeitado"
    );
}

/**
 * Quantidade inválida
 */
{
    const result =
        validateOrderSchema({
            ...validOrder,
            items: [
                {
                    ...validOrder.items[0],
                    quantity: 1.5
                }
            ]
        });

    assert(
        result.valid === false,
        "quantidade fracionada deveria ser rejeitada"
    );
}

/**
 * Totais inválidos
 */
{
    const result =
        validateOrderSchema({
            ...validOrder,
            totals: {
                subtotal: "abc",
                discount: 0,
                total: 0
            }
        });

    assert(
        result.valid === false,
        "totais inválidos deveriam ser rejeitados"
    );
}

console.log(
    "TODOS OS TESTES DE SCHEMA PASSARAM."
);
