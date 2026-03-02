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
// METER → YDS CONVERSION
// ===============================
function toYds(meter){
  return meter * 1.09361;
}

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

  // =====================================================
  // 1️⃣ MONTH REPORT
  // =====================================================
  const monthOnlyMatch = question.match(/^(total\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/);

  if (monthOnlyMatch) {

    const selectedMonth = monthOnlyMatch[2];

    let machineTotals = {};
    let processTotals = {};
    let machineGrandTotal = 0;
    let processGrandTotal = 0;

    for (let stn in STN_GIDS) {

      const db = await fetchSheetByGid(STN_GIDS[stn]);
      if (!db || db.length <= 1) continue;

      const headers = db[0];
      const rows = db.slice(1);

      const filteredRows = rows.filter(r =>
        r[0] && r[0].toLowerCase().includes(selectedMonth)
      );

      if (!filteredRows.length) continue;

      const getTotal = i =>
        filteredRows.reduce((t,r)=>t+(parseFloat(r[i])||0),0);

      let stnTotal = 0;

      headers.forEach((h,i)=>{
        if(i===0) return;

        const total = toYds(getTotal(i));

        if(total !== 0){
          stnTotal += total;

          if(!processTotals[h]) processTotals[h]=0;
          processTotals[h]+=total;
        }
      });

      machineTotals[stn]=stnTotal;
      machineGrandTotal+=stnTotal;
    }

    let output =
`📊 ${selectedMonth.toUpperCase()} REPORT (YDS)
━━━━━━━━━━━━━━━━━━

🏭 Machine Wish
━━━━━━━━━━━━━━━━━━
`;

    for(let stn in machineTotals){
      output += `☑ STN ${stn} : ${machineTotals[stn]
      .toLocaleString(undefined,{maximumFractionDigits:2})} YDS\n`;
    }

    output += `Total = ${machineGrandTotal
    .toLocaleString(undefined,{maximumFractionDigits:2})} YDS\n`;

    output += `\n━━━━━━━━━━━━━━━━━━\n⚙ Process Wish\n━━━━━━━━━━━━━━━━━━\n`;

    for(let p in processTotals){
      output += `☑ ${p} : ${processTotals[p]
      .toLocaleString(undefined,{maximumFractionDigits:2})} YDS\n`;
      processGrandTotal+=processTotals[p];
    }

    output += `Total = ${processGrandTotal
    .toLocaleString(undefined,{maximumFractionDigits:2})} YDS\n`;

    return res.json({ reply: output });
  }

  // =====================================================
  // 2️⃣ DATE REPORT
  // =====================================================
  const dateMatch = question.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/);

  if (dateMatch) {

    const day = parseInt(dateMatch[1]);
    const month = dateMatch[2];

    let processSummary = {};
    let processGrandTotal = 0;

    let output =
`📅 ${day.toString().padStart(2,"0")} ${month.toUpperCase()} REPORT (YDS)
━━━━━━━━━━━━━━━━━━
`;

    for (let stn in STN_GIDS) {

      const db = await fetchSheetByGid(STN_GIDS[stn]);
      if (!db || db.length <= 1) continue;

      const headers = db[0];
      const rows = db.slice(1);

      const filteredRows = rows.filter(r=>{
        if(!r[0]) return false;
        const d=new Date(r[0]);
        if(isNaN(d)) return false;
        return d.getDate()===day && months[d.getMonth()]===month;
      });

      if(!filteredRows.length) continue;

      const getTotal=i=>
        filteredRows.reduce((t,r)=>t+(parseFloat(r[i])||0),0);

      let stnTotal=0;
      let block=`\n🏭 STN ${stn}\n━━━━━━━━━━━━━━━━━━\n`;

      headers.forEach((h,i)=>{
        if(i===0) return;

        const total = toYds(getTotal(i));

        if(total!==0){
          stnTotal+=total;
          block+=`${h} : ${total
          .toLocaleString(undefined,{maximumFractionDigits:2})} YDS\n`;

          if(!processSummary[h]) processSummary[h]=0;
          processSummary[h]+=total;
        }
      });

      block+=`Total = ${stnTotal
      .toLocaleString(undefined,{maximumFractionDigits:2})} YDS\n`;

      output+=block;
    }

    output+=`\n━━━━━━━━━━━━━━━━━━\n⚙ PROCESS SUMMARY (ALL STN)\n━━━━━━━━━━━━━━━━━━\n`;

    for(let p in processSummary){
      output+=`${p} : ${processSummary[p]
      .toLocaleString(undefined,{maximumFractionDigits:2})} YDS\n`;
      processGrandTotal+=processSummary[p];
    }

    output+=`Total = ${processGrandTotal
    .toLocaleString(undefined,{maximumFractionDigits:2})} YDS\n`;

    return res.json({ reply: output });
  }

  // =====================================================
  // 3️⃣ SINGLE STN REPORT
  // =====================================================
  const stnMatch = question.match(/^stn\s?([1-5])(\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))?$/);

  if (stnMatch) {

    const stnNumber = stnMatch[1];
    const selectedMonth = stnMatch[3] || currentMonth;

    const db = await fetchSheetByGid(STN_GIDS[stnNumber]);
    if (!db || db.length <= 1)
      return res.json({ reply:"❌ এই STN এ ডেটা নেই" });

    const headers=db[0];
    const rows=db.slice(1);

    const filteredRows = rows.filter(r =>
      r[0] && r[0].toLowerCase().includes(selectedMonth)
    );

    if(!filteredRows.length)
      return res.json({ reply:"❌ ঐ মাসে ডেটা নেই" });

    const getTotal=i=>
      filteredRows.reduce((t,r)=>t+(parseFloat(r[i])||0),0);

    let output =
`📊 STN ${stnNumber} - ${selectedMonth.toUpperCase()} REPORT (YDS)
━━━━━━━━━━━━━━━━━━
`;

    headers.forEach((h,i)=>{
      if(i===0) return;

      const total = toYds(getTotal(i));

      if(total!==0)
        output+=`${h} : ${total
        .toLocaleString(undefined,{maximumFractionDigits:2})} YDS\n`;
    });

    return res.json({ reply:output });
  }

  return res.json({
    reply:"সঠিক কমান্ড লিখুন (mar, total mar, 1 mar, stn 3 mar)"
  });

});

module.exports = router;
