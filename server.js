const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= FRONTEND STATIC ================= */

app.use("/export", express.static(path.join(__dirname, "export_erp")));
app.use("/factory", express.static(path.join(__dirname, "factory-erp-ai")));
app.use("/soto", express.static(path.join(__dirname, "sotoprogram")));
app.use("/allstn", express.static(path.join(__dirname, "allstn")));

/* ================= BACKEND ROUTERS ================= */

app.use("/export/api", require("./export_erp/server"));
app.use("/factory/api", require("./factory-erp-ai/server"));
app.use("/soto/api", require("./sotoprogram/server"));
app.use("/allstn/api", require("./allstn/server"));

/* ================= ROOT PAGE ================= */

app.get("/", (req, res) => {
  res.send(`
    <h2>🚀 Industrial ERP Master Server Running</h2>
    <ul>
      <li><a href="/export">Export ERP</a></li>
      <li><a href="/factory">Factory ERP AI</a></li>
      <li><a href="/soto">Soto Program</a></li>
      <li><a href="/allstn">All STN</a></li>
    </ul>
  `);
});

app.listen(PORT, () => {
  console.log("✅ MASTER SERVER RUNNING ON PORT " + PORT);
});
