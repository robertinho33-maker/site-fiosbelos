const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Função para definir papel de usuário
exports.setUserRole = functions.https.onCall(async (data, context) => {
  // Apenas admins podem atribuir papéis
  if (context.auth.token.role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Somente admins podem atribuir papéis."
    );
  }

  const uid = data.uid;
  const role = data.role; // "admin" ou "influencer"

  await admin.auth().setCustomUserClaims(uid, { role });

  return { message: `Papel ${role} atribuído ao usuário ${uid}` };
});
