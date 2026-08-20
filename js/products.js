/* =====================================================
   PRODUTOS
   ===================================================== */

const PRODUCTS_FILE = "ecocsv - products1.csv";

let products = [];
let visibleProducts = 9;
let currentCategory = "all";


/* =====================================================
   CARREGAR CSV
   ===================================================== */

async function loadProducts() {

    const grid = document.getElementById("products-grid");

    if (!grid) {
        return;
    }

    try {

        const response = await fetch(PRODUCTS_FILE);

        if (!response.ok) {
            throw new Error(
                `Erro ao carregar CSV: ${response.status}`
            );
        }

        const csvText = await response.text();

        products = parseCSV(csvText);

        createCategoryFilters();

        renderProducts();

    } catch (error) {

        console.error(
            "Erro ao carregar produtos:",
            error
        );

        grid.innerHTML = `
            <div class="col-12 text-center py-5">

                <i class="bi bi-exclamation-circle fs-1 text-primary"></i>

                <p class="text-muted mt-3">
                    Não foi possível carregar os produtos.
                </p>

            </div>
        `;
    }
}


/* =====================================================
   PARSER CSV
   ===================================================== */

function parseCSV(text) {

    const rows = [];
    let row = [];
    let value = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {

        const char = text[i];
        const next = text[i + 1];


        if (char === '"' && insideQuotes && next === '"') {

            value += '"';
            i++;

        }

        else if (char === '"') {

            insideQuotes = !insideQuotes;

        }

        else if (char === "," && !insideQuotes) {

            row.push(value);
            value = "";

        }

        else if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {

            if (value !== "" || row.length > 0) {

                row.push(value);

                rows.push(row);

                row = [];
                value = "";
            }

        }

        else {

            value += char;

        }

    }


    if (value !== "" || row.length > 0) {

        row.push(value);
        rows.push(row);

    }


    if (!rows.length) {
        return [];
    }


    const headers = rows[0].map(
        header => header.trim()
    );


    return rows
        .slice(1)
        .filter(row => row.some(value => value.trim() !== ""))
        .map(row => {

            const product = {};

            headers.forEach((header, index) => {

                product[header] =
                    (row[index] || "").trim();

            });

            return product;

        });
}


/* =====================================================
   CATEGORIAS
   ===================================================== */

function createCategoryFilters() {

    const container =
        document.getElementById("product-filters");

    if (!container) {
        return;
    }


    const categories = [
        ...new Set(
            products
                .map(product => product["Categoria"])
                .filter(Boolean)
        )
    ];


    categories.sort();


    container.innerHTML = `
        <button
            type="button"
            class="product-filter active"
            data-filter="all"
        >
            Todos
        </button>
    `;


    categories.forEach(category => {

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "product-filter";

        button.dataset.filter = category;

        button.textContent = category;


        button.addEventListener(
            "click",
            () => {

                currentCategory = category;

                visibleProducts = 9;

                document
                    .querySelectorAll(".product-filter")
                    .forEach(item =>
                        item.classList.remove("active")
                    );

                button.classList.add("active");

                renderProducts();

            }
        );


        container.appendChild(button);

    });


    const allButton =
        container.querySelector(
            '[data-filter="all"]'
        );


    allButton.addEventListener(
        "click",
        () => {

            currentCategory = "all";

            visibleProducts = 9;

            document
                .querySelectorAll(".product-filter")
                .forEach(item =>
                    item.classList.remove("active")
                );

            allButton.classList.add("active");

            renderProducts();

        }
    );
}


/* =====================================================
   RENDERIZAR
   ===================================================== */

function renderProducts() {

    const grid =
        document.getElementById("products-grid");

    const loading =
        document.getElementById("products-loading");


    if (!grid) {
        return;
    }


    let filteredProducts = products;


    if (currentCategory !== "all") {

        filteredProducts =
            products.filter(product =>
                product["Categoria"] === currentCategory
            );

    }


    const visible =
        filteredProducts.slice(
            0,
            visibleProducts
        );


    grid.innerHTML = "";


    visible.forEach(product => {

        grid.appendChild(
            createProductCard(product)
        );

    });


    updateLoadMore(
        filteredProducts.length
    );


    if (loading) {
        loading.remove();
    }
}


/* =====================================================
   CARD
   ===================================================== */

function createProductCard(product) {
    const col = document.createElement("div");
    col.className = "col-sm-6 col-lg-4";

    const name = product["Produto"] || "Produto";
    const category = product["Categoria"] || "Beleza";
    const description = product["Descrição"] || product["Descrição "] || "";
    const price = formatPrice(product["Preço"]);
    const stock = product["Estoque"] || "0";

    // Extrai a URL da imagem do produto (ajuste a chave do objeto conforme o seu CSV/JSON)
    const imageUrl = 
        product["Imagem"] || 
        product["Foto"] || 
        product["URL Imagem"] || 
        product["src"] || 
        "https://via.placeholder.com/700x700?text=Sem+Imagem"; // Fallback caso esteja sem imagem

    col.innerHTML = `
        <article class="product-card">
            <div class="product-visual">
                <img 
                    src="${escapeHTML(imageUrl)}" 
                    alt="${escapeHTML(name)}" 
                    class="product-image"
                    loading="lazy"
                />
            </div>

            <div class="product-content">
                <span class="product-category">
                    ${escapeHTML(category)}
                </span>

                <h3 class="product-name">
                    ${escapeHTML(name)}
                </h3>

                <p class="product-description">
                    ${escapeHTML(truncate(description, 110))}
                </p>

                <div class="product-footer">
                    <div>
                        <div class="product-price">
                            ${price}
                        </div>
                        <div class="product-stock">
                            ${stock} em estoque
                        </div>
                    </div>

                    <button
                        type="button"
                        class="product-button"
                        onclick="showProductDetails(this)"
                    >
                        Ver detalhes
                        <i class="bi bi-arrow-right"></i>
                    </button>
                </div>
            </div>
        </article>
    `;

    const button = col.querySelector(".product-button");
    button.dataset.product = JSON.stringify(product);

    return col;
}


/* =====================================================
   PAGINAÇÃO
   ===================================================== */

function updateLoadMore(total) {

    const button =
        document.getElementById(
            "load-more-products"
        );


    if (!button) {
        return;
    }


    if (visibleProducts >= total) {

        button.style.display = "none";

    } else {

        button.style.display = "inline-block";

    }
}


/* =====================================================
   VER MAIS
   ===================================================== */

document.addEventListener(
    "click",
    event => {

        if (
            event.target.id !==
            "load-more-products"
        ) {
            return;
        }


        visibleProducts += 9;

        renderProducts();

    }
);


/* =====================================================
   DETALHES
   ===================================================== */

function showProductDetails(button) {

    const product =
        JSON.parse(
            button.dataset.product
        );


    const name =
        product["Produto"] ||
        "Produto";


    const description =
        product["Descrição"] ||
        product["Descrição "] ||
        "Sem descrição disponível.";


    const price =
        formatPrice(
            product["Preço"]
        );


    alert(
        `${name}\n\n${description}\n\nPreço: ${price}`
    );
}


/* =====================================================
   PREÇO
   ===================================================== */

function formatPrice(value) {

    if (!value) {
        return "Consultar";
    }


    const normalized =
        String(value)
            .replace(/\./g, "")
            .replace(",", ".");


    const number =
        Number(normalized);


    if (Number.isNaN(number)) {
        return value;
    }


    return number.toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );
}


/* =====================================================
   TEXTO
   ===================================================== */

function truncate(text, limit) {

    if (!text) {
        return "";
    }


    if (text.length <= limit) {
        return text;
    }


    return (
        text.substring(0, limit).trim() +
        "..."
    );
}


/* =====================================================
   SEGURANÇA
   ===================================================== */

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =====================================================
   INICIAR
   ===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    loadProducts
);