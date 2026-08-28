git diff --statgit add \
    js/admin.js \
    js/services/image-service.js \
    products.images.json \
    img/products
    /**
 * Image Service
 *
 * Fonte operacional das imagens dos produtos.
 *
 * Regra:
 * SKU -> imagem local
 *
 * O Admin não deve depender de product.image.
 */

const IMAGE_DIRECTORY = "./img/products";

const IMAGE_EXTENSIONS = [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp"
];

export function getProductImage(sku) {
    const normalizedSku =
        String(sku || "").trim();

    if (!normalizedSku) {
        return null;
    }

    /*
     * O catálogo de imagens é sincronizado previamente.
     *
     * Como o navegador não pode verificar a existência
     * de arquivos locais de forma síncrona, usamos PNG
     * como extensão operacional padrão.
     *
     * O fallback do elemento <img> tratará extensões
     * alternativas.
     */
    return `${IMAGE_DIRECTORY}/${encodeURIComponent(normalizedSku)}.png`;
}

export function getProductImageCandidates(sku) {
    const normalizedSku =
        String(sku || "").trim();

    if (!normalizedSku) {
        return [];
    }

    return IMAGE_EXTENSIONS.map(
        extension =>
            `${IMAGE_DIRECTORY}/${encodeURIComponent(normalizedSku)}${extension}`
    );
}

export function getProductImageFromElement(
    element,
    sku
) {
    const candidates =
        getProductImageCandidates(sku);

    if (!element || !candidates.length) {
        return;
    }

    let index = 0;

    element.onerror = () => {
        index++;

        if (index < candidates.length) {
            element.src = candidates[index];
        } else {
            element.onerror = null;
            element.removeAttribute("src");
        }
    };

    element.src = candidates[0];
}
