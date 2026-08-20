import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from "../../js/firebase-config.js";

// Função de Login via Google
async function loginWithGoogle() {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        alert("Erro na autenticação. Tente novamente.");
    }
}

// Função de Logout
async function logoutUser() {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
}

// Monitora o Estado de Autenticação em tempo real
onAuthStateChanged(auth, (user) => {
    const btnLogin = document.getElementById('btn-login');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-display-name');

    if (user) {
        // Usuário conectado
        if (btnLogin) btnLogin.classList.add('d-none');
        if (userInfo) userInfo.classList.remove('d-none');
        if (userInfo) userInfo.classList.add('d-flex');
        
        const displayName = user.displayName || user.email.split('@')[0];
        if (userName) userName.textContent = `Olá, ${displayName}`;
    } else {
        // Usuário desconectado
        if (btnLogin) btnLogin.classList.remove('d-none');
        if (userInfo) {
            userInfo.classList.add('d-none');
            userInfo.classList.remove('d-flex');
        }
    }
});

// Exposição Global
window.loginWithGoogle = loginWithGoogle;
window.logoutUser = logoutUser;