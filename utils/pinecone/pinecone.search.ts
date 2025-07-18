import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { Pinecone } from "@pinecone-database/pinecone";
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API!,
});

const prodIndex = pinecone.Index("my-prod").namespace("prod-namespace");

export const searchVector = async (query: string) => {
  const vector = await new GoogleGenAI({
    apiKey: process.env.GEMINI_API,
  }).models.embedContent({
    model: "text-embedding-004",
    contents: [query],
  });
  if (!vector.embeddings) throw new Error("No embeddings found");
  console.log(vector.embeddings[0].values);
  const res = await prodIndex.query({
    vector: vector.embeddings[0].values as number[],
    topK: 2,
    includeMetadata: true,
  });
  console.log(res);
  return res.matches;
};
