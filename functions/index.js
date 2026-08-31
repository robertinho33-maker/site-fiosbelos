const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const ALLOWED_ROLES = new Set([
  "client",
  "influencer",
  "master"
]);

function assertAuthenticated(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "É necessário estar autenticado."
    );
  }
}

function assertMaster(context) {
  assertAuthenticated(context);

  if (context.auth.token.role !== "master") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Somente usuários master podem atribuir papéis."
    );
  }
}

function cleanOptionalString(value, maxLength = 160) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

exports.setUserRole = functions.https.onCall(
  async (data, context) => {
    assertMaster(context);

    const uid = cleanOptionalString(data?.uid, 128);
    const role = cleanOptionalString(data?.role, 32);

    if (!uid || !ALLOWED_ROLES.has(role)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Informe um uid válido e um papel permitido."
      );
    }

    let targetUser;

    try {
      targetUser = await admin.auth().getUser(uid);
    } catch (error) {
      console.error(
        "Usuário não encontrado ao atribuir papel:",
        error
      );

      throw new functions.https.HttpsError(
        "not-found",
        "O usuário informado não existe no Firebase Authentication."
      );
    }

    const profileData = {
      uid,
      role,
      email: targetUser.email || "",
      displayName: cleanOptionalString(
        data?.displayName || targetUser.displayName || "",
        120
      ),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (role === "influencer") {
      profileData.influencer = {
        publicName: cleanOptionalString(
          data?.publicName || profileData.displayName,
          120
        ),
        couponCode: cleanOptionalString(
          data?.couponCode,
          40
        ).toUpperCase(),
        commissionPercent: Number.isFinite(
          Number(data?.commissionPercent)
        )
          ? Math.max(
              0,
              Math.min(
                100,
                Number(data.commissionPercent)
              )
            )
          : 0,
        pixKey: cleanOptionalString(
          data?.pixKey,
          160
        )
      };
    }

    await Promise.all([
      admin.auth().setCustomUserClaims(
        uid,
        { role }
      ),

      db
        .collection("userProfiles")
        .doc(uid)
        .set(profileData, { merge: true })
    ]);

    return {
      uid,
      role,
      message:
        `Papel ${role} atribuído com sucesso. ` +
        "O usuário deve renovar a sessão para receber a nova claim."
    };
  }
);

exports.refreshUserRoleToken = functions.https.onCall(
  async (data, context) => {
    assertAuthenticated(context);

    const profileSnapshot = await db
      .collection("userProfiles")
      .doc(context.auth.uid)
      .get();

    const role = profileSnapshot.exists
      ? profileSnapshot.data().role
      : "client";

    if (!ALLOWED_ROLES.has(role)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "O perfil do usuário possui um papel inválido."
      );
    }

    await admin.auth().setCustomUserClaims(
      context.auth.uid,
      { role }
    );

    return { role };
  }
);
