import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { Product } from "../types/product.types.js";

dotenv.config();

async function generateEmbeddingFromProduct(product: Product) {
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API });
  const productdetail = `
    Name of the product is ${product.name} and company is ${product.company} and type is ${product.type} and area of use is ${product.areaOfUse} and description is ${product.description} and price is ${product.price}
  `;

  const result = await genAI.models.embedContent({
    model: "text-embedding-004",
    contents: [productdetail],
  });
  if (!result.embeddings) {
    throw new Error("No embeddings found");
  }

  return result.embeddings[0].values;
}

export { generateEmbeddingFromProduct };
