/**
 * Testes da operação de comissão — V2
 *
 * O teste usa um Repository fake.
 * Não acessa Firebase.
 *
 * O Repository fake reproduz o contrato:
 * - getCommission()
 * - updateCommissionWithAudit()
 */

import assert from "node:assert/strict";

import {
    validateCommissionTransition,
    changeCommissionStatus
} from "../../js/services/commission-service.js";

import {
    COMMISSION_STATUS
} from "../../js/contracts/order-status.js";


// =========================================================
// REPOSITORY FAKE
// =========================================================

function createFakeRepository(initialCommission) {

    let commission = {
        ...initialCommission
    };

    const calls = [];

    return {
        calls,

        async getCommission(id) {

            calls.push({
                operation: "getCommission",
                id
            });

            if (id !== commission.id) {
                return null;
            }

            return {
                ...commission
            };
        },

        async updateCommissionWithAudit(
            id,
            changes,
            auditEvent
        ) {

            calls.push({
                operation: "updateCommissionWithAudit",
                id,
                changes,
                auditEvent
            });

            commission = {
                ...commission,
                ...changes
            };

            return {
                commission: {
                    ...commission
                },

                audit: {
                    id: "audit-001",
                    ...auditEvent,
                    commissionId: id
                }
            };
        }
    };
}


// =========================================================
// VALIDAÇÃO DE TRANSIÇÕES
// =========================================================

assert.equal(
    validateCommissionTransition(
        COMMISSION_STATUS.PENDENTE,
        COMMISSION_STATUS.LIBERADA
    ),
    true
);

assert.equal(
    validateCommissionTransition(
        COMMISSION_STATUS.LIBERADA,
        COMMISSION_STATUS.PAGA
    ),
    true
);

assert.equal(
    validateCommissionTransition(
        COMMISSION_STATUS.LIBERADA,
        COMMISSION_STATUS.CANCELADA
    ),
    true
);

assert.equal(
    validateCommissionTransition(
        COMMISSION_STATUS.PENDENTE,
        COMMISSION_STATUS.CANCELADA
    ),
    true
);


// =========================================================
// TRANSIÇÕES PROIBIDAS
// =========================================================

assert.equal(
    validateCommissionTransition(
        COMMISSION_STATUS.PAGA,
        COMMISSION_STATUS.PENDENTE
    ),
    false
);

assert.equal(
    validateCommissionTransition(
        COMMISSION_STATUS.PAGA,
        COMMISSION_STATUS.CANCELADA
    ),
    false
);

assert.equal(
    validateCommissionTransition(
        COMMISSION_STATUS.CANCELADA,
        COMMISSION_STATUS.PAGA
    ),
    false
);

assert.equal(
    validateCommissionTransition(
        COMMISSION_STATUS.NAO_APLICAVEL,
        COMMISSION_STATUS.PENDENTE
    ),
    false
);


// =========================================================
// PENDENTE → LIBERADA + AUDITORIA
// =========================================================

{
    const repository =
        createFakeRepository({
            id: "commission-001",
            payoutStatus:
                COMMISSION_STATUS.PENDENTE
        });

    const result =
        await changeCommissionStatus({
            commissionId: "commission-001",
            nextStatus:
                COMMISSION_STATUS.LIBERADA,
            repository
        });

    assert.equal(
        result.commission.payoutStatus,
        COMMISSION_STATUS.LIBERADA
    );

    assert.ok(result.audit);

    assert.equal(
        result.audit.commissionId,
        "commission-001"
    );

    assert.equal(
        result.audit.type,
        "ORDER_COMMISSION_CHANGED"
    );

    assert.equal(
        repository.calls.length,
        2
    );

    assert.equal(
        repository.calls[1].operation,
        "updateCommissionWithAudit"
    );

    assert.equal(
        repository.calls[1].changes.payoutStatus,
        COMMISSION_STATUS.LIBERADA
    );
}


// =========================================================
// LIBERADA → PAGA + AUDITORIA
// =========================================================

{
    const repository =
        createFakeRepository({
            id: "commission-002",
            payoutStatus:
                COMMISSION_STATUS.LIBERADA
        });

    const result =
        await changeCommissionStatus({
            commissionId: "commission-002",
            nextStatus:
                COMMISSION_STATUS.PAGA,
            repository
        });

    assert.equal(
        result.commission.payoutStatus,
        COMMISSION_STATUS.PAGA
    );

    assert.ok(
        result.commission.paidAt
    );

    assert.ok(result.audit);

    assert.equal(
        result.audit.commissionId,
        "commission-002"
    );
}


// =========================================================
// LIBERADA → CANCELADA + AUDITORIA
// =========================================================

{
    const repository =
        createFakeRepository({
            id: "commission-003",
            payoutStatus:
                COMMISSION_STATUS.LIBERADA
        });

    const result =
        await changeCommissionStatus({
            commissionId: "commission-003",
            nextStatus:
                COMMISSION_STATUS.CANCELADA,
            repository
        });

    assert.equal(
        result.commission.payoutStatus,
        COMMISSION_STATUS.CANCELADA
    );

    assert.ok(result.audit);

    assert.equal(
        result.audit.type,
        "ORDER_COMMISSION_CHANGED"
    );
}


// =========================================================
// COMISSÃO NÃO ENCONTRADA
// =========================================================

{
    const repository = {

        async getCommission() {
            return null;
        },

        async updateCommissionWithAudit() {
            throw new Error(
                "Não deveria persistir."
            );
        }
    };

    await assert.rejects(
        () =>
            changeCommissionStatus({
                commissionId:
                    "commission-inexistente",
                nextStatus:
                    COMMISSION_STATUS.LIBERADA,
                repository
            }),
        /Comissão não encontrada/
    );
}


// =========================================================
// STATUS INVÁLIDO
// =========================================================

{
    const repository =
        createFakeRepository({
            id: "commission-004",
            payoutStatus:
                COMMISSION_STATUS.PENDENTE
        });

    await assert.rejects(
        () =>
            changeCommissionStatus({
                commissionId:
                    "commission-004",
                nextStatus:
                    "Status inexistente",
                repository
            }),
        /Status de comissão inválido/
    );
}


// =========================================================
// TRANSIÇÃO INVÁLIDA
// =========================================================

{
    const repository =
        createFakeRepository({
            id: "commission-005",
            payoutStatus:
                COMMISSION_STATUS.PAGA
        });

    await assert.rejects(
        () =>
            changeCommissionStatus({
                commissionId:
                    "commission-005",
                nextStatus:
                    COMMISSION_STATUS.PENDENTE,
                repository
            }),
        /Transição de comissão inválida/
    );

    assert.equal(
        repository.calls.length,
        1
    );
}


// =========================================================
// ID AUSENTE
// =========================================================

await assert.rejects(
    () =>
        changeCommissionStatus({
            nextStatus:
                COMMISSION_STATUS.LIBERADA,

            repository:
                createFakeRepository({
                    id: "commission-006",
                    payoutStatus:
                        COMMISSION_STATUS.PENDENTE
                })
        }),
    /ID da comissão não informado/
);


// =========================================================
// STATUS AUSENTE
// =========================================================

await assert.rejects(
    () =>
        changeCommissionStatus({
            commissionId:
                "commission-007",

            repository:
                createFakeRepository({
                    id: "commission-007",
                    payoutStatus:
                        COMMISSION_STATUS.PENDENTE
                })
        }),
    /Novo status da comissão não informado/
);


// =========================================================
// RESULTADO
// =========================================================

console.log(
    "TODOS OS TESTES DE OPERAÇÃO DE COMISSÃO + AUDITORIA PASSARAM."
);
