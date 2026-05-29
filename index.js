import express from "express";
import axios from "axios";
import { google } from "googleapis";

const app = express();
app.use(express.json());

// 🔐 CONFIG META
const VERIFY_TOKEN = "centraltele";
const TOKEN = "SEU_TOKEN_AQUI";
const PHONE_NUMBER_ID = "1129395576926383";

// 🔐 CONFIG GOOGLE SHEETS
async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

const SPREADSHEET_ID = "1MPvz5s6ogt6h8uLFsLQ2glmjiWW30lRQLt6blwTwfPo";

// ======================================================
// 🔎 BUSCAR ETAPA DO CLIENTE
// ======================================================
async function getEtapa(phone) {
  const sheets = await getSheets();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "A:F",
  });

  const rows = resp.data.values || [];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][3] === phone) {
      return { etapa: rows[i][5], row: i + 1 };
    }
  }

  return { etapa: "inicio", row: null };
}

// ======================================================
// ✏️ SALVAR OU ATUALIZAR CLIENTE
// ======================================================
async function salvarDados(nome, produto, info, telefone, etapa) {
  const sheets = await getSheets();

  const data = new Date();
  const dataStr = data.toLocaleDateString("pt-BR");
  const horaStr = data.toLocaleTimeString("pt-BR");

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "A1",
    valueInputOption: "RAW",
    resource: {
      values: [[nome, produto, info, telefone, dataStr, horaStr, etapa]],
    },
  });
}

// ======================================================
// 📤 ENVIAR MENSAGEM
// ======================================================
async function sendMessage(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
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
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error?.response?.data || error);
  }
}

// ======================================================
// 🔐 VERIFICAÇÃO DO WEBHOOK
// ======================================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ======================================================
// 📩 RECEBIMENTO DE MENSAGENS
// ======================================================
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const phone = msg.from;
    const text = msg.text?.body?.trim() || "";

    console.log("📩 Mensagem:", phone, text);

    const { etapa } = await getEtapa(phone);

    // ======================================================
    // ETAPA 0 — INÍCIO
    // ======================================================
    if (etapa === "inicio") {
      await sendMessage(phone, "Olá!\nAqui é o assistente da CentralTele.\n\nQual seu nome?");
      await salvarDados("", "", "", phone, "aguardando_nome");
      return res.sendStatus(200);
    }

    // ======================================================
    // ETAPA 1 — RECEBER NOME
    // ======================================================
    if (etapa === "aguardando_nome") {
      const nome = text;

      await sendMessage(
        phone,
        `Prazer, ${nome}!\n\nMENU PRINCIPAL:\n\n1 - Qual produto está precisando?\n2 - Falar com Atendente\n3 - Falar com Suporte\n\nHorário de funcionamento:\nSeg a Sex: 9h às 18h\nSábado: 9h às 12h\nDomingos e Feriados: fechado`
      );

      await salvarDados(nome, "", "", phone, "menu_principal");
      return res.sendStatus(200);
    }

    // ======================================================
    // ETAPA 2 — MENU PRINCIPAL
    // ======================================================
    if (etapa === "menu_principal") {
      const nome = text;

      if (text === "1") {
        await sendMessage(
          phone,
          "MENU DE PRODUTOS:\n\n1 – Banda Larga\n2 – Link Dedicado\n3 – Linha Móvel\n4 – Linha Fixa\n5 – Voip\n6 – Armazenamento em nuvem"
        );
        await salvarDados("", "", "", phone, "menu_produtos");
        return res.sendStatus(200);
      }

      if (text === "2") {
        const link = `https://wa.me/5511966140453?text=Nome%3A%20${encodeURIComponent(
          nome
        )}%0ASolicita%C3%A7%C3%A3o%3A%20Atendente`;

        await sendMessage(phone, "Certo! Vou te transferir para um atendente.");
        await sendMessage(phone, link);
        return res.sendStatus(200);
      }

      if (text === "3") {
        const link = `https://wa.me/5511966140453?text=Nome%3A%20${encodeURIComponent(
          nome
        )}%0ASolicita%C3%A7%C3%A3o%3A%20Suporte`;

        await sendMessage(phone, "Certo! Vou te transferir para o suporte.");
        await sendMessage(phone, link);
        return res.sendStatus(200);
      }

      await sendMessage(phone, "Opção inválida. Digite 1, 2 ou 3.");
      return res.sendStatus(200);
    }

    // ======================================================
    // ETAPA 3 — MENU DE PRODUTOS
    // ======================================================
    if (etapa === "menu_produtos") {
      let produto = "";
      let proximaEtapa = "";

      if (text === "1") {
        produto = "Banda Larga";
        proximaEtapa = "bl_endereco";
        await sendMessage(phone, "Informe o endereço completo:");
      } else if (text === "2") {
        produto = "Link Dedicado";
        proximaEtapa = "ld_endereco";
        await sendMessage(phone, "Informe o endereço completo:");
      } else if (text === "3") {
        produto = "Linha Móvel";
        proximaEtapa = "lm_quantidade";
        await sendMessage(phone, "Quantas linhas você precisa?");
      } else if (text === "4") {
        produto = "Linha Fixa";
        proximaEtapa = "lf_endereco";
        await sendMessage(phone, "Informe o endereço completo:");
      } else if (text === "5") {
        produto = "VoIP";
        proximaEtapa = "voip_quantidade";
        await sendMessage(phone, "Quantos ramais você precisa?");
      } else if (text === "6") {
        produto = "Armazenamento em nuvem";

        const link = `https://wa.me/5511966140453?text=Nome%3A%20Cliente%0AProduto%3A%20Armazenamento%20em%20nuvem`;

        await sendMessage(phone, "Encaminhando sua solicitação.");
        await sendMessage(phone, link);
        return res.sendStatus(200);
      } else {
        await sendMessage(phone, "Opção inválida. Escolha de 1 a 6.");
        return res.sendStatus(200);
      }

      await salvarDados("", produto, "", phone, proximaEtapa);
      return res.sendStatus(200);
    }

    // ======================================================
    // ETAPAS FINAIS — COLETA DE INFORMAÇÕES
    // ======================================================
    const etapasInfo = {
      bl_endereco: "Banda Larga",
      ld_endereco: "Link Dedicado",
      lf_endereco: "Linha Fixa",
      lm_quantidade: "Linha Móvel",
      voip_quantidade: "VoIP",
    };

    if (etapasInfo[etapa]) {
      const produto = etapasInfo[etapa];
      const info = text;

      const link = `https://wa.me/5511966140453?text=Nome%3A%20Cliente%0AProduto%3A%20${encodeURIComponent(
        produto
      )}%0AInfo%3A%20${encodeURIComponent(info)}%0ATelefone%3A%20${phone}`;

      await sendMessage(phone, "Perfeito! Encaminhando sua solicitação.");
      await sendMessage(phone, link);

      await salvarDados("", produto, info, phone, "finalizado");
      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook:", err);
    return res.sendStatus(500);
  }
});

// ======================================================
// 🚀 INICIAR SERVIDOR
// ======================================================
app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
