const express = require("express");
const axios = require("axios");
const cors = require("cors");

const router = express.Router();
const PORT = 3000;

router.use(cors());
router.use(express.json());
router.use(express.static(__dirname));

const SHEET_ID = "1Yt4HMt7fzJdlJ-CtdEiEHG2Bntj3CwUdPVpMSJYXPZI";

// MAIN PRODUCTION SHEET
const MAIN_GID = "637178336";

// STN SHEETS
const STN_GIDS = {
  "1": "0",
  "2": "971662783",
  "3": "2123633512",
  "4": "1173207402",
  "5": "1462575320"
};

// =======================
// FETCH FUNCTION
// =======================
async function fetchSheetByGid(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const { data } = await axios.get(url);
  return data.split(/\r?\n/).map(line =>
    line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map(cell => cell.replace(/^"|"$/g, "").trim())
  );
}

router.post("/ask", async (req, res) => {

  let question = (req.body.question || "").toLowerCase().trim();

  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const now = new Date();
  const currentMonth = months[now.getMonth()];

  const mainDb = await fetchSheetByGid(MAIN_GID);

  if (!mainDb || mainDb.length <= 1)
    return res.json({ reply: "❌ ডেটা পাওয়া যায়নি!" });

  const headers = mainDb[0];
  const rows = mainDb.slice(1);

  const findColumn = (keyword) =>
    headers.findIndex(h => h.toLowerCase().includes(keyword));

  const getTotal = (index, dataRows) =>
    dataRows.reduce((t,r)=>t+(parseFloat(r[index])||0),0);

  const runningRows =
    rows.filter(r => r[0] && r[0].toLowerCase().includes(currentMonth));

  const dateMatch =
    question.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);

  if (dateMatch) {

    const day = dateMatch[1].padStart(2,"0");
    const month = dateMatch[2];

    const dateRows =
      rows.filter(r =>
        r[0] &&
        r[0].toLowerCase().includes(day) &&
        r[0].toLowerCase().includes(month)
      );

    if (dateRows.length === 0)
      return res.json({ reply: "❌ ঐ তারিখে ডেটা নেই" });

    const machineMatch = question.match(/stn\s?([1-5])/);
    if (machineMatch) {

      const stn = machineMatch[1];
      const idx = findColumn(`stn ${stn}`);

      return res.json({
        reply:
`📅 ${day} ${month.toUpperCase()} - STN ${stn}
━━━━━━━━━━━━━━━━━━
${getTotal(idx,dateRows).toLocaleString()}`
      });
    }

    if (
      question.includes("finish") ||
      question.includes("coating") ||
      question.includes("dry")
    ) {
      const idx = findColumn(question);
      if (idx !== -1) {
        return res.json({
          reply:
`📅 ${day} ${month.toUpperCase()} - ${headers[idx]}
━━━━━━━━━━━━━━━━━━
${getTotal(idx,dateRows).toLocaleString()}`
        });
      }
    }

    let output =
`📅 ${day} ${month.toUpperCase()} FULL SUMMARY
━━━━━━━━━━━━━━━━━━
`;

    headers.forEach((h,i)=>{
      if (i>0)
        output += `${h} : ${getTotal(i,dateRows).toLocaleString()}\n`;
    });

    return res.json({ reply: output });
  }

  if (question.includes("totall stn")) {

    let output =
`🏭 RUNNING MONTH - TOTALL STN SUMMARY
━━━━━━━━━━━━━━━━━━
`;

    let grandTotal = 0;

    headers.forEach((h,i)=>{
      const name = h.toLowerCase();
      if (name.includes("stn ") && !name.includes("1 day")) {
        const total = getTotal(i,runningRows);
        grandTotal += total;
        output += `${h} : ${total.toLocaleString()}\n`;
      }
    });

    output += `\nTotall Stn : ${grandTotal.toLocaleString()}\n`;

    output += "\n━━━━━━━━━━━━━━━━━━\nPROCESS TOTAL\n━━━━━━━━━━━━━━━━━━\n";

    headers.forEach((h,i)=>{
      const name = h.toLowerCase();
      if (
        name.includes("finish") ||
        name.includes("coating") ||
        name.includes("dry") ||
        name.includes("production")
      ) {
        output += `${h} : ${getTotal(i,runningRows).toLocaleString()}\n`;
      }
    });

    return res.json({ reply: output });
  }

  if (question === "totall") {

    let output =
`🏭 RUNNING MONTH FULL SUMMARY
━━━━━━━━━━━━━━━━━━
`;

    headers.forEach((h,i)=>{
      if (i>0)
        output += `${h} : ${getTotal(i,runningRows).toLocaleString()}\n`;
    });

    return res.json({ reply: output });
  }

  const machineMatch = question.match(/stn\s?([1-5])/);

  if (machineMatch) {

    const stnNumber = machineMatch[1];
    const gid = STN_GIDS[stnNumber];

    const machineDb = await fetchSheetByGid(gid);

    if (!machineDb || machineDb.length <= 1)
      return res.json({ reply: "❌ এই STN এ ডেটা নেই" });

    const mHeaders = machineDb[0];
    const mRows = machineDb.slice(1);

    const getTotalM = (index, dataRows) =>
      dataRows.reduce((t,r)=>t+(parseFloat(r[index])||0),0);

    let output =
`📊 STN ${stnNumber} FULL REPORT
━━━━━━━━━━━━━━━━━━
`;

    let grandTotal = 0;
    let breakdown = "";

    mHeaders.forEach((h,i)=>{
      const name = h.toLowerCase();

      if (
        name.includes("finish") ||
        name.includes("coating") ||
        name.includes("dry")
      ) {
        const total = getTotalM(i, mRows);
        if (total > 0) {
          grandTotal += total;
          breakdown += `${h} : ${total.toLocaleString()}\n`;
        }
      }
    });

    output += `Total : ${grandTotal.toLocaleString()}\n`;

    output += "\n━━━━━━━━━━━━━━━━━━\nPROCESS BREAKDOWN\n━━━━━━━━━━━━━━━━━━\n";

    output += breakdown;

    return res.json({ reply: output });
  }

  if (
    question.includes("finish") ||
    question.includes("coating") ||
    question.includes("dry")
  ) {
    const idx = findColumn(question);
    if (idx !== -1) {
      return res.json({
        reply:
`📊 RUNNING MONTH ${headers[idx]}
━━━━━━━━━━━━━━━━━━
${getTotal(idx,runningRows).toLocaleString()}`
      });
    }
  }

  return res.json({
    reply: "সঠিক কমান্ড লিখুন (1 feb, 1 feb stn1, totall, totall stn, stn 1)"
  });

});

module.exports = router;
