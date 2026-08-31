import {
    auth,
    db,
    onAuthStateChanged
} from "./firebase-config.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ROLE_HOME = {
    master: "admin.html",
    influencer: "influencer.html",
    client: "index.html"
};

function getRequestedRole( ) {
    return document.body.dataset.requiredRole || "";
}

function showAuthError(message) {
    document.body.innerHTML = `
        <main style="min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui,sans-serif;background:#f8f9fa">
            <section style="max-width:520px;text-align:center;background:#fff;border:1px solid #e9ecef;border-radius:16px;padding:32px;box-shadow:0 12px 40px rgba(0,0,0,.08)">
                <h1 style="margin-top:0">Acesso não autorizado</h1>
                <p>${message}</p>
                <a href="index.html" style="display:inline-block;margin-top:12px;padding:12px 18px;border-radius:8px;background:#121212;color:#fff;text-decoration:none">Voltar para a loja</a>
            </section>
        </main>
    `;
}

async function resolveUserRole(user) {
    const tokenResult = await user.getIdTokenResult();
    const claimRole = tokenResult.claims.role;

    if (["master", "influencer", "client"].includes(claimRole)) {
        return claimRole;
    }

    const profileSnapshot = await getDoc(doc(db, "userProfiles", user.uid));
    const profileRole = profileSnapshot.exists()
        ? profileSnapshot.data().role
        : null;

    return ["master", "influencer", "client"].includes(profileRole)
        ? profileRole
        : "client";
}

export async function requireRole(requiredRole = getRequestedRole()) {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();

            if (!user) {
                window.location.replace(`login.html?redirect=${encodeURIComponent(window.location.pathname)}`);
                return;
            }

            try {
                const role = await resolveUserRole(user);

                if (requiredRole && role !== requiredRole) {
                    showAuthError("Sua conta não possui permissão para acessar esta área.");
                    return;
                }

                document.body.classList.remove("d-none");
                document.body.dataset.currentRole = role;
                document.body.dataset.currentUid = user.uid;
                resolve({ user, role });
            } catch (error) {
                console.error("Falha ao validar sessão:", error);
                showAuthError("Não foi possível validar sua sessão. Tente entrar novamente.");
            }
        });
    });
}

export async function redirectByRole(user) {
    const role = await resolveUserRole(user);
    const destination = ROLE_HOME[role] || "index.html";
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    if (currentPage !== destination) {
        window.location.replace(destination);
    }

    return role;
}

export { resolveUserRole };