import "./utils/env.js";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { redis } from "./utils/redis.js";
import express from "express";
import cors from "cors";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { loadMcpTools } from "@langchain/mcp-adapters";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
marked.setOptions({ renderer: new (TerminalRenderer as any)() as any });
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      process.env.MCP_CLIENT || "http://localhost:3001",
    ],
    credentials: true,
  })
);
const mcpClient = new Client({ name: "terminal-client", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(
  new URL(`${process.env.MCP_ENDPOINT}/mcp` || "http://localhost:3001/mcp")
);
await mcpClient.connect(transport);
const MAX_HISTORY = 50;
async function addToHistory(userId: string, role: string, text: string) {
  await redis.rPush(userId, JSON.stringify({ role, text }));
  await redis.lTrim(userId, -MAX_HISTORY, -1);
}

async function clearHistory(userId: string) {
  await redis.lTrim(userId, 1, 0);
}

const gemini = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API,
});

async function getHistory(userId: string) {
  const raw = await redis.lRange(userId, 0, -1);
  return raw
    .map((m) => JSON.parse(m))
    .map((turn) => ({
      role: ["tool", "assistant"].includes(turn.role) ? "model" : turn.role,
      parts: [{ text: turn.text }],
    }));
}

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/deleteChat/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const clearChat = await clearHistory(userId);
    res.json({
      message: "chat is cleared ",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not get history from server error" });
  }
});

app.get("/getUserHistory/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const history = await getHistory(userId);
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not get history from server error" });
  }
});

app.post("/chat", async (req, res) => {
  const query = req.body.query;
  const userId = req.body.userId;
  let finalReply = null;
  await addToHistory(userId, "user", query);
  let history = await getHistory(userId);
  const tools = await loadMcpTools("Bytecraft-mcp", mcpClient);
  const agent = createReactAgent({
    llm: gemini,
    tools,
  });
  const systemMessage = `You are a helpful assistant named Aira made by ashish mehta and trained by Google. You are a customer support agent for shopping and the store name is Bytecraft.

      In this conversation, you have to:
      -Search for product details to tell users about the products.
      - Help users know product details.
      - Help them buy based on budget.
      - Add/remove/view items in the cart without asking for permission.

      User ID is: ${userId}
      history of conversation with the user is  : ${JSON.stringify(history)}
      Stop when the required task is completed for eg if user asks to buy a product then stop and give response that product is added to the cart and also recommend similar products and be gentle with the user.
      If you updated something in user cart add,delete,change then in the last messaege of your chain add updated word
    All the products price is in ruppee currency.Also show images too to the user 
`;
  const response = await agent.invoke({
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: query },
    ],
  });
  console.log(response);
  const agentLength = response.messages.length;
  finalReply = response.messages[agentLength - 1].content as string;
  await addToHistory(userId, "model", finalReply!);
  return res.json({ finalReply });
});
console.log(process.env.PORT);

setInterval(async () => {
  try {
    const response = await fetch(`${process.env.MCP_ENDPOINT}`);
  } catch (error) {
    console.error("Polling error:", error);
  }
}, 600000);

app.listen(process.env.PORT || 5500, () => {
  console.log(`Server started on port ${process.env.PORT}`);
});
