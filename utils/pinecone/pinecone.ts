import { Pinecone } from "@pinecone-database/pinecone";
import fs from "fs";
import dotenv from "dotenv";
import { generateEmbeddingFromProduct } from "../../embeddings/embedding.js";

dotenv.config();
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.resolve(__dirname, "../../prods/products.json");

const products = JSON.parse(fs.readFileSync(productsPath, "utf-8"));

export const pc = new Pinecone({
  apiKey: process.env.PINECONE_API!,
});

await pc.createIndex({
  name: "my-prod",
  vectorType: "dense",
  dimension: 768,
  metric: "cosine",
  spec: {
    serverless: {
      cloud: "aws",
      region: "us-east-1",
    },
  },
  deletionProtection: "disabled",
  tags: { environment: "development" },
});

export const prodIndex = pc.index("my-prod").namespace("prod-namespace");

const embedAllProducts = async (products: any) => {
  return await Promise.all(
    products.map(async (product: any) => {
      const embedding = await generateEmbeddingFromProduct(product);
      return {
        id: product.id,
        values: embedding,
        metadata: {
          name: product.name,
          company: product.company,
          type: product.type,
          areaOfUse: product.areaOfUse,
          price: product.price,
        },
      };
    })
  );
};

const vectors = await embedAllProducts(products);

const res = await prodIndex.upsert(vectors);

console.log("✅ Upserted:", res);
