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
// HTML WRAPPER FUNCTION
// ===============================
const htmlWrapper = (title, content) => {
    return `
    <style>
        .report-container {
            font-family: Arial, sans-serif;
            background: #ffffff;
            color: #1a202c;
            padding: 12px;
            border-radius: 8px;
            margin: 5px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .report-header {
            font-size: 16px;
            font-weight: bold;
            color: #2d3748;
            padding: 8px;
            background: #e2e8f0;
            border-radius: 6px;
            margin-bottom: 10px;
            border-left: 4px solid #22c55e;
        }
        .stn-block {
            margin: 10px 0;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            overflow: hidden;
        }
        .stn-title {
            background: #2d3748;
            color: white;
            padding: 6px 10px;
            font-weight: bold;
        }
        .process-row {
            display: flex;
            padding: 5px 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        .process-row:last-child {
            border-bottom: none;
        }
        .process-name {
            flex: 1;
            font-weight: 500;
        }
        .process-value {
            font-weight: bold;
            color: #2d3748;
        }
        .total-row {
            background: #f0f4f8;
            padding: 8px 10px;
            font-weight: bold;
            border-top: 2px solid #cbd5e0;
        }
        .summary-box {
            background: #f0f4f8;
            padding: 10px;
            margin-top: 10px;
            border-radius: 6px;
            border-left: 4px solid #22c55e;
        }
        .summary-title {
            font-weight: bold;
            margin-bottom: 5px;
            color: #2d3748;
        }
        hr {
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 8px 0;
        }
        @media (max-width: 480px) {
            .report-container { padding: 8px; }
            .report-header { font-size: 14px; }
            .process-row { font-size: 12px; }
        }
    </style>
    <div class="report-container">
        <div class="report-header">📊 ${title}</div>
        ${content}
    </div>
    `;
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
// NUMBER FORMATTER
// ===============================
const formatNumber = (num) => {
  return num.toLocaleString(undefined, {maximumFractionDigits: 2});
};

// ===============================
// ASK ROUTE
// ===============================
router.post("/ask", async (req, res) => {

  let question = (req.body.question || "").toLowerCase().trim();

  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const now = new Date();
  const currentMonth = months[now.getMonth()];

  // =====================================================
  // 1️⃣ MONTH REPORT (HTML VERSION)
  // =====================================================
  const monthOnlyMatch = question.match(/^(total\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/);

  if (monthOnlyMatch) {

    const selectedMonth = monthOnlyMatch[2];

    let machineTotals = {};
    let processTotals = {};
    let machineGrandTotal = 0;
    let processGrandTotal = 0;

    let machineRows = '';
    let processRows = '';

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
      
      machineRows += `
        <div class="process-row">
          <span class="process-name">STN ${stn}</span>
          <span class="process-value">${formatNumber(stnTotal)} YDS</span>
        </div>
      `;
    }

    // Process wise totals
    for(let p in processTotals){
      processRows += `
        <div class="process-row">
          <span class="process-name">${p}</span>
          <span class="process-value">${formatNumber(processTotals[p])} YDS</span>
        </div>
      `;
      processGrandTotal += processTotals[p];
    }

    let content = `
      <div class="stn-block">
        <div class="stn-title">🏭 MACHINE WISE</div>
        ${machineRows}
        <div class="total-row">
          <span style="font-weight:bold">TOTAL</span>
          <span style="float:right">${formatNumber(machineGrandTotal)} YDS</span>
        </div>
      </div>
      
      <div class="stn-block">
        <div class="stn-title">⚙ PROCESS WISE</div>
        ${processRows}
        <div class="total-row">
          <span style="font-weight:bold">TOTAL</span>
          <span style="float:right">${formatNumber(processGrandTotal)} YDS</span>
        </div>
      </div>
    `;

    return res.json({ reply: htmlWrapper(`${selectedMonth.toUpperCase()} REPORT`, content) });
  }

  // =====================================================
  // 2️⃣ DATE REPORT (HTML VERSION)
  // =====================================================
  const dateMatch = question.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/);

  if (dateMatch) {

    const day = parseInt(dateMatch[1]);
    const month = dateMatch[2];

    let processSummary = {};
    let processGrandTotal = 0;
    
    let allStnContent = '';

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
      let stnRows = '';

      headers.forEach((h,i)=>{
        if(i===0) return;

        const total = toYds(getTotal(i));

        if(total!==0){
          stnTotal+=total;
          stnRows += `
            <div class="process-row">
              <span class="process-name">${h}</span>
              <span class="process-value">${formatNumber(total)} YDS</span>
            </div>
          `;

          if(!processSummary[h]) processSummary[h]=0;
          processSummary[h]+=total;
        }
      });

      if(stnRows) {
        allStnContent += `
          <div class="stn-block">
            <div class="stn-title">🏭 STN ${stn}</div>
            ${stnRows}
            <div class="total-row">
              <span style="font-weight:bold">TOTAL</span>
              <span style="float:right">${formatNumber(stnTotal)} YDS</span>
            </div>
          </div>
        `;
      }
    }

    // Process summary
    let processRows = '';
    for(let p in processSummary){
      processRows += `
        <div class="process-row">
          <span class="process-name">${p}</span>
          <span class="process-value">${formatNumber(processSummary[p])} YDS</span>
        </div>
      `;
      processGrandTotal += processSummary[p];
    }

    let content = allStnContent + `
      <div class="stn-block">
        <div class="stn-title">⚙ PROCESS SUMMARY (ALL STN)</div>
        ${processRows}
        <div class="total-row">
          <span style="font-weight:bold">TOTAL</span>
          <span style="float:right">${formatNumber(processGrandTotal)} YDS</span>
        </div>
      </div>
    `;

    return res.json({ 
      reply: htmlWrapper(`${day.toString().padStart(2,"0")} ${month.toUpperCase()} REPORT`, content) 
    });
  }

  // =====================================================
  // 3️⃣ SINGLE STN REPORT (HTML VERSION)
  // =====================================================
  const stnMatch = question.match(/^stn\s?([1-5])(\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))?$/);

  if (stnMatch) {

    const stnNumber = stnMatch[1];
    const selectedMonth = stnMatch[3] || currentMonth;

    const db = await fetchSheetByGid(STN_GIDS[stnNumber]);
    if (!db || db.length <= 1)
      return res.json({ reply: htmlWrapper("Error", "❌ এই STN এ ডেটা নেই") });

    const headers = db[0];
    const rows = db.slice(1);

    const filteredRows = rows.filter(r =>
      r[0] && r[0].toLowerCase().includes(selectedMonth)
    );

    if(!filteredRows.length)
      return res.json({ reply: htmlWrapper("Error", "❌ ঐ মাসে ডেটা নেই") });

    const getTotal = i =>
      filteredRows.reduce((t,r)=>t+(parseFloat(r[i])||0),0);

    let stnRows = '';
    let total = 0;

    headers.forEach((h,i)=>{
      if(i===0) return;

      const val = toYds(getTotal(i));

      if(val !== 0){
        stnRows += `
          <div class="process-row">
            <span class="process-name">${h}</span>
            <span class="process-value">${formatNumber(val)} YDS</span>
          </div>
        `;
        total += val;
      }
    });

    let content = `
      <div class="stn-block">
        <div class="stn-title">🏭 STN ${stnNumber}</div>
        ${stnRows}
        <div class="total-row">
          <span style="font-weight:bold">TOTAL</span>
          <span style="float:right">${formatNumber(total)} YDS</span>
        </div>
      </div>
    `;

    return res.json({ 
      reply: htmlWrapper(`STN ${stnNumber} - ${selectedMonth.toUpperCase()}`, content) 
    });
  }

  return res.json({
    reply: htmlWrapper("Commands", `
      <div style="padding:10px">
        <b>সঠিক কমান্ড লিখুন:</b><br><br>
        • mar (মাস রিপোর্ট)<br>
        • total mar (মাস রিপোর্ট)<br>
        • 1 mar (তারিখ রিপোর্ট)<br>
        • stn 3 mar (স্টেশন রিপোর্ট)
      </div>
    `)
  });

});

module.exports = router;
