import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// 🔐 CONFIGURAÇÕES DA META
const VERIFY_TOKEN = "centraltele";
const TOKEN = "EAAa06y1g2rEBRnRuaZCqQQv30ZCayLFC2nkdnVDGDMJ85LzYZAIlk5IdlHefoMdgOr9eoH8tgOhZBxY6V2BI7Dsrhste317RFxEOMHA6uQ63PhkUwRSjnUjAS5hkZBx5Try26hj8GPq4FNuej1n7g8BT03PvZAZBzhpK8PPTfmm441mrM5t5vAGqynmUXqr6UGmf99nwIU2RgZByRTzHaB8ZC8QVj4Rvk2ZAiwF1kMhLgwVYVt3dEoVLqXlv1Gfk0o4gN8MkInZBSjHHiA0K2JQUtZAu";
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
