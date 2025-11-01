require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { GoogleGenAI } = require("@google/genai"); // use correct package name

const app = express();
app.use(cors());
app.use(bodyParser.json());

// This line is great! It serves your index.html file
app.use(express.static(path.resolve(__dirname)));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ Error: GEMINI_API_KEY not found. Please create a .env file.");
  process.exit(1);
}

// Corrected: Initialize with GoogleGenAI from @google/genai
const genAI = new GoogleGenAI(apiKey);

// **** THIS IS THE NEW "BALANCED" PROMPT ****
const prompt = `
You are an AI Code Reviewer.

Review the provided code with a focus on clarity, correctness, and efficiency. 
Provide helpful, concise, and actionable feedback that would genuinely improve the code quality.

Your feedback should cover:
- **Readability:** clarity of variable names, structure, and comments.
- **Best Practices:** maintainability, reliability, and code hygiene.
- **Performance:** any avoidable inefficiencies or redundant logic.

Respond in a professional, developer-friendly tone using the following structure:

### Readability
Comment on how clear and understandable the code is. 
Point out any confusing variable names, missing comments, or formatting inconsistencies. 
Suggest specific improvements to make the code easier to follow.

### Best Practices
Evaluate whether the code follows general coding standards and safe practices. 
Identify any hardcoded values, missing validations, or unreliable patterns. 
Recommend improvements that enhance maintainability and robustness.

### Performance
Analyze the efficiency of the code. 
Highlight any redundant operations, heavy loops, or unnecessary computations. 
Suggest optimizations that would make the code cleaner and faster.

Finish with a short summary of the overall impression, e.g., 
"Overall, the code is clean and functional but could benefit from clearer variable naming and reduced repetition."
`;


// POST /review - accepts { code: "..." }
app.post("/review", async (req, res) => {
  try {
    const userCode = String(req.body.code || "").trim();
    if (!userCode) return res.status(400).json({ error: "No code provided" });

    // Note: I'm using your 'prompt' variable, not 'promptHeader'
    const payloadText = `${prompt}\n${userCode}`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: payloadText }],
        },
      ],
    });

    // Your robust extractor function (this is good)
    async function extractText(resp) {
      if (!resp) return null;
      if (resp.response) {
        const t = resp.response.text;
        if (typeof t === "function") return await resp.response.text();
        if (typeof t === "string") return t;
      }
      if (resp.candidates?.length) {
        const p = resp.candidates[0]?.content?.parts?.[0]?.text;
        if (typeof p === "string") return p;
      }
      if (resp.output?.[0]?.content?.[0]?.text) {
        return resp.output[0].content[0].text;
      }
      if (typeof resp.text === "string") return resp.text;
      if (typeof resp === "string") return resp;
      return null;
    }

    const feedback = (await extractText(result)) ?? JSON.stringify(result, null, 2);

    return res.json({ review: feedback });
  } catch (err) {
    console.error("Error in /review endpoint:", err);
    return res.status(500).json({ error: "AI review failed", details: String(err) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ AI Code Reviewer backend listening on http://localhost:${PORT}`));