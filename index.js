import express from "express";
import axios from "axios";
import { google } from "googleapis";
import path from "path";

const app = express();
app.use(express.json());

// Caminho do credentials.json (local + Render)

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// ID da planilha
const SPREADSHEET_ID = "1MPvz5s6ogt6h8uLFsLQ2glmjiWW30lRQLt6blwTwfPo";

// Nome das abas
const ABA_ATENDIMENTOS = "chatbot"; // Leads Centraltele
const ABA_HISTORICO = "Historico";  // pode ser criada automaticamente

// Número fixo para encaminhar (11 96614-0453)
const ATENDENTE_NUMERO = "5511966140453";

// "Sessões" em memória (por número)
const sessions = {};

// ---------- FUNÇÕES DE PLANILHA ----------

// Salvar qualquer mensagem no histórico
async function salvarHistorico({ nome, produto, informacao, telefone }) {
  try {
    const agora = new Date();
    const data = agora.toLocaleDateString("pt-BR");
    const hora = agora.toLocaleTimeString("pt-BR");

    const linha = [[nome || "", produto || "", informacao || "", telefone || "", data, hora]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ABA_HISTORICO}!A:F`,
      valueInputOption: "RAW",
      requestBody: { values: linha },
    });
  } catch (error) {
    console.error("Erro ao salvar histórico:", error.response?.data || error);
  }
}

// Salvar resumo final na aba principal (Página1)
async function salvarLeadFinal({ nome, produto, informacao, telefone }) {
  try {
    const agora = new Date();
    const data = agora.toLocaleDateString("pt-BR");
    const hora = agora.toLocaleTimeString("pt-BR");

    const linha = [[nome || "", produto || "", informacao || "", telefone || "", data, hora]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ABA_ATENDIMENTOS}!A:F`,
      valueInputOption: "RAW",
      requestBody: { values: linha },
    });
  } catch (error) {
    console.error("Erro ao salvar lead final:", error.response?.data || error);
  }
}

// ---------- FUNÇÕES WHATSAPP ----------

async function enviarMensagem(to, text) {
  try {
    await axios.post(
      "https://graph.facebook.com/v20.0/1129395576926383/messages",
      {
        messaging_product: "whatsapp",
        to,
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer EAAa06y1g2rEBRuC1DLN6GiZCcfMJTxd9qZCOnUIq3kfwNcb6UhBzlKYQCGVDREEIxmc6YadIAh1MaXQu9uVBrT2iSEgJvyeDY33LDeS1tmMQPr0ktBJouft4qAOi2OZCDQaZB2j6PfhvjWV6ZAVyd2I4ZBdmj3KunVDrbMd6N8dQd3suyp8bNfBWnkBRj0jgZDZD`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error.response?.data || error);
  }
}

// Encaminhar para o número fixo com resumo
async function encaminharParaAtendente(resumo) {
  await enviarMensagem(ATENDENTE_NUMERO, resumo);
}

// ---------- TEXTO DOS MENUS ----------

function textoMenuPrincipal() {
  return (
    "MENU PRINCIPAL:\n\n" +
    "1 - Qual produto está precisando?\n" +
    "2 - Falar com Atendente\n" +
    "3 - Falar com Suporte\n\n" +
    "Horário de funcionamento:\n" +
    "Segunda a sexta: 9h às 18h\n" +
    "Sábado: 9h às 12h\n" +
    "Domingos e feriados: não trabalhamos"
  );
}

function textoMenuProdutos() {
  return (
    "1 – Banda Larga\n" +
    "2 – Link Dedicado\n" +
    "3 – Linha Móvel\n" +
    "4 – Linha Fixa\n" +
    "5 – Voip\n" +
    "6 – Armazenamento em nuvem"
  );
}

// ---------- WEBHOOK WHATSAPP ----------

app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from; // número do cliente
    const text = (message.text?.body || "").trim();
    const telefone = from;

    // Garante sessão
    if (!sessions[from]) {
      sessions[from] = {
        stage: "inicio",
        nome: null,
        produto: null,
      };
    }

    const session = sessions[from];

    // Salvar TODAS as mensagens no histórico (Informação = texto bruto)
    await salvarHistorico({
      nome: session.nome,
      produto: session.produto,
      informacao: text,
      telefone,
    });

    // LÓGICA DO FLUXO

    // 1) Início: qualquer mensagem → pedir nome
    if (session.stage === "inicio") {
      await enviarMensagem(
        from,
        "Olá!\n\nAqui é o assistente da CentralTele, como posso te ajudar?\n\nQual seu nome?"
      );
      session.stage = "aguardando_nome";
      return res.sendStatus(200);
    }

    // 2) Aguardando nome
    if (session.stage === "aguardando_nome") {
      session.nome = text;
      await enviarMensagem(from, textoMenuPrincipal());
      session.stage = "menu_principal";
      return res.sendStatus(200);
    }

    // 3) Menu principal
    if (session.stage === "menu_principal") {
      if (text === "1") {
        // Menu de produtos
        await enviarMensagem(from, textoMenuProdutos());
        session.stage = "menu_produtos";
        return res.sendStatus(200);
      }

      if (text === "2") {
        // Falar com atendente
        const resumo = `Nome: ${session.nome}
        Telefone: ${from}
        Falar com atendente`;
        await encaminharParaAtendente(resumo);
        await salvarLeadFinal({
          nome: session.nome,
          produto: "Falar com atendente",
          informacao: "",
          telefone,
        });
        await enviarMensagem(from, "Tudo certo! Encaminhei sua solicitação para um atendente.");

        // 🔥 AQUI: envia o link para te chamar direto
  await enviarMensagem(
    from,
    "Se preferir, você pode falar diretamente com nosso atendente pelo link:\nhttps://wa.me/5511966140453"
  );
        
        sessions[from] = { stage: "inicio", nome: session.nome, produto: null };
        return res.sendStatus(200);
      }

      if (text === "3") {
        // Falar com suporte
        const resumo = `Nome: ${session.nome}
        Telefone: ${from}
        Falar com Suporte`;
        await encaminharParaAtendente(resumo);
        await salvarLeadFinal({
          nome: session.nome,
          produto: "Falar com Suporte",
          informacao: "",
          telefone,
        });
        await enviarMensagem(from, "Encaminhei sua solicitação para o suporte.");

        // 🔥 AQUI: envia o link para te chamar direto
  await enviarMensagem(
    from,
    "Se preferir, você pode falar diretamente com nosso atendente pelo link:\nhttps://wa.me/5511966140453"
  );
        
        sessions[from] = { stage: "inicio", nome: session.nome, produto: null };
        return res.sendStatus(200);
      }

      // Opção inválida
      await enviarMensagem(from, "Opção inválida. Por favor, escolha uma das opções abaixo:\n\n" + textoMenuPrincipal());
      return res.sendStatus(200);
    }

    // 4) Menu de produtos
    if (session.stage === "menu_produtos") {
      if (text === "1") {
        session.produto = "Banda Larga";
        await enviarMensagem(from, "Por favor, envie o endereço completo.");
        session.stage = "coletando_endereco";
        return res.sendStatus(200);
      }

      if (text === "2") {
        session.produto = "Link Dedicado";
        await enviarMensagem(from, "Por favor, envie o endereço completo.");
        session.stage = "coletando_endereco";
        return res.sendStatus(200);
      }

      if (text === "3") {
        session.produto = "Linha Móvel";
        await enviarMensagem(from, "Quantas linhas você precisa?");
        session.stage = "coletando_quantidade";
        return res.sendStatus(200);
      }

      if (text === "4") {
        session.produto = "Linha Fixa";
        await enviarMensagem(from, "Quantas linhas você precisa?");
        session.stage = "coletando_quantidade";
        return res.sendStatus(200);
      }

      if (text === "5") {
        session.produto = "Voip";
        await enviarMensagem(from, "Quantos ramais você precisa?");
        session.stage = "coletando_quantidade";
        return res.sendStatus(200);
      }

      if (text === "6") {
        session.produto = "Armazenamento em nuvem";
        const resumo = `Nome: ${session.nome}
        Telefone: ${from}
        Produto: ${session.produto}`;
        await encaminharParaAtendente(resumo);
        await salvarLeadFinal({
          nome: session.nome,
          produto: session.produto,
          informacao: "",
          telefone,
        });
        await enviarMensagem(from, "Perfeito! Encaminhei sua solicitação.");

        // 🔥 AQUI: envia o link para te chamar direto
  await enviarMensagem(
    from,
    "Se preferir, você pode falar diretamente com nosso atendente pelo link:\nhttps://wa.me/5511966140453"
  );
        
        sessions[from] = { stage: "inicio", nome: session.nome, produto: null };
        return res.sendStatus(200);
      }

      await enviarMensagem(from, "Opção inválida. Escolha uma das opções abaixo:\n\n" + textoMenuProdutos());
      return res.sendStatus(200);
    }

    // 5) Coletando endereço (Banda Larga / Link Dedicado)
    if (session.stage === "coletando_endereco") {
      const endereco = text;
      const resumo = `Nome: ${session.nome}
      Telefone: ${from}
      Produto: ${session.produto}
      Endereço: ${endereco}`;
      await encaminharParaAtendente(resumo);
      await salvarLeadFinal({
        nome: session.nome,
        produto: session.produto,
        informacao: endereco,
        telefone,
      });
      await enviarMensagem(from, "Obrigado! Encaminhei sua solicitação.");

      // 🔥 AQUI: envia o link para te chamar direto
  await enviarMensagem(
    from,
    "Se preferir, você pode falar diretamente com nosso atendente pelo link:\nhttps://wa.me/5511966140453"
  );
      
      sessions[from] = { stage: "inicio", nome: session.nome, produto: null };
      return res.sendStatus(200);
    }

    // 6) Coletando quantidade (Linha Móvel / Fixa / VoIP)
    if (session.stage === "coletando_quantidade") {
      const quantidade = text;
      const resumo = `Nome: ${session.nome}
      Telefone: ${from}
      Produto: ${session.produto}
      Quantidade: ${quantidade}`;
      await encaminharParaAtendente(resumo);
      await salvarLeadFinal({
        nome: session.nome,
        produto: session.produto,
        informacao: quantidade,
        telefone,
      });
      await enviarMensagem(from, "Perfeito! Encaminhei sua solicitação.");

      // 🔥 AQUI: envia o link para te chamar direto
  await enviarMensagem(
    from,
    "Se preferir, você pode falar diretamente com nosso atendente pelo link:\nhttps://wa.me/5511966140453"
  );
      
      sessions[from] = { stage: "inicio", nome: session.nome, produto: null };
      return res.sendStatus(200);
    }

    // fallback
    await enviarMensagem(from, "Não entendi. Vamos começar de novo.\n\nQual seu nome?");
    sessions[from].stage = "aguardando_nome";
    res.sendStatus(200);
  } catch (error) {
    console.error("Erro no webhook:", error.response?.data || error);
    res.sendStatus(500);
  }
});

// Webhook de verificação
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "SEU_TOKEN_DE_VERIFICACAO";

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
