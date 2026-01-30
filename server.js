import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= SAFETY CHECK ================= */
if (!process.env.GEMINI_API_KEY) {
    console.error("🚨 ERROR: GEMINI_API_KEY missing in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
    res.send("✅ Gemini backend running (Problem Statement Mode)");
});

/* =========================================================
   STEP 1: GENERATE 15 REAL PROBLEM STATEMENTS (NO BUDGET/INVESTMENT)
   ========================================================= */
app.post("/generate", async (req, res) => {
    const { category, experience, mode, goals } = req.body;

    if (!category || !experience || !mode || !goals) {
        return res.status(400).json({
            error: "Missing input parameters. Category, experience, mode, and goals are required."
        });
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash"
        });

        const responseSchema = {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    s_no: {
                        type: "NUMBER",
                        description: "Serial number from 1 to 15"
                    },
                    business_title: {
                        type: "STRING",
                        description:
                            "A clear, real-world PROBLEM STATEMENT describing a pain point people face in India. NOT a business idea."
                    },
                    detail: {
                        type: "STRING",
                        description:
                            "One-line explanation of why this problem matters and who is affected"
                    }
                },
                required: ["s_no", "business_title", "detail"]
            }
        };

        const prompt = `
You are a problem-discovery AI focused on identifying REAL problems people face in India.

USER PROFILE:
- Categories: ${category}
- Experience: ${experience} years
- Business Mode: ${mode}
- Goals: ${goals}

TASK:
1. Generate 15 REAL-WORLD PROBLEM STATEMENTS.
2. Problems must describe pain points faced by people, businesses, or communities in India.
3. DO NOT suggest solutions.
4. DO NOT generate business ideas, startup names, or product concepts.
5. Each problem must be practical, realistic, and relevant to the user's inputs.
6. Output ONLY valid JSON matching the schema.
7. Do NOT include markdown, explanations, or extra text.
`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema
            }
        });

        const parsed = JSON.parse(result.response.text().trim());
        res.json(parsed);

    } catch (err) {
        console.error("❌ GEMINI ERROR (/generate):", err);
        res.status(500).json({
            error: "Failed to generate problem statements",
            message: err.message
        });
    }
});

/* =========================================================
   STEP 2: DETAILED ANALYSIS OF A SELECTED PROBLEM
   ========================================================= */
app.post("/generate-detail", async (req, res) => {
    const { business_title, user_data } = req.body;

    if (!business_title || !user_data) {
        return res.status(400).json({
            error: "Missing required parameters for detailed analysis."
        });
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash"
        });

        const detailPrompt = `
You are a market research and problem-analysis expert focused on India.

PROBLEM STATEMENT:
"${business_title}"

USER PROFILE:
${JSON.stringify(user_data, null, 2)}

TASK:
Generate a detailed 1000+ word analysis covering:

1. Problem overview
2. Who is affected and how often
3. Root causes
4. Why current solutions fail
5. Market size and urgency in India
6. Stakeholders involved
7. Economic and social impact
8. Willingness to pay to solve this problem
9. Possible solution approaches (high-level, not business plans)
10. Why this problem fits THIS user
11. Risks and constraints
12. Scalability of solving the problem
13. Long-term relevance (5–10 years)
14. KPIs to measure problem resolution
15. Summary and opportunity insight

IMPORTANT:
- Focus on PROBLEM analysis, not business plans
- Keep it realistic and India-specific
- Write professionally and practically
`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: detailPrompt }] }],
            generationConfig: {
                maxOutputTokens: 3000,
                temperature: 0.7
            }
        });

        res.json({
            detailed_analysis: result.response.text()
        });

    } catch (err) {
        console.error("❌ GEMINI ERROR (/generate-detail):", err);
        res.status(500).json({
            error: "Failed to generate detailed problem analysis",
            message: err.message
        });
    }
});

/* ================= SERVER START ================= */
app.listen(3000, () => {
    console.log("✅ Server running at http://localhost:3000");
});
