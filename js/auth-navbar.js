import {
    auth,
    googleProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "./firebase-config.js";

async function loginWithGoogle() {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        alert("Erro na autenticação. Tente novamente.");
    }
}

async function logoutUser() {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
}

onAuthStateChanged(auth, (user) => {
    const btnLogin = document.getElementById("btn-login");
    const userInfo = document.getElementById("user-info");
    const userName = document.getElementById("user-display-name");

    if (user) {
        btnLogin?.classList.add("d-none");

        if (userInfo) {
            userInfo.classList.remove("d-none");
            userInfo.classList.add("d-flex");
        }

        const displayName =
            user.displayName ||
            user.email?.split("@")[0] ||
            "Usuário";

        if (userName) {
            userName.textContent = `Olá, ${displayName}`;
        }
    } else {
        btnLogin?.classList.remove("d-none");

        if (userInfo) {
            userInfo.classList.add("d-none");
            userInfo.classList.remove("d-flex");
        }
    }
});

window.loginWithGoogle = loginWithGoogle;
window.logoutUser = logoutUser;
