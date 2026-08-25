import {
    ORDER_STATUS,
    PAYMENT_STATUS,
    FULFILLMENT_STATUS
} from "../../js/contracts/order-status.js";

import {
    canTransitionOrderStatus,
    validateOrderState
} from "../../js/contracts/order-state-machine.js";


function assert(condition, message) {
    if (!condition) {
        throw new Error(`TESTE FALHOU: ${message}`);
    }
}


/*
 * =========================================================
 * TRANSIÇÕES VÁLIDAS
 * =========================================================
 */

assert(
    canTransitionOrderStatus(
        ORDER_STATUS.PENDENTE,
        ORDER_STATUS.CONFIRMADO
    ),
    "Pendente → Confirmado deveria ser permitido."
);

assert(
    canTransitionOrderStatus(
        ORDER_STATUS.CONFIRMADO,
        ORDER_STATUS.EM_PROCESSAMENTO
    ),
    "Confirmado → Em processamento deveria ser permitido."
);

assert(
    canTransitionOrderStatus(
        ORDER_STATUS.EM_PROCESSAMENTO,
        ORDER_STATUS.CONCLUIDO
    ),
    "Em processamento → Concluido deveria ser permitido."
);

assert(
    canTransitionOrderStatus(
        ORDER_STATUS.PENDENTE,
        ORDER_STATUS.CANCELADO
    ),
    "Pendente → Cancelado deveria ser permitido."
);

assert(
    canTransitionOrderStatus(
        ORDER_STATUS.CONFIRMADO,
        ORDER_STATUS.CANCELADO
    ),
    "Confirmado → Cancelado deveria ser permitido."
);

assert(
    canTransitionOrderStatus(
        ORDER_STATUS.EM_PROCESSAMENTO,
        ORDER_STATUS.CANCELADO
    ),
    "Em processamento → Cancelado deveria ser permitido."
);


/*
 * =========================================================
 * TRANSIÇÕES INVÁLIDAS
 * =========================================================
 */

assert(
    !canTransitionOrderStatus(
        ORDER_STATUS.CONCLUIDO,
        ORDER_STATUS.CANCELADO
    ),
    "Concluido → Cancelado não deveria ser permitido."
);

assert(
    !canTransitionOrderStatus(
        ORDER_STATUS.CANCELADO,
        ORDER_STATUS.CONFIRMADO
    ),
    "Cancelado → Confirmado não deveria ser permitido."
);

assert(
    !canTransitionOrderStatus(
        ORDER_STATUS.PENDENTE,
        ORDER_STATUS.EM_PROCESSAMENTO
    ),
    "Pendente → Em processamento não deveria ser permitido."
);

assert(
    !canTransitionOrderStatus(
        ORDER_STATUS.CONFIRMADO,
        ORDER_STATUS.CONCLUIDO
    ),
    "Confirmado → Concluido não deveria ser permitido."
);


/*
 * =========================================================
 * ESTADO COERENTE
 * =========================================================
 */

const validOrder = {
    status: ORDER_STATUS.CONFIRMADO,

    payment: {
        status: PAYMENT_STATUS.PAGO
    },

    fulfillment: {
        status: FULFILLMENT_STATUS.PENDENTE
    },

    commission: {
        amount: 10,
        status: "Pendente"
    }
};

const validResult =
    validateOrderState(validOrder);

assert(
    validResult.valid,
    `Pedido válido foi rejeitado: ${validResult.errors.join(" | ")}`
);


/*
 * =========================================================
 * PEDIDO CONCLUÍDO SEM PAGAMENTO
 * =========================================================
 */

const invalidCompletedOrder = {
    status: ORDER_STATUS.CONCLUIDO,

    payment: {
        status: PAYMENT_STATUS.PENDENTE
    },

    fulfillment: {
        status: FULFILLMENT_STATUS.ENTREGUE
    }
};

const invalidResult =
    validateOrderState(invalidCompletedOrder);

assert(
    !invalidResult.valid,
    "Pedido concluído sem pagamento deveria ser rejeitado."
);


/*
 * =========================================================
 * ENTREGA SEM PAGAMENTO
 * =========================================================
 */

const invalidDeliveryOrder = {
    status: ORDER_STATUS.EM_PROCESSAMENTO,

    payment: {
        status: PAYMENT_STATUS.PENDENTE
    },

    fulfillment: {
        status: FULFILLMENT_STATUS.ENTREGUE
    }
};

const deliveryResult =
    validateOrderState(invalidDeliveryOrder);

assert(
    !deliveryResult.valid,
    "Entrega sem pagamento deveria ser rejeitada."
);


console.log(
    "TODOS OS TESTES DE MÁQUINA DE ESTADOS PASSARAM."
);
