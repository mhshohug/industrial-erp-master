const express = require("express");
const axios = require("axios");
const cors = require("cors");

const router = express.Router();

router.use(cors());
router.use(express.json());
router.use(express.static(__dirname));

const SHEET_ID = "17AlSp8QqY3_YmW9bb1W-fMg9m7FFBxtYKXc2Cr9fq3A";

const GID_MAP = {
  grey: "1069156463",
  singing: "1204186084",
  marcerise: "883470384",
  bleach: "1612554044",
  cpb: "809334692",
  napthol: "1825175747",
  jigger: "392149567",
  ex_jigger: "843042263",
  folding: "2051005815",
};

// ================= HTML WRAPPER ফাংশন =================
const htmlWrapper = (title, content) => {
    return `
    <style>
        .erp-container {
            font-family: Arial, sans-serif;
            max-width: 100%;
            background: #ffffff;
            padding: 8px;
            border-radius: 5px;
        }
        .erp-header {
            font-size: 14px;
            font-weight: bold;
            color: #1a202c;
            background: #e2e8f0;
            padding: 6px 8px;
            margin: 0 0 8px 0;
            border-radius: 4px;
            border-left: 4px solid #2d3748;
        }
        .erp-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin: 5px 0;
            background: white;
        }
        .erp-table th {
            background: #2d3748;
            color: white;
            padding: 6px 4px;
            font-size: 11px;
            font-weight: bold;
            text-align: center;
            border: 1px solid #1a202c;
        }
        .erp-table td {
            padding: 5px 4px;
            border: 1px solid #cbd5e0;
            color: #1a202c;
            background: white;
        }
        .erp-table tr:nth-child(even) td {
            background: #f8fafc;
        }
        .erp-table tr:hover td {
            background: #e6f7ff;
        }
        .positive { 
            color: #0b5e0b; 
            font-weight: bold; 
            background: #e6ffe6 !important;
        }
        .negative { 
            color: #b22222; 
            font-weight: bold;
            background: #ffe6e6 !important;
        }
        .summary-box {
            background: #edf2f7;
            padding: 8px;
            margin-top: 8px;
            font-size: 12px;
            font-weight: bold;
            border-radius: 4px;
            border-left: 4px solid #2d3748;
            color: #1a202c;
        }
        .info-row {
            background: #f0f4f8;
            padding: 6px 8px;
            margin: 5px 0;
            border-radius: 4px;
            font-size: 12px;
            color: #1a202c;
            border: 1px solid #cbd5e0;
        }
        .month-header {
            font-size: 16px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 8px;
            padding: 5px;
            background: #edf2f7;
            border-radius: 4px;
            text-align: center;
        }
        .stat-box {
            display: inline-block;
            padding: 4px 8px;
            margin: 2px;
            background: #e2e8f0;
            border-radius: 4px;
            font-size: 11px;
        }
    </style>
    <div class="erp-container">
        <div class="erp-header">📊 ${title}</div>
        ${content}
    </div>
    `;
};

function safeNumber(val) {
  return parseFloat((val || "0").toString().replace(/,/g,"")) || 0;
}

function normalizeSill(val) {
  return (val || "").toString().replace(/[^0-9]/g,"");
}

function parseSheetDate(raw) {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function sameDate(d1,d2){
  return d1 && d2 &&
    d1.getDate()===d2.getDate() &&
    d1.getMonth()===d2.getMonth() &&
    d1.getFullYear()===d2.getFullYear();
}

function getKeywordDate(input){
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate()-1);

  const lower = input.toLowerCase();

  if(lower.includes("today")||lower.includes("aj")) return today;
  if(lower.includes("yesterday")||lower.includes("kal")) return yesterday;

  const match = lower.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if(match){
    const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    return new Date(today.getFullYear(), months[match[2]], parseInt(match[1]));
  }

  return null;
}

async function fetchSheet(gid){
  try{
    const url=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    const {data}=await axios.get(url);
    return data.split(/\r?\n/).map(line =>
      line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map(cell=>cell.replace(/^"|"$/g,"").trim())
    );
  }catch{
    return [];
  }
}
/* =========================================================
   PART 2 – CALCULATION ENGINE (SAFE VERSION)
========================================================= */

/* ===================== UNIVERSAL SUM ===================== */

function getProcessSum(db, sheetName, targetDate = null) {

  const rows = db[sheetName]?.slice(1) || [];

  return rows.reduce((total, row) => {

    if (!targetDate)
      return total + safeNumber(row[6]);

    const rowDate = parseSheetDate(row[0]);
    if (!rowDate) return total;

    if (sameDate(rowDate, targetDate))
      return total + safeNumber(row[6]);

    return total;

  }, 0);
}


/* ===================== MONTHLY PER DAY ===================== */

function getMonthlyPerDay(db, sheetName) {

  const today = new Date();
  const month = today.getMonth();
  const year = today.getFullYear();

  let days = [];
  let grandTotal = 0;
  let highest = 0;
  let lowest = null;

  for (let d = 1; d <= today.getDate(); d++) {

    const target = new Date(year, month, d);
    const qty = getProcessSum(db, sheetName, target);

    days.push({ day: d, qty });

    grandTotal += qty;

    if (qty > highest) highest = qty;
    if (lowest === null || qty < lowest) lowest = qty;
  }

  return {
    days,
    total: grandTotal,
    highest,
    lowest
  };
}


/* ===================== FACTORY TOTAL ===================== */

function getFactoryTotals(db) {

  const s = getProcessSum(db,"singing");
  const m = getProcessSum(db,"marcerise");
  const b = getProcessSum(db,"bleach");

  const c = getProcessSum(db,"cpb");
  const j = getProcessSum(db,"jigger");
  const ex = getProcessSum(db,"ex_jigger");
  const n = getProcessSum(db,"napthol");

  const f = getProcessSum(db,"folding");

  return {
    process: { s, m, b },
    dyeing: { c, j, ex, n },
    folding: f,
    dyeTotal: c + j + ex + n
  };
}


/* ===================== DATE WISE REPORT ===================== */

function getDateReport(db, targetDate) {

  const s = getProcessSum(db,"singing",targetDate);
  const m = getProcessSum(db,"marcerise",targetDate);
  const b = getProcessSum(db,"bleach",targetDate);

  const c = getProcessSum(db,"cpb",targetDate);
  const j = getProcessSum(db,"jigger",targetDate);
  const ex = getProcessSum(db,"ex_jigger",targetDate);
  const n = getProcessSum(db,"napthol",targetDate);

  const f = getProcessSum(db,"folding",targetDate);

  return {
    process: { s, m, b },
    dyeing: { c, j, ex, n },
    folding: f,
    total: s + m + b + c + j + ex + n
  };
}


/* ===================== PARTY SUMMARY ===================== */

function getPartyFullSummary(db, partyName) {

  const greyRows = db.grey?.slice(1).filter(row =>
    row[2] && row[2].toLowerCase().includes(partyName)
  ) || [];

  if (greyRows.length === 0) return null;

  let reports = [];
  let totalLot = 0;
  let totalDye = 0;

  greyRows.slice(-15).forEach(row => {

    const sill = normalizeSill(row[1]);
    const quality = row[3] || "N/A";
    const lot = safeNumber(row[5]);

    const sumProc = (proc) =>
      db[proc]?.slice(1).reduce((t,r)=>
        normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t
      ,0) || 0;

    const dyeTotal =
      sumProc("cpb") +
      sumProc("jigger") +
      sumProc("ex_jigger") +
      sumProc("napthol");

    totalLot += lot;
    totalDye += dyeTotal;

    reports.push({
      party: row[2],
      sill,
      quality,
      lot,
      dyeTotal
    });
  });

  return {
    reports,
    totalCount: greyRows.length,
    totalLot,
    totalDye
  };
}


/* ===================== SILL FULL REPORT ===================== */

function getSillReport(db, inputNumber) {

  const greyRows = db.grey?.slice(1).filter(row =>
    normalizeSill(row[1]) === inputNumber ||
    normalizeSill(row[5]) === inputNumber
  ) || [];

  if (greyRows.length === 0) return null;

  return greyRows.map(row => {

    const sill = normalizeSill(row[1]);
    const party = row[2] || "N/A";
    const quality = row[3] || "N/A";
    const lot = safeNumber(row[5]);

    const sumProc = (proc) =>
      db[proc]?.slice(1).reduce((t,r)=>
        normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t
      ,0) || 0;

    const s = sumProc("singing");
    const m = sumProc("marcerise");
    const b = sumProc("bleach");
    const c = sumProc("cpb");
    const j = sumProc("jigger");
    const ex = sumProc("ex_jigger");
    const n = sumProc("napthol");
    const f = sumProc("folding");

    const dyeTotal = c + j + ex + n;
    const diff = lot - dyeTotal;

    return {
      party,
      sill,
      quality,
      lot,
      process: { s, m, b },
      dyeing: { c, j, ex, n },
      folding: f,
      dyeTotal,
      diff
    };
  });
}
/* =========================================================
   PART 3 – ROUTER START + HTML FORMATTERS
========================================================= */

router.post("/ask", async (req, res) => {

  const rawInput = (req.body.question || "").trim();
  const question = rawInput.toLowerCase();
  const cleanInput = question.replace(/\s+/g, "");

  const keys = Object.keys(GID_MAP);

  const results = await Promise.all(
    keys.map(k => fetchSheet(GID_MAP[k]))
  );

  const db = {};
  keys.forEach((k,i)=> db[k]=results[i]);


  /* ===================== HTML FORMATTERS ===================== */

  function formatPerDayHTML(proc, data) {
    const today = new Date();
    const monthName = today.toLocaleString("default", { month: "long" });
    
    let rows = '';
    data.days.forEach(d => {
      rows += `<tr><td>${String(d.day).padStart(2, '0')}</td><td>${d.qty.toLocaleString()}</td></tr>`;
    });

    return htmlWrapper(`${proc.toUpperCase()} Daily Production - ${monthName}`, `
      <table class="erp-table">
        <tr><th>Date</th><th>Yards</th></tr>
        ${rows}
      </table>
      <div class="summary-box">
        <span class="stat-box">📈 Highest: ${data.highest.toLocaleString()}</span>
        <span class="stat-box">📉 Lowest: ${data.lowest.toLocaleString()}</span>
        <span class="stat-box">📍 Total: ${data.total.toLocaleString()}</span>
      </div>
    `);
  }

  function formatFactorySummaryHTML(data) {
    return htmlWrapper(`Factory Summary`, `
      <table class="erp-table">
        <tr><th colspan="2">PROCESS</th></tr>
        <tr><td>Singing</td><td>${data.process.s.toLocaleString()}</td></tr>
        <tr><td>Mercerise</td><td>${data.process.m.toLocaleString()}</td></tr>
        <tr><td>Bleach</td><td>${data.process.b.toLocaleString()}</td></tr>
        
        <tr><th colspan="2">DYEING</th></tr>
        <tr><td>CPB</td><td>${data.dyeing.c.toLocaleString()}</td></tr>
        <tr><td>Jigger</td><td>${data.dyeing.j.toLocaleString()}</td></tr>
        <tr><td>Ex-Jigger</td><td>${data.dyeing.ex.toLocaleString()}</td></tr>
        <tr><td>Napthol</td><td>${data.dyeing.n.toLocaleString()}</td></tr>
        
        <tr><th colspan="2">FINISHING</th></tr>
        <tr><td>Folding</td><td>${data.folding.toLocaleString()}</td></tr>
      </table>
      <div class="summary-box">📍 Total Dyeing: ${data.dyeTotal.toLocaleString()} yds</div>
    `);
  }

  function formatDateReportHTML(data, dateStr) {
    return htmlWrapper(`Daily Report - ${dateStr}`, `
      <table class="erp-table">
        <tr><th colspan="2">PROCESS</th></tr>
        <tr><td>Singing</td><td>${data.process.s.toLocaleString()}</td></tr>
        <tr><td>Mercerise</td><td>${data.process.m.toLocaleString()}</td></tr>
        <tr><td>Bleach</td><td>${data.process.b.toLocaleString()}</td></tr>
        
        <tr><th colspan="2">DYEING</th></tr>
        <tr><td>CPB</td><td>${data.dyeing.c.toLocaleString()}</td></tr>
        <tr><td>Jigger</td><td>${data.dyeing.j.toLocaleString()}</td></tr>
        <tr><td>Ex-Jigger</td><td>${data.dyeing.ex.toLocaleString()}</td></tr>
        <tr><td>Napthol</td><td>${data.dyeing.n.toLocaleString()}</td></tr>
        
        <tr><th colspan="2">FINISHING</th></tr>
        <tr><td>Folding</td><td>${data.folding.toLocaleString()}</td></tr>
      </table>
      <div class="summary-box">📍 Total: ${data.total.toLocaleString()} yds</div>
    `);
  }

  function formatPartySummaryHTML(data) {
    const completion = data.totalLot > 0 ? ((data.totalDye / data.totalLot) * 100).toFixed(1) : 0;
    
    let rows = '';
    data.reports.forEach(r => {
      const status = r.lot - r.dyeTotal <= 0 ? 'positive' : 'negative';
      const statusText = r.lot - r.dyeTotal <= 0 ? 'EXTRA' : 'SHORT';
      
      rows += `
      <tr>
        <td>${r.sill}</td>
        <td>${r.quality}</td>
        <td>${r.lot.toLocaleString()}</td>
        <td>${r.dyeTotal.toLocaleString()}</td>
        <td class="${status}">${statusText}</td>
      </tr>`;
    });

    return htmlWrapper(`Party Report`, `
      <div class="info-row">Showing ${data.reports.length} of ${data.totalCount} entries</div>
      <table class="erp-table">
        <tr><th>Sill</th><th>Quality</th><th>Lot</th><th>Dye</th><th>Status</th></tr>
        ${rows}
      </table>
      <div class="summary-box">
        📦 Total Lot: ${data.totalLot.toLocaleString()} yds<br>
        🎨 Total Dye: ${data.totalDye.toLocaleString()} yds<br>
        📊 Completion: ${completion}%
      </div>
    `);
  }

  function formatSillReportHTML(reports) {
    let output = '';
    
    reports.forEach((r, idx) => {
      const statusClass = r.diff <= 0 ? 'positive' : 'negative';
      const statusText = r.diff <= 0 ? 'EXTRA' : 'SHORT';
      
      output += `
        <div class="info-row">
          <b>Sill ${r.sill}</b> | ${r.party} | ${r.quality} | Lot: ${r.lot.toLocaleString()}
        </div>
        <table class="erp-table">
          <tr><th colspan="2">PROCESS</th></tr>
          <tr><td>Singing</td><td>${r.process.s.toLocaleString()}</td></tr>
          <tr><td>Mercerise</td><td>${r.process.m.toLocaleString()}</td></tr>
          <tr><td>Bleach</td><td>${r.process.b.toLocaleString()}</td></tr>
          
          <tr><th colspan="2">DYEING</th></tr>
          <tr><td>CPB</td><td>${r.dyeing.c.toLocaleString()}</td></tr>
          <tr><td>Jigger</td><td>${r.dyeing.j.toLocaleString()}</td></tr>
          <tr><td>Ex-Jigger</td><td>${r.dyeing.ex.toLocaleString()}</td></tr>
          <tr><td>Napthol</td><td>${r.dyeing.n.toLocaleString()}</td></tr>
          
          <tr><th colspan="2">FINISHING</th></tr>
          <tr><td>Folding</td><td>${r.folding.toLocaleString()}</td></tr>
        </table>
        <div class="summary-box ${statusClass}">
          🎨 Total Dye: ${r.dyeTotal.toLocaleString()} yds<br>
          📊 Status: ${statusText} ${Math.abs(r.diff).toLocaleString()} yds
        </div>
        ${idx < reports.length - 1 ? '<div style="margin: 10px 0;"></div>' : ''}
      `;
    });

    return htmlWrapper(`Sill Production Report`, output);
  }

  function formatMonthSummaryHTML(monthName, process, dyeing, folding, dyeTotal) {
    return htmlWrapper(`${monthName} Factory Summary`, `
      <table class="erp-table">
        <tr><th colspan="2">PROCESS</th></tr>
        <tr><td>Singing</td><td>${process.s.toLocaleString()}</td></tr>
        <tr><td>Mercerise</td><td>${process.m.toLocaleString()}</td></tr>
        <tr><td>Bleach</td><td>${process.b.toLocaleString()}</td></tr>
        
        <tr><th colspan="2">DYEING</th></tr>
        <tr><td>CPB</td><td>${dyeing.c.toLocaleString()}</td></tr>
        <tr><td>Jigger</td><td>${dyeing.j.toLocaleString()}</td></tr>
        <tr><td>Ex-Jigger</td><td>${dyeing.ex.toLocaleString()}</td></tr>
        <tr><td>Napthol</td><td>${dyeing.n.toLocaleString()}</td></tr>
        
        <tr><th colspan="2">FINISHING</th></tr>
        <tr><td>Folding</td><td>${folding.toLocaleString()}</td></tr>
      </table>
      <div class="summary-box">📍 Total Dyeing: ${dyeTotal.toLocaleString()} yds</div>
    `);
  }

  function formatTotalDyeingHTML(c, j, ex, n) {
    const total = c + j + ex + n;
    return htmlWrapper(`Total Dyeing`, `
      <table class="erp-table">
        <tr><td>CPB</td><td>${c.toLocaleString()}</td></tr>
        <tr><td>Jigger</td><td>${j.toLocaleString()}</td></tr>
        <tr><td>Ex-Jigger</td><td>${ex.toLocaleString()}</td></tr>
        <tr><td>Napthol</td><td>${n.toLocaleString()}</td></tr>
      </table>
      <div class="summary-box">📍 Total: ${total.toLocaleString()} yds</div>
    `);
  }

/* ===================== HELP ===================== */

  if(cleanInput==="help"){
    return res.json({
      reply: htmlWrapper('Available Commands', `
        <div style="padding:8px">
          • cpb per day<br>
          • jigger per day<br>
          • napthol per day<br>
          • total dyeing<br>
          • totall<br>
          • 15 feb<br>
          • 15 feb cpb<br>
          • 12345 (lot)<br>
          • noor (party)<br>
          • noor cpb<br>
          • feb per day dyeing (monthly table)
        </div>
      `)
    });
  }

/* ===================== ANY MONTH PER DAY DYEING (HTML TABLE) ===================== */

const monthPerDayDyeingMatch = question.match(
/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+per\s+day\s+dyeing$/
);

if (monthPerDayDyeingMatch) {

  const months = {
    jan:0,feb:1,mar:2,apr:3,may:4,jun:5,
    jul:6,aug:7,sep:8,oct:9,nov:10,dec:11
  };

  const selectedMonthIndex = months[monthPerDayDyeingMatch[1]];
  const monthName = monthPerDayDyeingMatch[1].toUpperCase();
  const year = new Date().getFullYear();
  const daysInMonth = new Date(year, selectedMonthIndex+1, 0).getDate();

  let rowsHtml = "";

  let totalCPB = 0;
  let totalJigger = 0;
  let totalEx = 0;
  let totalNapthol = 0;
  let overallTotal = 0;

  function sumProcess(sheet, d){
    return db[sheet]?.slice(1).reduce((total,row)=>{
      const rowDate = parseSheetDate(row[0]);
      if(rowDate &&
         rowDate.getFullYear()===year &&
         rowDate.getMonth()===selectedMonthIndex &&
         rowDate.getDate()===d){
        return total + safeNumber(row[6]);
      }
      return total;
    },0) || 0;
  }

  for(let d=1; d<=daysInMonth; d++){

    const cpb = sumProcess("cpb", d);
    const jigger = sumProcess("jigger", d);
    const ex = sumProcess("ex_jigger", d);
    const napthol = sumProcess("napthol", d);

    const dayTotal = cpb + jigger + ex + napthol;

    totalCPB += cpb;
    totalJigger += jigger;
    totalEx += ex;
    totalNapthol += napthol;
    overallTotal += dayTotal;

    if(dayTotal > 0) {
      rowsHtml += `
      <tr>
        <td>${String(d).padStart(2,"0")}</td>
        <td>${cpb.toLocaleString()}</td>
        <td>${jigger.toLocaleString()}</td>
        <td>${ex.toLocaleString()}</td>
        <td>${napthol.toLocaleString()}</td>
        <td><strong>${dayTotal.toLocaleString()}</strong></td>
      </tr>`;
    }
  }

  return res.json({
    reply: htmlWrapper(`${monthName} Daily Dyeing`, `
      <div class="month-header">📊 ${monthName} DAILY DYEING REPORT</div>
      <table class="erp-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>CPB</th>
            <th>JIGGER</th>
            <th>EX-JIGGER</th>
            <th>NAPTHOL</th>
            <th>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="6" style="text-align:center">No data found</td></tr>'}
        </tbody>
        <tfoot>
          <tr style="background:#e2e8f0;font-weight:bold">
            <td>TOTAL</td>
            <td>${totalCPB.toLocaleString()}</td>
            <td>${totalJigger.toLocaleString()}</td>
            <td>${totalEx.toLocaleString()}</td>
            <td>${totalNapthol.toLocaleString()}</td>
            <td>${overallTotal.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    `)
  });
}
    
  /* ===================== PER DAY ===================== */

  const perDayMatch=question.match(/(cpb|jigger|ex-jigger|exjigger|napthol|singing|marcerise|bleach|folding)\s*per\s*day/);

  if(perDayMatch){
    const proc=perDayMatch[1]
      .replace("exjigger","ex_jigger")
      .replace("ex-jigger","ex_jigger");

    const data=getMonthlyPerDay(db,proc);
    return res.json({reply: formatPerDayHTML(proc, data)});
  }


  /* ===================== TOTAL DYEING ===================== */

  if(cleanInput==="totaldyeing"||cleanInput==="total dyeing"){
    const c=getProcessSum(db,"cpb");
    const j=getProcessSum(db,"jigger");
    const ex=getProcessSum(db,"ex_jigger");
    const n=getProcessSum(db,"napthol");

    return res.json({reply: formatTotalDyeingHTML(c, j, ex, n)});
  }


  /* ===================== FACTORY SUMMARY ===================== */

  if(cleanInput==="totall"){
    const data=getFactoryTotals(db);
    return res.json({reply: formatFactorySummaryHTML(data)});
  }


  /* ===================== DATE + PROCESS ===================== */

  const dateObj=getKeywordDate(question);
  const procMatch=question.match(/(cpb|jigger|exjigger|ex-jigger|napthol|singing|marcerise|bleach|folding)/);

  if(dateObj && procMatch){

    const proc=procMatch[1]
      .replace("exjigger","ex_jigger")
      .replace("ex-jigger","ex_jigger");

    const rows=db[proc]?.slice(1).filter(row=>{
      const rowDate=parseSheetDate(row[0]);
      return rowDate && sameDate(rowDate,dateObj);
    })||[];

    if(rows.length===0)
      return res.json({reply: htmlWrapper('No Data', 'No production on this date.')});

    const combined={};

    rows.forEach(row=>{
      const sill=normalizeSill(row[1]);
      const qty=safeNumber(row[6]);

      if(!combined[sill]){
        const greyRow=db.grey?.slice(1)
          .find(g=>normalizeSill(g[1])===sill);

        combined[sill]={
          party:greyRow?.[2]||"N/A",
          qty:0
        };
      }

      combined[sill].qty+=qty;
    });

    let tableRows = '';
    Object.entries(combined).forEach(([sill, data]) => {
      tableRows += `<tr><td>${sill}</td><td>${data.party}</td><td>${data.qty.toLocaleString()}</td></tr>`;
    });

    const total = rows.reduce((t,r)=>t+safeNumber(r[6]),0);

    return res.json({
      reply: htmlWrapper(`${proc.toUpperCase()} - ${dateObj.toDateString()}`, `
        <table class="erp-table">
          <tr><th>Sill</th><th>Party</th><th>Yards</th></tr>
          ${tableRows}
        </table>
        <div class="summary-box">📍 Total: ${total.toLocaleString()} yds</div>
      `)
    });
  }


  /* ===================== DATE ONLY ===================== */

  if(dateObj){
    const data=getDateReport(db,dateObj);
    return res.json({reply: formatDateReportHTML(data, dateObj.toDateString())});
  }
/* ===================== MONTH SMART SUMMARY ===================== */

const monthMatch = question.match(
/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(process|dyeing|folding|totall|total|report|full|summary)?$/
);

if (monthMatch) {

  const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  const selectedMonthIndex = months[monthMatch[1]];
  const section = monthMatch[2] || "full";

  const today = new Date();
  const year = today.getFullYear();

  function getMonthSum(sheet){
    return db[sheet]?.slice(1).reduce((t,row)=>{
      const d=parseSheetDate(row[0]);
      if(d && d.getMonth()===selectedMonthIndex && d.getFullYear()===year)
        return t+safeNumber(row[6]);
      return t;
    },0) || 0;
  }

  const process = {
    s: getMonthSum("singing"),
    m: getMonthSum("marcerise"),
    b: getMonthSum("bleach")
  };

  const dyeing = {
    c: getMonthSum("cpb"),
    j: getMonthSum("jigger"),
    ex: getMonthSum("ex_jigger"),
    n: getMonthSum("napthol")
  };

  const folding = getMonthSum("folding");

  const dyeTotal =
    dyeing.c +
    dyeing.j +
    dyeing.ex +
    dyeing.n;

  // ================= RESPONSE LOGIC =================

  if(section === "dyeing"){
    return res.json({
      reply: htmlWrapper(`${monthMatch[1].toUpperCase()} Dyeing Summary`, `
        <table class="erp-table">
          <tr><td>CPB</td><td>${dyeing.c.toLocaleString()}</td></tr>
          <tr><td>Jigger</td><td>${dyeing.j.toLocaleString()}</td></tr>
          <tr><td>Ex-Jigger</td><td>${dyeing.ex.toLocaleString()}</td></tr>
          <tr><td>Napthol</td><td>${dyeing.n.toLocaleString()}</td></tr>
        </table>
        <div class="summary-box">📍 Total: ${dyeTotal.toLocaleString()} yds</div>
      `)
    });
  }

  if(section === "process"){
    return res.json({
      reply: htmlWrapper(`${monthMatch[1].toUpperCase()} Process Summary`, `
        <table class="erp-table">
          <tr><td>Singing</td><td>${process.s.toLocaleString()}</td></tr>
          <tr><td>Mercerise</td><td>${process.m.toLocaleString()}</td></tr>
          <tr><td>Bleach</td><td>${process.b.toLocaleString()}</td></tr>
        </table>
      `)
    });
  }

  if(section === "folding"){
    return res.json({
      reply: htmlWrapper(`${monthMatch[1].toUpperCase()} Folding`, `
        <div class="summary-box">📍 Total Folding: ${folding.toLocaleString()} yds</div>
      `)
    });
  }

  // Default Full Report
  return res.json({reply: formatMonthSummaryHTML(monthMatch[1].toUpperCase(), process, dyeing, folding, dyeTotal)});

}

  /* ===================== SILL SEARCH ===================== */

  const numMatch=question.match(/(\d{3,})/);
  if(numMatch){
    const reports=getSillReport(db,normalizeSill(numMatch[1]));
    if(reports)
      return res.json({reply: formatSillReportHTML(reports)});
  }


  /* ===================== PARTY + PROCESS ===================== */

  const partyProcessMatch=question.match(/^(.+)\s+(cpb|jigger|exjigger|ex-jigger|napthol|singing|marcerise|bleach|folding)$/);

  if(partyProcessMatch){

    const partyName=partyProcessMatch[1].trim();
    const proc=partyProcessMatch[2]
      .replace("exjigger","ex_jigger")
      .replace("ex-jigger","ex_jigger");

    const greyRows=db.grey?.slice(1).filter(row=>
      row[2] && row[2].toLowerCase().includes(partyName)
    )||[];

    if(greyRows.length===0)
      return res.json({reply: htmlWrapper('Not Found', 'Party not found.')});

    let total=0;
    let rows = '';

    greyRows.forEach(row=>{
      const sill=normalizeSill(row[1]);

      const qty=db[proc]?.slice(1).reduce((t,r)=>
        normalizeSill(r[1])===sill ? t+safeNumber(r[6]) : t
      ,0)||0;

      if(qty>0){
        total+=qty;
        rows += `<tr><td>${sill}</td><td>${qty.toLocaleString()}</td></tr>`;
      }
    });

    return res.json({
      reply: htmlWrapper(`${partyName.toUpperCase()} - ${proc.toUpperCase()}`, `
        <table class="erp-table">
          <tr><th>Sill</th><th>Yards</th></tr>
          ${rows || '<tr><td colspan="2">No data</td></tr>'}
        </table>
        <div class="summary-box">📍 Total: ${total.toLocaleString()} yds</div>
      `)
    });
  }


  /* ===================== PARTY SUMMARY ===================== */

  const partyData = getPartyFullSummary(db, question);
  if (partyData)
    return res.json({ reply: formatPartySummaryHTML(partyData) });

  return res.json({
    reply: htmlWrapper('ERP Search', `
      <div style="padding:8px">
        Command not recognized. Type <b>help</b> for available commands.
      </div>
    `)
  });
});   // router.post("/ask") এর closing bracket

module.exports = router;
