async function carregarInclude(id, arquivo) {

    const elemento = document.getElementById(id);

    if (!elemento) {
        console.warn(`Elemento #${id} não encontrado.`);
        return;
    }

    try {

        const resposta = await fetch(arquivo);

        if (!resposta.ok) {
            throw new Error(
                `Erro ${resposta.status}: ${arquivo}`
            );
        }

        const html = await resposta.text();

        elemento.innerHTML = html;

    } catch (erro) {

        console.error(
            `Erro ao carregar ${arquivo}:`,
            erro
        );

    }
}


document.addEventListener("DOMContentLoaded", () => {

    carregarInclude(
        "site-header",
        "includes/header.html"
    );

    carregarInclude(
        "site-footer",
        "includes/footer.html"
    );

});