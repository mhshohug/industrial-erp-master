const express = require("express");
const axios = require("axios");
const cors = require("cors");

const router = express.Router();
router.use(cors());
router.use(express.json());
router.use(express.static(__dirname));

const SHEET_ID = "17AlSp8QqY3_YmW9bb1W-fMg9m7FFBxtYKXc2Cr9fq3A";
const GID = "1037993780";

// ================= LOAD GOOGLE SHEET =================
async function loadSheet() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
    const { data } = await axios.get(url);

    return data
      .split(/\r?\n/)
      .map(r =>
        r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
         .map(c => c.replace(/^"|"$/g, "").trim())
      );
  } catch (err) {
    console.log("Sheet Load Error:", err.message);
    return [];
  }
}

// ================= IMAGE PROXY (SAFE VERSION) =================
router.get("/img/:id", async (req, res) => {
  try {

    const driveUrl = `https://drive.google.com/uc?export=download&id=${req.params.id}`;

    const img = await axios.get(driveUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    res.set("Content-Type", img.headers["content-type"] || "image/jpeg");
    res.send(img.data);

  } catch (err) {
    console.log("Image Error:", err.message);
    res.status(404).send("No Image");
  }
});

// ================= SEARCH SYSTEM =================
router.post("/ask", async (req, res) => {

  try {

    const q = (req.body.question || "").trim().toLowerCase();
    if (!q) return res.json({ reply: "সিল / লট / পার্টি লিখুন" });

    const db = await loadSheet();
    if (db.length <= 1)
      return res.json({ reply: "ডাটা পাওয়া যায়নি" });

    const data = db.slice(1); // remove header
    let rows = [];

    // ===== Number → Sill / Lot Search =====
    if (/^\d+$/.test(q)) {
      rows = data.filter(r =>
        (r[1] || "") === q ||     // Sill
        (r[6] || "") === q        // Lot
      );
    }
    // ===== Text → Party Search =====
    else {
      rows = data.filter(r =>
        (r[3] || "").toLowerCase().includes(q)
      );
    }

    if (rows.length === 0)
      return res.json({ reply: `${q} পাওয়া যায়নি` });

    // ===== Latest 14 Only =====
    rows = rows.slice(-14).reverse();

    let finalReply = `🔎 Total Found: ${rows.length}\n\n`;

    rows.forEach((row, index) => {

      const sill = row[1] || "N/A";
      const img = row[2] || "";
      const party = row[3] || "N/A";
      const quality = row[4] || "N/A";
      const construction = row[5] || "N/A";
      const lot = row[6] || "N/A";

      finalReply +=
`📊 RESULT ${index + 1}
SILL: ${sill}
👤 Party: ${party}
🧵 Quality: ${quality}
🧶 Construction: ${construction}
📦 Lot: ${lot}
`;

      // ===== Image Handle =====
      if (img.includes("drive.google.com")) {
        const idMatch = img.match(/[-\w]{25,}/);
        if (idMatch) {
          finalReply += `IMAGE:/soto/api/img/${idMatch[0]}\n`;
        }
      }

      finalReply += "\n----------------------\n\n";
    });

    res.json({ reply: finalReply });

  } catch (err) {
    console.log("Search Error:", err.message);
    res.json({ reply: "সার্ভার সমস্যা হয়েছে" });
  }
});

module.exports = router;
