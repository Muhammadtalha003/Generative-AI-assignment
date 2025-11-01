require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ Error: GEMINI_API_KEY not found. Please create a .env file.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// 🧠 Prompt for reviewing code
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


// 🧩 API route to handle review requests
app.post("/review", async (req, res) => {
  try {
    const userCode = req.body.code || "";

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${prompt}\n\nHere is the code:\n${userCode}`,
            },
          ],
        },
      ],
    });

    console.log("Raw API result for debugging:");
    console.dir(result, { depth: null });

    let feedback;
    if (result?.response) {
      feedback =
        typeof result.response.text === "function"
          ? await result.response.text()
          : result.response.text;
    } else if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
      feedback = result.candidates[0].content.parts[0].text;
    } else if (result?.output?.[0]?.content?.[0]?.text) {
      feedback = result.output[0].content[0].text;
    } else {
      feedback = JSON.stringify(result, null, 2);
    }

    res.json({ review: feedback });
  } catch (error) {
    console.error("Error while reviewing code:", error);
    res.status(500).json({ error: "Failed to analyze code.", details: String(error) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
