import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// 🔐 CONFIGURAÇÕES DA META
const VERIFY_TOKEN = "centraltele";
const TOKEN = "EAAa06y1g2rEBRhevJii4ybZCOfKSRrntxmnvdwCivDtnUtTlnhzQwZCgPR0NQZBu8oqVA7xrWKRjiw8eWei7e2ANFAB5n5dIRIqBut7cHwUimmJ2DKZCO5GZATyZAJYdJa1jv2jYZA7fUYcXyTQBHBBM5ZAQ6ZCDclsFaeWUip4l4Df6slaOtECLnhJprbAc8ewtNZBCSZBFOov3hEotgO5WcoXrppPGX40eqRacmqnqqrnLWwtFgLD5aUX5g5eyV35Ta6kpbGMpKD1d7pZBH199P2Jo5ZAtugXT6V1vFBgZDZD";
const PHONE_NUMBER_ID = "1129395576926383";

// ======================================================
// ✅ WEBHOOK GET (VERIFICAÇÃO DA META)
// ======================================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado com sucesso!");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ======================================================
// ✅ WEBHOOK POST (RECEBIMENTO DE MENSAGENS)
// ======================================================
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messageObj = changes?.value?.messages?.[0];

    if (!messageObj) {
      return res.sendStatus(200);
    }

    const phone = messageObj.from;
    const message = messageObj.text?.body?.trim();

    console.log("📩 Mensagem recebida:", message, "de", phone);

    // ======================================================
    // 🔥 TRANSFERÊNCIA PARA ATENDENTE HUMANO
    // ======================================================
    if (message === "1") {
      await sendMessage(phone, "Certo! Vou te transferir para um atendente humano.");
      await sendMessage(
        phone,
        "Clique aqui para falar com o atendente: https://wa.me/5511966140453"
      );
      return res.sendStatus(200);
    }

    // ======================================================
    // 📌 MENU PRINCIPAL
    // ======================================================
    if (message === "oi" || message === "menu" || message === "olá") {
      await sendMessage(
        phone,
        "👋 Olá! Como posso ajudar?\n\n" +
        "1️⃣ Falar com um atendente humano\n" +
        "2️⃣ Informações sobre serviços\n" +
        "3️⃣ Horário de atendimento"
      );
      return res.sendStatus(200);
    }

    // ======================================================
    // 📌 OUTRAS OPÇÕES DO MENU
    // ======================================================
    if (message === "2") {
      await sendMessage(phone, "📄 Nossos serviços incluem suporte técnico, atendimento comercial e muito mais.");
      return res.sendStatus(200);
    }

    if (message === "3") {
      await sendMessage(phone, "🕒 Nosso horário de atendimento é das 08h às 18h, de segunda a sexta.");
      return res.sendStatus(200);
    }

    // ======================================================
    // 📌 RESPOSTA PADRÃO
    // ======================================================
    await sendMessage(
      phone,
      "Não entendi sua mensagem. Digite *menu* para ver as opções."
    );

    return res.sendStatus(200);

  } catch (error) {
    console.error("Erro no webhook:", error);
    return res.sendStatus(500);
  }
});

// ======================================================
// 📤 FUNÇÃO PARA ENVIAR MENSAGENS
// ======================================================
async function sendMessage(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error?.response?.data || error);
  }
}

// ======================================================
// 🚀 INICIAR SERVIDOR
// ======================================================
app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
