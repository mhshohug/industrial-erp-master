const express = require("express");
const axios = require("axios");
const cors = require("cors");

const router = express.Router();

router.use(cors());
router.use(express.json());
router.use(express.static(__dirname));

// ===============================
// STN SHEETS ONLY (MAIN GID REMOVED)
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
// FETCH FUNCTION
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

  // =====================================================
  // TOTAL (ALL MACHINE) LOGIC
  // =====================================================
  if (question.startsWith("total")) {

    let monthMatch = question.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
    let selectedMonth = monthMatch ? monthMatch[1] : currentMonth;

    let finalOutput =
`📊 ${selectedMonth.toUpperCase()} MACHINE WISE REPORT
━━━━━━━━━━━━━━━━━━
`;

    let allMachineGrandTotal = 0;
    let combinedHeaderTotals = {};

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

      finalOutput += `\n🏭 STN ${stn}\n━━━━━━━━━━━━━━━━━━\n`;

      let machineGrandTotal = 0;

      headers.forEach((h,i)=>{
        if (i === 0) return;

        const total = getTotal(i);

        if (total !== 0) {

          machineGrandTotal += total;
          finalOutput += `${h} : ${total.toLocaleString()}\n`;

          if (!combinedHeaderTotals[h])
            combinedHeaderTotals[h] = 0;

          combinedHeaderTotals[h] += total;
        }
      });

      finalOutput += `\nMachine Total : ${machineGrandTotal.toLocaleString()}\n`;
      allMachineGrandTotal += machineGrandTotal;
    }

    // HEADER WISE TOTAL
    finalOutput += `\n━━━━━━━━━━━━━━━━━━\n📦 HEADER WISE TOTAL (ALL MACHINE)\n━━━━━━━━━━━━━━━━━━\n`;

    for (let header in combinedHeaderTotals) {
      finalOutput += `${header} : ${combinedHeaderTotals[header].toLocaleString()}\n`;
    }

    // ALL MACHINE GRAND TOTAL
    finalOutput += `\n━━━━━━━━━━━━━━━━━━\n🏆 ALL MACHINE GRAND TOTAL\n━━━━━━━━━━━━━━━━━━\n`;
    finalOutput += `${allMachineGrandTotal.toLocaleString()}\n`;

    // PROCESS TOTAL
    let processTotals = {};
    let processGrandTotal = 0;

    for (let header in combinedHeaderTotals) {

      const name = header.toLowerCase();
      const value = combinedHeaderTotals[header];

      let processName = null;

      if (name.includes("finish")) processName = "Finish";
      else if (name.includes("dry")) processName = "Dry";
      else if (name.includes("coating")) processName = "Coating";
      else processName = "Others";

      if (!processTotals[processName])
        processTotals[processName] = 0;

      processTotals[processName] += value;
    }

    finalOutput += `\n━━━━━━━━━━━━━━━━━━\n⚙ PROCESS TOTAL (ALL MACHINE)\n━━━━━━━━━━━━━━━━━━\n`;

    for (let process in processTotals) {

      const total = processTotals[process];

      if (total > 0) {
        finalOutput += `${process} Total : ${total.toLocaleString()}\n`;
        processGrandTotal += total;
      }
    }

    finalOutput += `\nProcess Grand Total : ${processGrandTotal.toLocaleString()}\n`;

    return res.json({ reply: finalOutput });
  }

  // =====================================================
  // SINGLE STN REPORT
  // =====================================================
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
