import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, GenerateVideosOperation } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to lazily initialize the Google Gen AI client
function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the server environment. Please configure it in Settings > Secrets.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// In-memory cache for trending products
let memoizedTrendingData: any = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

// 0. Fetch Real-time Top 5 Viral & Predicted Viral Products
app.get("/api/trending", async (req, res): Promise<void> => {
  try {
    const now = Date.now();
    if (memoizedTrendingData && (now - lastFetchTime < CACHE_TTL)) {
      res.json(memoizedTrendingData);
      return;
    }

    const ai = getGenAIClient();
    const systemInstruction = 
      "You are a leading Indonesian e-commerce trend analyst. Your job is to find the absolute top 5 viral and 5 upcoming high-potential products in the Indonesian Shopee/TikTok/Tokopedia affiliate marketing space for May 2026. Be specific about product names, don't use generic terms (e.g. use 'T900 Pro Max Smartwatch' instead of 'jam tangan', or 'The Originote Hyalucera Moist' instead of 'pelembab').";

    const promptMessage = 
      "Lakukan web search untuk mencari top 5 produk fisik yang sedang paling viral sekarang di TikTok Shop / Shopee affiliate Indonesia demi mempermudah dropshipper/affiliate membuat konten penjualan rujukan. Tambahkan juga daftar 5 produk fisik potensial lainnya yang diprediksikan akan segera viral karena tren terkini. Berikan respons dalam format JSON yang rapi.";

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptMessage,
      config: {
        systemInstruction,
        temperature: 0.7,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            top5Viral: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Indonesian actual brand/product name, e.g. T900 Ultra Smartwatch" },
                  url: { type: Type.STRING, description: "A representative or mock affiliate shopee/tiktok URL for this product" },
                  category: { type: Type.STRING, description: "Choose one of: Skincare & Kecantikan, Fashion & Aksesoris, Perlengkapan Bayi & Anak, Gadget & Elektronik, Perlengkapan Rumah & Dapur, Makanan & Camilan Healty, Otomotif & Hobi, Buku & Edukasi Digital" },
                  tone: { type: Type.STRING, description: "Choose one of: Solutif & Edukatif, Storytelling / Drama Relate, Unboxing / Demo Praktis, Hard-Sell To The Point, Humoris & Santai" },
                  ctaStyle: { type: Type.STRING, description: "Recommended CTA text, e.g. Klik link bio nomor 15!" },
                  description: { type: Type.STRING, description: "Indonesian brief description highlighting why this is viral & its core benefit." }
                },
                required: ["name", "url", "category", "tone", "ctaStyle", "description"]
              }
            },
            predicted5Viral: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Indonesian actual brand/product name" },
                  url: { type: Type.STRING, description: "A representative or mock affiliate shopee/tiktok URL" },
                  category: { type: Type.STRING, description: "Choose one of: Skincare & Kecantikan, Fashion & Aksesoris, Perlengkapan Bayi & Anak, Gadget & Elektronik, Perlengkapan Rumah & Dapur, Makanan & Camilan Healty, Otomotif & Hobi, Buku & Edukasi Digital" },
                  tone: { type: Type.STRING, description: "Choose one of: Solutif & Edukatif, Storytelling / Drama Relate, Unboxing / Demo Praktis, Hard-Sell To The Point, Humoris & Santai" },
                  ctaStyle: { type: Type.STRING, description: "Recommended CTA text" },
                  description: { type: Type.STRING, description: "Indonesian brief analysis of why this is predicted to go viral." }
                },
                required: ["name", "url", "category", "tone", "ctaStyle", "description"]
              }
            }
          },
          required: ["top5Viral", "predicted5Viral"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("Empty response from trend analyzer.");
    }

    memoizedTrendingData = JSON.parse(jsonText.trim());
    lastFetchTime = Date.now();

    res.json(memoizedTrendingData);
  } catch (error: any) {
    const isQuotaError = error && (String(error).includes("429") || String(error).includes("quota") || String(error).includes("RESOURCE_EXHAUSTED"));
    if (isQuotaError) {
      console.warn("⚠️ [Trending API] Limit Kuota Gemini terlampaui (429/Resource Exhausted). Mengaktifkan circuit-breaker dan menggunakan Basis Data Tren Lokal berkualitas tinggi.");
    } else {
      console.warn("⚠️ [Trending API] Gagal mengambil tren terkini dari Google Search:", error.message || error);
    }
    
    // Fallback static list structured for optimal affiliate marketing conversion rates
    const fallbackData = {
      top5Viral: [
        {
          name: "The Originote Ceramella Sunscreen SPF 50",
          url: "https://shopee.co.id/the-originote-ceramella-sunscreen",
          category: "Skincare & Kecantikan",
          tone: "Solutif & Edukatif",
          ctaStyle: "Klik link bio nomor 34!",
          description: "Sunscreen viral super ringan dengan kandungan 3 jenis ceramide. Sangat diminati pelajar/mahasiswa karena ramah kantong."
        },
        {
          name: "Mini Portable Lint Roller Tear-off",
          url: "https://shopee.co.id/mini-portable-lint-roller",
          category: "Perlengkapan Rumah & Dapur",
          tone: "Unboxing / Demo Praktis",
          ctaStyle: "Beli sekarang di keranjang kuning!",
          description: "Rol pembersih bulu kucing dan serat debu baju portabel berukuran saku. Viral di kalangan pecinta hewan peliharaan."
        },
        {
          name: "TWS Anker Soundcore R50i Bass",
          url: "https://shopee.co.id/tws-anker-soundcore-r50i-original",
          category: "Gadget & Elektronik",
          tone: "Hard-Sell To The Point",
          ctaStyle: "Klik link produk di bio saya!",
          description: "Earphone bluetooth sound luar biasa bass nendang dengan harga sangat terjangkau. Konten review-nya selalu banjir views."
        },
        {
          name: "Original Stainless Steel Tumpler Thermos 1L",
          url: "https://shopee.co.id/stainless-steel-tumbler-1l-viral",
          category: "Perlengkapan Rumah & Dapur",
          tone: "Unboxing / Demo Praktis",
          ctaStyle: "Komen 'Mau' di bawah untuk link!",
          description: "Tumbler stainless mirip Stanley Cup yang tahan es 24 jam penuh. Tren estetika anak muda masa kini."
        },
        {
          name: "Skintific 5X Ceramide Barrier Moisture Gel 30g",
          url: "https://shopee.co.id/skintific-moisturizer-5x-ceramide",
          category: "Skincare & Kecantikan",
          tone: "Solutif & Edukatif",
          ctaStyle: "Klik link bio nomor 7!",
          description: "Moisturizer sejuta umat yang ampuh memperbaiki skin barrier rusak berkat kombinasi ceramide premium."
        }
      ],
      predicted5Viral: [
        {
          name: "Smart Fingerprint Lock Padlock USB",
          url: "https://shopee.co.id/smart-fingerprint-lock-padlock-usb",
          category: "Gadget & Elektronik",
          tone: "Unboxing / Demo Praktis",
          ctaStyle: "Buruan beli selagi diskon hari ini!",
          description: "Gembok pintar pembuka sidik jari pintar tanpa kunci untuk loker/tas. Diprediksi viral karena mengusung kemudahan gaya hidup modern."
        },
        {
          name: "Korean Style Aesthetic Linen Blouse",
          url: "https://shopee.co.id/korean-style-aesthetic-linen-blouse",
          category: "Fashion & Aksesoris",
          tone: "Storytelling / Drama Relate",
          ctaStyle: "Klik link bio nomor 45!",
          description: "Baju blouse sejuk bahan linen rami berkualitas tinggi berdesain Korean style. Mulai naik daun di platform rekomendasi fashion Outfit of the Day."
        },
        {
          name: "Cushion Matte Cover Waterproof SPF35",
          url: "https://shopee.co.id/cushion-matte-cover-waterproof-glow",
          category: "Skincare & Kecantikan",
          tone: "Hard-Sell To The Point",
          ctaStyle: "Beli sekarang di keranjang kuning!",
          description: "Cushion ramah kantong berdaya cover tinggi dan tahan air. Menjadi perbincangan hangat di kalangan beauty influencer pemula."
        },
        {
          name: "Dormitory Collapsible Multi-cooker Pot",
          url: "https://shopee.co.id/collapsible-electric-cooker-pot",
          category: "Perlengkapan Rumah & Dapur",
          tone: "Storytelling / Drama Relate",
          ctaStyle: "Klik link di bio profil saya!",
          description: "Panci masak listrik lipat serba guna, cocok untuk anak kos / penyuka olahraga outdoor/camping praktis."
        },
        {
          name: "Mini Astronaut Nebula Star Projector Light",
          url: "https://shopee.co.id/astronaut-nebula-star-projector-lamp",
          category: "Perlengkapan Rumah & Dapur",
          tone: "Storytelling / Drama Relate",
          ctaStyle: "Komen 'Mau' di bawah untuk link!",
          description: "Lampu proyektor sinar bintang astronot mini untuk menemani tidur santai atau setup estetik kamar tidur."
        }
      ]
    };

    // Store the fallback list into the memoized class memory so subsequent client boots load instantaneously
    memoizedTrendingData = fallbackData;
    lastFetchTime = Date.now();

    res.json(fallbackData);
  }
});

// 1. Content Generation Endpoint using gemini-3.5-flash
app.post("/api/generate", async (req, res): Promise<void> => {
  try {
    const { productInput, tone, category, ctaStyle } = req.body;

    if (!productInput) {
      res.status(400).json({ error: "Product input (name or URL) is required." });
      return;
    }

    const ai = getGenAIClient();

    const systemInstruction = 
      "You are an expert affiliate marketer, copywriter, and professional short-form content producer (TikTok/Instagram Reels/YouTube Shorts) who knows how to make items viral." +
      "Your goal is to generate persuasive and engaging affiliate video scripts, attention-grabbing titles, informative descriptive texts, viral hashtags, and cinematic Veo video prompts in Indonesian (English is only allowed for the Veo video prompt field).";

    const promptMessage = 
      `Hasilkan aset konten affiliate pemasaran video pendek lengkap untuk info produk berikut:\n` +
      `- Nama/Url Produk: ${productInput}\n` +
      `- Kategori Produk: ${category || "General"}\n` +
      `- Gaya Nada Bicara (Tone): ${tone || "Meyakinkan, Menarik, Solutif"}\n` +
      `- Gaya Call to Action (CTA): ${ctaStyle || "Klik link di bio"}\n\n` +
      `Pastikan naskah video berdurasi sekitar 30-60 detik, yang terbagi dalam adegan-adegan (scenes) logis.\n` +
      `Setiap adegan harus menyertakan:\n` +
      `1. visual: Instruksi visual detail untuk apa yang ditampilkan di layar (Bahasa Indonesia).\n` +
      `2. audio: Instruksi audio seperti jenis musik sfx dan nada emosional (Bahasa Indonesia).\n` +
      `3. speech: Dialog atau narasi yang akan diucapkan atau dijadikan teks Voice Over (Bahasa Indonesia).\n` +
      `4. veoPrompt: Sebuah perintah deskriptif, sinematik, artistik dalam BAHASA INGGRIS yang mendetail untuk model AI video Veo untuk membuat video klip 5-detik untuk adegan ini. Jangan sebutkan nama orang spesifik atau kata-kata UI, fokus pada detail photorealistic, lighthing, gerakan kamera, dan ambience visual produk.\n\n` +
      `Hasilkan juga 5 variasi judul berkualitas tinggi yang mengundang klik (high CTR), deskripsi video affiliate yang menyertakan placeholder [LINK_AFFILIATE] beserta penjelasan ringkas produk dan kegunaannya, serta kumpulan hashtag trending.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptMessage,
      config: {
        systemInstruction,
        temperature: 0.8,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titles: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "5 attention-grabbing, SEO-optimized, click-rate (CTR) optimized titles in Indonesian."
            },
            description: {
              type: Type.STRING,
              description: "Engaging and informative video description in Indonesian with structured key selling points and a placeholder '[LINK_AFFILIATE]'"
            },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "8-12 relevant and viral hashtags for short video platforms (TikTok, Reels, Shorts), including product-specific and general affiliate tags."
            },
            script: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  scene: { type: Type.INTEGER },
                  duration: { type: Type.STRING, description: "Duration or timestamp of scene, e.g., '0:00 - 0:08'" },
                  visual: { type: Type.STRING, description: "Detailed visual instructions of what is happening or what needs to be shown, in Indonesian." },
                  audio: { type: Type.STRING, description: "Sound design and background audio guideline, in Indonesian." },
                  speech: { type: Type.STRING, description: "Spoken narration or voiceover content, fully in Indonesian." },
                  veoPrompt: { type: Type.STRING, description: "A highly-detailed cinematic video prompt in English for Veo (e.g. 'Cinematic close-up of premium leather material glowing under warm, diffuse studio light, depth of field, 4k, photorealistic')." }
                },
                required: ["scene", "duration", "visual", "audio", "speech", "veoPrompt"]
              },
              description: "A chronological list of 3-6 scenes composing the short video script."
            },
            productDetails: {
              type: Type.OBJECT,
              properties: {
                extractedName: { type: Type.STRING, description: "Name of the affiliate product." },
                mainBenefit: { type: Type.STRING, description: "The single biggest benefit or problem solved by this product." }
              },
              required: ["extractedName", "mainBenefit"]
            }
          },
          required: ["titles", "description", "hashtags", "script", "productDetails"]
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("Empty response received from Gemini.");
    }

    const payload = JSON.parse(jsonText.trim());
    res.json(payload);
  } catch (error: any) {
    console.error("Error in /api/generate:", error);
    res.status(500).json({ error: error.message || "Failed to generate video content. Please verify your GEMINI_API_KEY configuration." });
  }
});

// 2. Start Veo Video Generation (Returns operationName)
app.post("/api/generate-video", async (req, res): Promise<void> => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "Video prompt is required." });
      return;
    }

    const ai = getGenAIClient();

    // Call Veo to generate video
    const operation = await ai.models.generateVideos({
      model: "veo-3.1-lite-generate-preview",
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: "9:16", // Perfect portrait mode for TikTok/Shorts
      },
    });

    res.json({ operationName: operation.name });
  } catch (error: any) {
    console.error("Error starting video generation with Veo:", error);
    res.status(500).json({ error: error.message || "Failed to initiate video generation." });
  }
});

// 3. Poll Veo Video Generation Status
app.post("/api/video-status", async (req, res): Promise<void> => {
  try {
    const { operationName } = req.body;

    if (!operationName) {
      res.status(400).json({ error: "operationName is required." });
      return;
    }

    const ai = getGenAIClient();

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    res.json({
      done: updated.done,
      error: updated.error,
      metadata: updated.metadata,
      // If completed, let the frontend know so it can trigger download/streaming
      completed: !!updated.response?.generatedVideos?.[0]?.video?.uri,
    });
  } catch (error: any) {
    console.error("Error polling video operation:", error);
    res.status(500).json({ error: error.message || "Failed to poll video generation status." });
  }
});

// 4. Download / Proxy-Stream is done by passing the operation name
app.post("/api/video-download", async (req, res): Promise<void> => {
  try {
    const { operationName } = req.body;

    if (!operationName) {
      res.status(400).json({ error: "operationName is required." });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the server environment.");
    }

    const ai = getGenAIClient();

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      res.status(404).json({ error: "Video URI not found or video is not completed yet." });
      return;
    }

    // Proxy the video binary stream back securely
    const videoRes = await fetch(uri, {
      headers: { "x-goog-api-key": apiKey },
    });

    if (!videoRes.ok) {
      throw new Error(`Failed to download video from Google API. Status: ${videoRes.status}`);
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Cache-Control", "public, max-age=3600");

    if (videoRes.body) {
      // In Node environment, pipe standard web stream or node stream back
      const reader = videoRes.body.getReader();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        }
      });

      // Write chunks back to express response
      const bufferReader = stream.getReader();
      while (true) {
        const { done, value } = await bufferReader.read();
        if (done) {
          res.end();
          break;
        }
        res.write(value);
      }
    } else {
      res.status(500).json({ error: "No video body stream available." });
    }
  } catch (error: any) {
    console.error("Error downloading/proxying video:", error);
    res.status(500).json({ error: error.message || "Failed to download and stream video." });
  }
});


// Mounting Vite middleware or static paths
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Prevent app.listen if running inside Vercel Serverless Functions
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

export default app;
