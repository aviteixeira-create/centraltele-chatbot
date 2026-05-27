// ===============================
// CHATBOT WHATSAPP CLOUD API
// COMPLETO, PROFISSIONAL E GRATUITO
// ===============================

import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// COLE AQUI SEUS DADOS DA META
const TOKEN = process.env.TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "centraltele";

// ===============================
// ENVIAR MENSAGEM
// ===============================
async function sendMessage(to, message) {
  await axios.post(
    `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: message },
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}

// ===============================
// WEBHOOK DE VERIFICAÇÃO
// ===============================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ===============================
// RECEBER MENSAGENS
// ===============================
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body?.toLowerCase() || "";

      // MENU PRINCIPAL
      if (text === "oi" || text === "olá" || text === "menu") {
        await sendMessage(
          from,
          "Olá! 👋 Bem-vindo à CentralTele.\n\nEscolha uma opção:\n\n1️⃣ Atendimento humano\n2️⃣ Fazer orçamento\n3️⃣ Suporte técnico\n4️⃣ Informações da empresa"
        );
      }

      // ATENDIMENTO HUMANO
      else if (text === "1") {
        await sendMessage(
          from,
          "Certo! Um atendente vai te responder em instantes. 😊"
        );
      }

      // ORÇAMENTO
      else if (text === "2") {
        await sendMessage(from, "Perfeito! Qual é o seu nome?");
      }

      // SUPORTE
      else if (text === "3") {
        await sendMessage(
          from,
          "Escolha uma opção:\n\n1️⃣ Problemas no WhatsApp\n2️⃣ Problemas no sistema\n3️⃣ Falar com suporte humano"
        );
      }

      // INFORMAÇÕES
      else if (text === "4") {
        await sendMessage(
          from,
          "Somos a CentralTele! 🚀\nAtendemos empresas com soluções de comunicação e automação."
        );
      }

      // RESPOSTA PADRÃO
      else {
        await sendMessage(
          from,
          "Desculpe, não entendi. Digite *menu* para ver as opções."
        );
      }
    }

    res.sendStatus(200);
  } catch (e) {
    console.error("Erro:", e);
    res.sendStatus(500);
  }
});

// ===============================
// INICIAR SERVIDOR
// ===============================
app.listen(3000, () => {
  console.log("Chatbot rodando na porta 3000");
});
