/**
 * Contrato de Estados Operacionais — Pedido V1
 *
 * Vocabulário oficial dos estados.
 * Este arquivo não contém regras de transição ou automações.
 */

export const ORDER_STATUS = Object.freeze({
    PENDENTE: "Pendente",
    CONFIRMADO: "Confirmado",
    EM_PROCESSAMENTO: "Em processamento",
    CONCLUIDO: "Concluido",
    CANCELADO: "Cancelado"
});

export const PAYMENT_STATUS = Object.freeze({
    PENDENTE: "Pendente",
    PAGO: "Pago",
    RECUSADO: "Recusado",
    CANCELADO: "Cancelado"
});

export const FULFILLMENT_STATUS = Object.freeze({
    PENDENTE: "Pendente",
    PREPARANDO: "Preparando",
    ENVIADO: "Enviado",
    ENTREGUE: "Entregue",
    CANCELADO: "Cancelado"
});

export const COMMISSION_STATUS = Object.freeze({
    NAO_APLICAVEL: "Nao aplicavel",
    PENDENTE: "Pendente",
    LIBERADA: "Liberada",
    PAGA: "Paga",
    CANCELADA: "Cancelada"
});
