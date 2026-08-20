import express from "express";
import cors from "cors";
import helmet from "helmet";
import admin from "firebase-admin";

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

// Inicializa Firebase Admin com credenciais
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

// Rota de login (valida token do Firebase)
app.post("/login", async (req, res) => {
  const { token } = req.body;

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    res.json({ message: "Login realizado com sucesso", user: decoded });
  } catch (error) {
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
});

app.listen(3000, () => console.log("Servidor rodando em http://localhost:3000"));
