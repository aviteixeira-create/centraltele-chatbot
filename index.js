import express from "express";
import fetch from "node-fetch";
import { google } from "googleapis";

// ---------------------------------------------
// CONFIGURAÇÃO DO SERVIDOR EXPRESS
// ---------------------------------------------
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---------------------------------------------
// FUNÇÃO PARA ENVIAR MENSAGEM VIA WHATSAPP API
// ---------------------------------------------
async function sendMessage(to, message) {
  const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    text: { body: message }
  };

  await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

// ---------------------------------------------
// GOOGLE SHEETS – CONFIGURAÇÃO
// ---------------------------------------------
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets("v4");
const SPREADSHEET_ID = "1MPvz5s6ogt6h8uLFsLQ2glmjiWW30lRQLt6blwTwfPo";

// Função para salvar lead na planilha
async function salvarLead(nome, produto, info, telefone) {
  const client = await auth.getClient();

  const data = [
    [
      nome,
      produto,
      info,
      telefone,
      new Date().toLocaleDateString("pt-BR"),
      new Date().toLocaleTimeString("pt-BR"),
    ],
  ];

  await sheets.spreadsheets.values.append({
    auth: client,
    spreadsheetId: SPREADSHEET_ID,
    range: "A:F",
    valueInputOption: "RAW",
    resource: { values: data },
  });
}

// ---------------------------------------------
// BOT – ESTADOS DE CONVERSA
// ---------------------------------------------
const userState = {};
const userData = {};

app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body?.trim();

  if (!userState[from]) userState[from] = "inicio";

  let reply = "";

  // -----------------------------
  // INÍCIO → Pergunta o nome
  // -----------------------------
  if (userState[from] === "inicio") {
    reply = `Olá!
Aqui é o assistente da CentralTele, como posso te ajudar?

Qual seu nome?`;

    userState[from] = "aguardando_nome";
    await sendMessage(from, reply);
    return res.sendStatus(200);
  }

  // -----------------------------
  // CLIENTE RESPONDE O NOME
  // -----------------------------
  if (userState[from] === "aguardando_nome") {
    userData[from] = { nome: text };

    reply = `MENU PRINCIPAL:

1️⃣ Qual produto está precisando?
2️⃣ Falar com Atendente
3️⃣ Falar com Suporte

🕒 Horário de atendimento:
Segunda a Sexta: 08h às 18h
Sábado: 08h às 12h

Digite apenas o número da opção desejada.`;

    userState[from] = "menu_principal";
    await sendMessage(from, reply);
    return res.sendStatus(200);
  }

  // -----------------------------
  // MENU PRINCIPAL
  // -----------------------------
  if (userState[from] === "menu_principal") {
    if (text === "1") {
      reply = `1️⃣ Banda Larga
2️⃣ Link Dedicado
3️⃣ Linha Móvel
4️⃣ Linha Fixa
5️⃣ VoIP
6️⃣ Armazenamento em nuvem

Digite apenas o número da opção desejada.`;

      userState[from] = "menu_produtos";
    }

    else if (text === "2") {
      await salvarLead(userData[from].nome, "Falar com atendente", "-", from);
      await encaminharLead("Falar com atendente", from);
      reply = "Certo! Vou te encaminhar para um atendente.";
    }

    else if (text === "3") {
      await salvarLead(userData[from].nome, "Falar com Suporte", "-", from);
      await encaminharLead("Falar com Suporte", from);
      reply = "Certo! Vou te encaminhar para o suporte.";
    }

    else {
      reply = "Opção inválida. Escolha 1, 2 ou 3.";
    }

    await sendMessage(from, reply);
    return res.sendStatus(200);
  }

  // -----------------------------
  // MENU DE PRODUTOS
  // -----------------------------
  if (userState[from] === "menu_produtos") {
    switch (text) {
      case "1":
        reply = "Perfeito! Para Banda Larga, envie seu endereço completo.";
        userState[from] = "endereco_banda_larga";
        break;

      case "2":
        reply = "Certo! Para Link Dedicado, envie seu endereço completo.";
        userState[from] = "endereco_link_dedicado";
        break;

      case "3":
        reply = "Quantas linhas móveis você precisa?";
        userState[from] = "qtd_linha_movel";
        break;

      case "4":
        reply = "Quantas linhas fixas você precisa?";
        userState[from] = "qtd_linha_fixa";
        break;

      case "5":
        reply = "Quantos ramais VoIP você precisa?";
        userState[from] = "qtd_voip";
        break;

      case "6":
        await salvarLead(userData[from].nome, "Armazenamento em nuvem", "-", from);
        await encaminharLead("Armazenamento em nuvem", from);
        reply = "Perfeito! Vou encaminhar sua solicitação.";
        break;

      default:
        reply = "Opção inválida. Escolha de 1 a 6.";
    }

    await sendMessage(from, reply);
    return res.sendStatus(200);
  }

  // -----------------------------
  // COLETA DE DADOS POR PRODUTO
  // -----------------------------

  if (userState[from] === "endereco_banda_larga") {
    await salvarLead(userData[from].nome, "Banda Larga", text, from);
    await encaminharLead(`Banda Larga, Endereço: ${text}`, from);
    reply = "Obrigado! Encaminhei sua solicitação.";
  }

  else if (userState[from] === "endereco_link_dedicado") {
    await salvarLead(userData[from].nome, "Link Dedicado", text, from);
    await encaminharLead(`Link Dedicado, Endereço: ${text}`, from);
    reply = "Obrigado! Encaminhei sua solicitação.";
  }

  else if (userState[from] === "qtd_linha_movel") {
    await salvarLead(userData[from].nome, "Linha Móvel", text, from);
    await encaminharLead(`Linha Móvel, Quantidade: ${text}`, from);
    reply = "Obrigado! Encaminhei sua solicitação.";
  }

  else if (userState[from] === "qtd_linha_fixa") {
    await salvarLead(userData[from].nome, "Linha Fixa", text, from);
    await encaminharLead(`Linha Fixa, Quantidade: ${text}`, from);
    reply = "Obrigado! Encaminhei sua solicitação.";
  }

  else if (userState[from] === "qtd_voip") {
    await salvarLead(userData[from].nome, "VoIP", text, from);
    await encaminharLead(`VoIP, Quantidade: ${text}`, from);
    reply = "Obrigado! Encaminhei sua solicitação.";
  }

  userState[from] = "inicio";

  await sendMessage(from, reply);
  res.sendStatus(200);
});

// -------------------------------------------
// FUNÇÃO PARA ENCAMINHAR LEAD VIA WHATSAPP
// -------------------------------------------
async function encaminharLead(info, from) {
  const nome = userData[from]?.nome || "Não informado";

  const resumo = `Nome: ${nome}
${info}`;

  await sendMessage("11966140453", resumo);
}

// ---------------------------------------------
// INICIAR SERVIDOR
// ---------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
