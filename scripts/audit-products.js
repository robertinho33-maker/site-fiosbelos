const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const FILE = "ecocsv - products1.csv";
const OUTPUT = "products.normalized.json";

const REQUIRED_COLUMNS = [
    "Produto",
    "peso",
    "Preço",
    "Categoria",
    "Estoque",
    "Descrição",
    "SKU",
    "Imagem"
];

function normalize(value) {
    return String(value ?? "").trim();
}

function parsePrice(value) {
    const raw = normalize(value);

    if (!raw) {
        return null;
    }

    const normalized = raw
        .replace(/R\$\s*/gi, "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim();

    const number = Number(normalized);

    return Number.isFinite(number) && number >= 0
        ? number
        : null;
}

function normalizeStock(value) {
    const stock = normalize(value);

    if (!stock) {
        return {
            stockStatus: "unknown",
            stockQuantity: null
        };
    }

    // O CSV atual informa apenas disponibilidade,
    // não quantidade física.
    if (/^em estoque$/i.test(stock)) {
        return {
            stockStatus: "in_stock",
            stockQuantity: null
        };
    }

    if (/^(sem estoque|fora de estoque|esgotado)$/i.test(stock)) {
        return {
            stockStatus: "out_of_stock",
            stockQuantity: 0
        };
    }

    const numeric = Number(
        stock.replace(/\./g, "").replace(",", ".")
    );

    if (Number.isFinite(numeric) && numeric >= 0) {
        return {
            stockStatus: numeric > 0 ? "in_stock" : "out_of_stock",
            stockQuantity: numeric
        };
    }

    return {
        stockStatus: "unknown",
        stockQuantity: null
    };
}

function readCSV() {
    const filePath = path.resolve(FILE);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${FILE}`);
    }

    const content = fs.readFileSync(filePath, "utf8");

    return parse(content, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: false,
        trim: true
    });
}

function validateColumns(rows) {
    if (!rows.length) {
        throw new Error("O CSV não possui produtos.");
    }

    const columns = Object.keys(rows[0]);

    const missing = REQUIRED_COLUMNS.filter(
        column => !columns.includes(column)
    );

    if (missing.length) {
        throw new Error(
            `Colunas obrigatórias ausentes: ${missing.join(", ")}`
        );
    }
}

function audit(rows) {
    const errors = [];
    const warnings = [];

    const skuMap = new Map();

    let invalidPrices = 0;
    let missingNames = 0;
    let missingCategories = 0;
    let missingImages = 0;
    let unknownStock = 0;

    const products = rows.map((row, index) => {
        const line = index + 2;

        const name = normalize(row["Produto"]);
        const weight = normalize(row["peso"]);
        const price = parsePrice(row["Preço"]);
        const category = normalize(row["Categoria"]);
        const description = normalize(row["Descrição"]);
        const sku = normalize(row["SKU"]);
        const image = normalize(row["Imagem"]);

        const stock = normalizeStock(row["Estoque"]);

        if (!sku) {
            errors.push(`Linha ${line}: SKU ausente.`);
        } else {
            if (!skuMap.has(sku)) {
                skuMap.set(sku, []);
            }

            skuMap.get(sku).push(line);
        }

        if (!name) {
            missingNames++;
            errors.push(`Linha ${line}: Produto sem nome.`);
        }

        if (price === null) {
            invalidPrices++;
            errors.push(
                `Linha ${line}: preço inválido "${row["Preço"]}".`
            );
        }

        if (!category) {
            missingCategories++;
            warnings.push(
                `Linha ${line}: categoria ausente.`
            );
        }

        if (!image) {
            missingImages++;
            warnings.push(
                `Linha ${line}: imagem ausente.`
            );
        }

        if (stock.stockStatus === "unknown") {
            unknownStock++;

            warnings.push(
                `Linha ${line}: estoque não reconhecido "${row["Estoque"]}".`
            );
        }

        return {
            sku,
            name,
            weight,
            price,
            category,
            stockStatus: stock.stockStatus,
            stockQuantity: stock.stockQuantity,
            description,
            image
        };
    });

    const duplicatedSKUs = [...skuMap.entries()]
        .filter(([, lines]) => lines.length > 1);

    for (const [sku, lines] of duplicatedSKUs) {
        errors.push(
            `SKU duplicado "${sku}" nas linhas ${lines.join(", ")}.`
        );
    }

    return {
        products,
        errors,
        warnings,
        duplicatedSKUs,
        stats: {
            total: products.length,
            skus: skuMap.size,
            invalidPrices,
            missingNames,
            missingCategories,
            missingImages,
            unknownStock,
            inStock: products.filter(
                product => product.stockStatus === "in_stock"
            ).length,
            outOfStock: products.filter(
                product => product.stockStatus === "out_of_stock"
            ).length,
            unknownStockCount: products.filter(
                product => product.stockStatus === "unknown"
            ).length
        }
    };
}

function main() {
    console.log("");
    console.log("=== AUDITORIA DO CATÁLOGO ===");
    console.log("");

    let rows;

    try {
        rows = readCSV();
    } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
    }

    try {
        validateColumns(rows);
    } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
    }

    const result = audit(rows);

    const {
        products,
        errors,
        warnings,
        duplicatedSKUs,
        stats
    } = result;

    console.log(`Produtos encontrados: ${stats.total}`);
    console.log("");

    console.log("=== COLUNAS ===");

    for (const column of REQUIRED_COLUMNS) {
        console.log(`✅ ${column}`);
    }

    console.log("");

    console.log("=== SKUs ===");
    console.log(`SKUs únicos: ${stats.skus}`);
    console.log(`SKUs duplicados: ${duplicatedSKUs.length}`);
    console.log(`Produtos sem SKU: ${errors.filter(
        error => error.includes("SKU ausente")
    ).length}`);

    console.log("");

    console.log("=== PREÇOS ===");
    console.log(`Preços inválidos: ${stats.invalidPrices}`);

    console.log("");

    console.log("=== ESTOQUE ===");
    console.log(`Em estoque: ${stats.inStock}`);
    console.log(`Fora de estoque: ${stats.outOfStock}`);
    console.log(`Status desconhecido: ${stats.unknownStockCount}`);

    console.log("");
    console.log("=== OUTROS CAMPOS ===");
    console.log(`Produtos sem nome: ${stats.missingNames}`);
    console.log(`Produtos sem categoria: ${stats.missingCategories}`);
    console.log(`Produtos sem imagem: ${stats.missingImages}`);

    if (warnings.length) {
        console.log("");
        console.log("=== AVISOS ===");

        warnings.slice(0, 20).forEach(warning => {
            console.log(`⚠️ ${warning}`);
        });

        if (warnings.length > 20) {
            console.log(
                `⚠️ ... e mais ${warnings.length - 20} avisos.`
            );
        }
    }

    if (errors.length) {
        console.log("");
        console.log("=== ERROS ===");

        errors.slice(0, 30).forEach(error => {
            console.log(`❌ ${error}`);
        });

        if (errors.length > 30) {
            console.log(
                `❌ ... e mais ${errors.length - 30} erros.`
            );
        }

        console.log("");
        console.log("❌ Catálogo NÃO foi exportado.");
        process.exit(1);
    }

    fs.writeFileSync(
        OUTPUT,
        JSON.stringify(products, null, 2),
        "utf8"
    );

    console.log("");
    console.log("=== EXPORTAÇÃO ===");
    console.log(`✅ ${OUTPUT} criado com sucesso.`);
    console.log(`✅ ${products.length} produtos normalizados.`);

    console.log("");
    console.log("=== AMOSTRA ===");
    console.log(JSON.stringify(products.slice(0, 3), null, 2));

    console.log("");
    console.log("=== FIM ===");
    console.log("✅ Catálogo pronto para a próxima etapa.");
    console.log("");
}

main();
