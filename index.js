import express from "express";
import axios from "axios";
import { google } from "googleapis";
import path from "path";

const app = express();
app.use(express.json());

// Caminho correto do credentials.json (local + Render)
const keyPath = process.env.NODE_ENV === "production"
  ? "/etc/secrets/credentials.json"
  : path.resolve("credentials.json");

// Autenticação Google Sheets
const auth = new google.auth.GoogleAuth({
  keyFile: keyPath,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });

// ID da planilha
const SPREADSHEET_ID = "1MPvz5s6ogt6h8uLFsLQ2glmjiWW30lRQLt6blwTwfPo";

// Função para buscar etapa do funil
async function getEtapa(numero) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Funil!A:B"
    });

    const rows = response.data.values;
    if (!rows) return null;

    const etapa = rows.find(r => r[0] === numero);
    return etapa ? etapa[1] : null;

  } catch (error) {
    console.error("Erro ao buscar etapa:", error);
    return null;
  }
}

// Função para salvar dados na planilha
async function salvarDados(nome, produto, info, telefone) {
  try {
    const data = [
      [nome, produto, info, telefone, new Date().toLocaleDateString(), new Date().toLocaleTimeString()]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Dados!A:F",
      valueInputOption: "RAW",
      requestBody: { values: data }
    });

  } catch (error) {
    console.error("Erro ao salvar dados:", error);
  }
}

// Webhook do WhatsApp
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body?.trim() || "";

    console.log("📩 Mensagem:", from, text);

    // Exemplo de fluxo simples
    if (text.toLowerCase() === "oi" || text.toLowerCase() === "menu") {
      await enviarMensagem(from, "Olá! Qual seu nome?");
      return res.sendStatus(200);
    }

    // Aqui você continua seu fluxo...
    await enviarMensagem(from, "Recebi sua mensagem! Em breve respondo.");

    res.sendStatus(200);

  } catch (error) {
    console.error("Erro no webhook:", error);
    res.sendStatus(500);
  }
});

// Enviar mensagem pelo WhatsApp Cloud API
async function enviarMensagem(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/1129395576926383/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer EAAa06y1g2rEBRuzQxeBXpxZCowKtTiLNquZCfVdiTI8w2ESXpCtgbZBx2ZBSVhQJi36L3b0MjkkZAc0xABZBZBfKCMpe6cT7f5u0WB8nOZBnMkRJn9jCDsodEDTmJlypf0YyjHXktbKZA6JpwOXvwG8yOvcZAJt25CwZArEwrvVTcZCX0amNHWVWrbQSsqxlt065JgZDZD`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error.response?.data || error);
  }
}

// Webhook de verificação
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "EAAa06y1g2rEBRuzQxeBXpxZCowKtTiLNquZCfVdiTI8w2ESXpCtgbZBx2ZBSVhQJi36L3b0MjkkZAc0xABZBZBfKCMpe6cT7f5u0WB8nOZBnMkRJn9jCDsodEDTmJlypf0YyjHXktbKZA6JpwOXvwG8yOvcZAJt25CwZArEwrvVTcZCX0amNHWVWrbQSsqxlt065JgZDZD";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Servidor
app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
