const express = require("express");
const axios = require("axios");
const cors = require("cors");

const router = express.Router();

router.use(cors());
router.use(express.json());
router.use(express.static(__dirname));

// ===============================
// GOOGLE SHEET CONFIG
// ===============================
const SHEET_ID = "1Yt4HMt7fzJdlJ-CtdEiEHG2Bntj3CwUdPVpMSJYXPZI";

const STN_GIDS = {
  "1": "0",
  "2": "971662783",
  "3": "2123633512",
  "4": "1173207402",
  "5": "1462575320"
};
// ===============================
// FETCH SHEET FUNCTION
// ===============================
async function fetchSheetByGid(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const { data } = await axios.get(url);

  return data.split(/\r?\n/).map(line =>
    line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map(cell => cell.replace(/^"|"$/g, "").trim())
  );
}
// ===============================
// ASK ROUTE
// ===============================
router.post("/ask", async (req, res) => {

  let question = (req.body.question || "").toLowerCase().trim();

  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const now = new Date();
  const currentMonth = months[now.getMonth()];
  if (question.startsWith("total")) {

    let monthMatch = question.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
    let selectedMonth = monthMatch ? monthMatch[1] : currentMonth;

    let machineTotals = {};
    let processTotals = {};

    let machineGrandTotal = 0;
    let processGrandTotal = 0;

    for (let stn in STN_GIDS) {

      const gid = STN_GIDS[stn];
      const db = await fetchSheetByGid(gid);
      if (!db || db.length <= 1) continue;

      const headers = db[0];
      const rows = db.slice(1);

      const filteredRows =
        rows.filter(r =>
          r[0] &&
          r[0].toLowerCase().includes(selectedMonth)
        );

      if (filteredRows.length === 0) continue;

      const getTotal = (index) =>
        filteredRows.reduce((t,r)=>t+(parseFloat(r[index])||0),0);

      let stnTotal = 0;

      headers.forEach((h,i)=>{
        if (i === 0) return;

        const total = getTotal(i);

        if (total !== 0) {

          stnTotal += total;

          if (!processTotals[h])
            processTotals[h] = 0;

          processTotals[h] += total;
        }
      });

      machineTotals[stn] = stnTotal;
      machineGrandTotal += stnTotal;
    }

    if (question.startsWith("total")) {

  let monthMatch = question.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  let selectedMonth = monthMatch ? monthMatch[1] : currentMonth;

  let machineTotals = {};
  let processTotals = {};

  let machineGrandTotal = 0;
  let processGrandTotal = 0;

  for (let stn in STN_GIDS) {

    const gid = STN_GIDS[stn];
    const db = await fetchSheetByGid(gid);
    if (!db || db.length <= 1) continue;

    const headers = db[0];
    const rows = db.slice(1);

    const filteredRows =
      rows.filter(r =>
        r[0] &&
        r[0].toLowerCase().includes(selectedMonth)
      );

    if (filteredRows.length === 0) continue;

    const getTotal = (index) =>
      filteredRows.reduce((t,r)=>t+(parseFloat(r[index])||0),0);

    let stnTotal = 0;

    headers.forEach((h,i)=>{
      if (i === 0) return;

      const total = getTotal(i);

      if (total !== 0) {

        stnTotal += total;

        if (!processTotals[h])
          processTotals[h] = 0;

        processTotals[h] += total;
      }
    });

    machineTotals[stn] = stnTotal;
    machineGrandTotal += stnTotal;
  }

  // ================= OUTPUT =================

  let output =
`📊 ${selectedMonth.toUpperCase()} REPORT
━━━━━━━━━━━━━━━━━━

🏭 Machine Wish
━━━━━━━━━━━━━━━━━━
`;

  for (let stn in machineTotals) {
    output += `☑ STN ${stn} : ${machineTotals[stn].toLocaleString()}\n`;
  }

  output += `Total = ${machineGrandTotal.toLocaleString()}\n`;

  output += `\n━━━━━━━━━━━━━━━━━━\n⚙ Process Wish\n━━━━━━━━━━━━━━━━━━\n`;

  for (let process in processTotals) {
    output += `☑ ${process} : ${processTotals[process].toLocaleString()}\n`;
    processGrandTotal += processTotals[process];
  }

  output += `Total = ${processGrandTotal.toLocaleString()}\n`;

  return res.json({ reply: output });
}
  const machineMatch = question.match(/stn\s?([1-5])/);

  if (machineMatch) {

    const stnNumber = machineMatch[1];
    const gid = STN_GIDS[stnNumber];

    const db = await fetchSheetByGid(gid);

    if (!db || db.length <= 1)
      return res.json({ reply: "❌ এই STN এ ডেটা নেই" });

    const headers = db[0];
    const rows = db.slice(1);

    let monthMatch = question.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
    let selectedMonth = monthMatch ? monthMatch[1] : currentMonth;

    const filteredRows =
      rows.filter(r =>
        r[0] &&
        r[0].toLowerCase().includes(selectedMonth)
      );

    if (filteredRows.length === 0)
      return res.json({ reply: "❌ ঐ মাসে ডেটা নেই" });

    const getTotal = (index) =>
      filteredRows.reduce((t,r)=>t+(parseFloat(r[index])||0),0);

    let output =
`📊 STN ${stnNumber} - ${selectedMonth.toUpperCase()} REPORT
━━━━━━━━━━━━━━━━━━
`;

    headers.forEach((h,i)=>{
      if (i === 0) return;
      const total = getTotal(i);
      if (total !== 0)
        output += `${h} : ${total.toLocaleString()}\n`;
    });

    return res.json({ reply: output });
  }
  return res.json({
    reply: "সঠিক কমান্ড লিখুন (total, total feb, stn 1, stn 2 mar)"
  });

});

module.exports = router;
