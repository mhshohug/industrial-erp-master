const express = require("express");
const axios = require("axios");
const cors = require("cors");

const router = express.Router();

router.use(cors());
router.use(express.json());
router.use(express.static(__dirname));

// ===================== 📌 এখানে আপনার SHEET ID এবং GID কনফিগারেশন দিন =====================

// শীট ১ (পুরাতন)
const SHEET_1 = {
  id: "17AlSp8QqY3_YmW9bb1W-fMg9m7FFBxtYKXc2Cr9fq3A",
  name: "old_sheet",
  gids: {
    grey: ["1069156463"],
    singing: ["1204186084"],
    marcerise: ["883470384"],
    bleach: ["1612554044"],
    cpb: ["809334692"],
    napthol: ["1825175747"],
    jigger: ["392149567"],
    ex_jigger: ["843042263"],
    folding: ["2051005815"],
  }
};

// শীট ২ (নতুন) - এখানে আপনার ডাটা পরে দিতে পারেন
const SHEET_2 = {
  id: "",  // 🔴 পরে ID দিবেন
  name: "new_sheet",
  gids: {
    grey: [""],        // 🔴 পরে GID দিবেন
    singing: [""],     // 🔴 পরে GID দিবেন
    marcerise: [""],   // 🔴 পরে GID দিবেন
    bleach: [""],      // 🔴 পরে GID দিবেন
    cpb: ["", ""],     // 🔴 পরে GID দিবেন (একাধিক)
    napthol: [""],     // 🔴 পরে GID দিবেন
    jigger: [""],      // 🔴 পরে GID দিবেন
    ex_jigger: [""],   // 🔴 পরে GID দিবেন
    folding: [""],     // 🔴 পরে GID দিবেন
  }
};

// সব শীট একসাথে (শুধু valid শীটগুলো নিবে)
const ALL_SHEETS = [SHEET_1, SHEET_2].filter(sheet => sheet.id && sheet.id.trim() !== "");

// ================= HTML WRAPPER ফাংশন =================
const htmlWrapper = (title, content) => {
    return `
    <style>
        .erp-container {
            font-family: Arial, sans-serif;
            max-width: 100%;
            background: #ffffff;
            padding: 5px;
            border-radius: 5px;
            overflow-x: auto;
        }
        .erp-header {
            font-size: 13px;
            font-weight: bold;
            color: #1a202c;
            background: #e2e8f0;
            padding: 4px 6px;
            margin: 0 0 5px 0;
            border-radius: 4px;
            border-left: 3px solid #2d3748;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .erp-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin: 3px 0;
            background: white;
            table-layout: fixed;
        }
        .erp-table th {
            background: #2d3748;
            color: white;
            padding: 4px 3px;
            font-size: 10px;
            font-weight: bold;
            text-align: center;
            border: 1px solid #1a202c;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .erp-table td {
            padding: 3px;
            border: 1px solid #cbd5e0;
            color: #1a202c;
            background: white;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
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
        }
        .negative { 
            color: #b22222; 
            font-weight: bold;
        }
        .summary-box {
            background: #edf2f7;
            padding: 5px;
            margin-top: 5px;
            font-size: 11px;
            font-weight: bold;
            border-radius: 3px;
            border-left: 3px solid #2d3748;
            color: #1a202c;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .info-row {
            background: #f0f4f8;
            padding: 4px 5px;
            margin: 3px 0;
            border-radius: 3px;
            font-size: 11px;
            color: #1a202c;
            border: 1px solid #cbd5e0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .month-header {
            font-size: 13px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 5px;
            padding: 4px;
            background: #edf2f7;
            border-radius: 3px;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        @media (max-width: 480px) {
            .erp-table {
                font-size: 10px;
            }
            .erp-table th {
                font-size: 9px;
                padding: 3px 2px;
            }
            .erp-table td {
                padding: 2px;
                font-size: 9px;
            }
        }
    </style>
    <div class="erp-container">
        <div class="erp-header">📊 ${title}</div>
        ${content}
    </div>
    `;
};

// ================= ইউটিলিটি ফাংশন =================

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

// ================= ডাটা ফেচ করার ফাংশন =================

// একটি নির্দিষ্ট শীট এবং GID থেকে ডাটা ফেচ করা
async function fetchSheet(sheetId, gid) {
  if (!sheetId || !gid) return [];
  try{
    const url=`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    const {data}=await axios.get(url);
    return data.split(/\r?\n/).map(line =>
      line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map(cell=>cell.replace(/^"|"$/g,"").trim())
    );
  }catch{
    return [];
  }
}

// একটি নির্দিষ্ট শীট নামের জন্য সব শীট থেকে ডাটা মার্জ করা
async function fetchMergedSheet(sheetName) {
  let mergedData = [];
  let header = null;
  
  // সব শীট থেকে ডাটা ফেচ করুন
  for (const sheet of ALL_SHEETS) {
    const gids = sheet.gids[sheetName];
    if (!gids || gids.length === 0) continue;
    
    for (const gid of gids) {
      if (!gid || gid.trim() === "") continue;  // খালি GID স্কিপ করুন
      const data = await fetchSheet(sheet.id, gid);
      if (data && data.length > 0) {
        if (!header && data[0]) {
          header = data[0];
          mergedData.push(header);
        }
        const rows = data.slice(1);
        mergedData.push(...rows);
      }
    }
  }
  
  return mergedData;
}
// =========================================================
//   CALCULATION ENGINE
// =========================================================

function getProcessSum(db, sheetName, targetDate = null) {
  const rows = db[sheetName]?.slice(1) || [];
  return rows.reduce((total, row) => {
    if (!targetDate) return total + safeNumber(row[6]);
    const rowDate = parseSheetDate(row[0]);
    if (!rowDate) return total;
    if (sameDate(rowDate, targetDate)) return total + safeNumber(row[6]);
    return total;
  }, 0);
}

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
  return { days, total: grandTotal, highest, lowest };
}

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

function getPartyFullSummary(db, partyName) {
  const greyRows = db.grey?.slice(1).filter(row =>
    row[2] && row[2].toLowerCase().includes(partyName)
  ) || [];
  if (greyRows.length === 0) return null;
  let reports = [];
  let totalLot = 0;
  let totalDye = 0;
  greyRows.slice(-10).forEach(row => {
    const sill = normalizeSill(row[1]);
    const quality = row[3] || "N/A";
    const construction = row[4] || "N/A";
    const lot = safeNumber(row[5]);
    const sumProc = (proc) =>
      db[proc]?.slice(1).reduce((t,r)=>
        normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t,0) || 0;
    const dyeTotal = sumProc("cpb") + sumProc("jigger") + sumProc("ex_jigger") + sumProc("napthol");
    totalLot += lot;
    totalDye += dyeTotal;
    reports.push({ party: row[2], sill, quality, construction, lot, dyeTotal });
  });
  return { reports, totalCount: greyRows.length, totalLot, totalDye };
}

function getPartyConstructionSummary(db, partyName, construction) {
  const greyRows = db.grey?.slice(1).filter(row =>
    row[2] && row[2].toLowerCase().includes(partyName) &&
    row[4] && row[4].toLowerCase().includes(construction.toLowerCase())
  ) || [];
  if (greyRows.length === 0) return null;
  let reports = [];
  let totalLot = 0;
  let totalDye = 0;
  greyRows.forEach(row => {
    const sill = normalizeSill(row[1]);
    const quality = row[3] || "N/A";
    const constr = row[4] || "N/A";
    const lot = safeNumber(row[5]);
    const sumProc = (proc) =>
      db[proc]?.slice(1).reduce((t,r)=>
        normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t,0) || 0;
    const dyeTotal = sumProc("cpb") + sumProc("jigger") + sumProc("ex_jigger") + sumProc("napthol");
    totalLot += lot;
    totalDye += dyeTotal;
    reports.push({ party: row[2], sill, quality, construction: constr, lot, dyeTotal });
  });
  return { reports, totalCount: greyRows.length, totalLot, totalDye };
}

function getSillReport(db, inputNumber) {
  const greyRows = db.grey?.slice(1).filter(row =>
    normalizeSill(row[1]) === inputNumber || normalizeSill(row[5]) === inputNumber
  ) || [];
  if (greyRows.length === 0) return null;
  return greyRows.map(row => {
    const sill = normalizeSill(row[1]);
    const party = row[2] || "N/A";
    const quality = row[3] || "N/A";
    const construction = row[4] || "N/A";
    const lot = safeNumber(row[5]);
    const sumProc = (proc) =>
      db[proc]?.slice(1).reduce((t,r)=>
        normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t,0) || 0;
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
    return { party, sill, quality, construction, lot, process: { s, m, b }, dyeing: { c, j, ex, n }, folding: f, dyeTotal, diff };
  });
}

// =========================================================
//   ROUTER START
// =========================================================

router.post("/ask", async (req, res) => {
  const rawInput = (req.body.question || "").trim();
  const question = rawInput.toLowerCase();
  const cleanInput = question.replace(/\s+/g, "");

  // ডাটা ফেচ করা
  const sheetNames = ["grey", "singing", "marcerise", "bleach", "cpb", "napthol", "jigger", "ex_jigger", "folding"];
  const db = {};
  for (const name of sheetNames) {
    db[name] = await fetchMergedSheet(name);
  }

  // ================= HTML ফরম্যাটার ফাংশন =================

  function formatPerDayHTML(proc, data) {
    let rows = '';
    data.days.forEach(d => {
      if(d.qty > 0) {
        rows += `持续<td style="width:30%">${String(d.day).padStart(2, '0')}持续<td style="width:70%">${d.qty.toLocaleString()}持续            `;
      }
    });
    return htmlWrapper(`${proc.toUpperCase()} Daily`, `
      <table class="erp-table"><thead> <th>Date</th><th>Yards</th> </thead>
      <tbody>${rows || '   <td colspan="2" style="text-align:center">No data   '}</tbody> 
      <div class="summary-box">H:${data.highest.toLocaleString()} L:${data.lowest.toLocaleString()} T:${data.total.toLocaleString()}</div>
    `);
  }

  function formatFactorySummaryHTML(data) {
    return htmlWrapper(`Factory Summary`, `
      <table class="erp-table"><thead> <th>Process</th><th>Yards</th> </thead>
      <tbody>
         <td>Singing</td><td>${data.process.s.toLocaleString()}</td> 
         <td>Mercerise</td><td>${data.process.m.toLocaleString()}</td> 
         <td>Bleach</td><td>${data.process.b.toLocaleString()}</td> 
         <td>CPB</td><td>${data.dyeing.c.toLocaleString()}</td> 
         <td>Jigger</td><td>${data.dyeing.j.toLocaleString()}</td> 
         <td>Ex-Jigger</td><td>${data.dyeing.ex.toLocaleString()}</td> 
         <td>Napthol</td><td>${data.dyeing.n.toLocaleString()}</td> 
         <td>Folding</td><td>${data.folding.toLocaleString()}</td> 
      </tbody> 
      <div class="summary-box">Dye Total: ${data.dyeTotal.toLocaleString()}</div>
    `);
  }

  function formatDateReportHTML(data, dateStr) {
    return htmlWrapper(`Daily - ${dateStr}`, `
      <table class="erp-table"><thead> <th>Section</th><th>Yards</th> </thead>
      <tbody>
         <td>Singing</td><td>${data.process.s.toLocaleString()}</td> 
         <td>Mercerise</td><td>${data.process.m.toLocaleString()}</td> 
         <td>Bleach</td><td>${data.process.b.toLocaleString()}</td> 
         <td>CPB</td><td>${data.dyeing.c.toLocaleString()}</td> 
         <td>Jigger</td><td>${data.dyeing.j.toLocaleString()}</td> 
         <td>Ex-Jigger</td><td>${data.dyeing.ex.toLocaleString()}</td> 
         <td>Napthol</td><td>${data.dyeing.n.toLocaleString()}</td> 
         <td>Folding</td><td>${data.folding.toLocaleString()}</td> 
      </tbody> 
      <div class="summary-box">Total: ${data.total.toLocaleString()}</div>
    `);
  }

  function formatPartySummaryHTML(data) {
    const completion = data.totalLot > 0 ? ((data.totalDye / data.totalLot) * 100).toFixed(1) : 0;
    let rows = '';
    data.reports.forEach(r => {
      const status = r.lot - r.dyeTotal <= 0 ? 'positive' : 'negative';
      const statusText = r.lot - r.dyeTotal <= 0 ? 'Extra' : 'Short';
      rows += `持续<td>${r.sill}</td><td>${r.quality}</td><td>${r.construction}</td><td>${r.lot.toLocaleString()}</td><td>${r.dyeTotal.toLocaleString()}</td><td class="${status}">${statusText}</td>            `;
    });
    return htmlWrapper(`Party Report - ${data.reports[0].party}`, `
      <div class="info-row">Showing ${data.reports.length} of ${data.totalCount} entries</div>
      <table class="erp-table"><thead> <th>Sill</th><th>Quali</th><th>Const</th><th>Lot</th><th>Dye</th><th>Status</th> </thead>
      <tbody>${rows}</tbody> 
      <div class="summary-box">Lot: ${data.totalLot.toLocaleString()} | Dye: ${data.totalDye.toLocaleString()} | Completion: ${completion}%</div>
    `);
  }

  function formatPartyConstructionHTML(data, construction) {
    const completion = data.totalLot > 0 ? ((data.totalDye / data.totalLot) * 100).toFixed(1) : 0;
    let rows = '';
    data.reports.forEach(r => {
      const status = r.lot - r.dyeTotal <= 0 ? 'positive' : 'negative';
      const statusText = r.lot - r.dyeTotal <= 0 ? 'Extra' : 'Short';
      const diff = Math.abs(r.lot - r.dyeTotal);
      rows += `持续<td>${r.sill}</td><td>${r.party.substring(0,15)}</td><td>${r.quality}</td><td>${r.construction}</td><td>${r.lot.toLocaleString()}</td><td>${r.dyeTotal.toLocaleString()}</td><td class="${status}">${statusText} (${diff.toLocaleString()})</td>            `;
    });
    return htmlWrapper(`Party + Construction Report - ${construction}`, `
      <div class="info-row"><b>Party:</b> ${data.reports[0].party} | <b>Construction:</b> ${construction} | <b>Total Entries:</b> ${data.totalCount}</div>
      <table class="erp-table"><thead> <th>Sill</th><th>Party</th><th>Quality</th><th>Construction</th><th>Lot</th><th>Dye</th><th>Status</th> </thead>
      <tbody>${rows}</tbody> 
      <div class="summary-box">Total Lot: ${data.totalLot.toLocaleString()} | Total Dye: ${data.totalDye.toLocaleString()} | Completion: ${completion}% | Balance: ${(data.totalLot - data.totalDye).toLocaleString()}</div>
    `);
  }

  function formatSillReportHTML(reports) {
    let output = '';
    reports.forEach((r, idx) => {
      const statusClass = r.diff <= 0 ? 'positive' : 'negative';
      const statusText = r.diff <= 0 ? 'EXTRA' : 'SHORT';
      output += `
        <div class="info-row"><b>S${r.sill}</b> ${r.party} ${r.quality} ${r.construction} L:${r.lot.toLocaleString()}</div>
        <table class="erp-table">
           <td style="width:50%">Singing</td><td style="width:50%">${r.process.s.toLocaleString()}</td> 
           <td>Mercerise</td><td>${r.process.m.toLocaleString()}</td> 
           <td>Bleach</td><td>${r.process.b.toLocaleString()}</td> 
           <td>CPB</td><td>${r.dyeing.c.toLocaleString()}</td> 
           <td>Jigger</td><td>${r.dyeing.j.toLocaleString()}</td> 
           <td>Ex-Jigger</td><td>${r.dyeing.ex.toLocaleString()}</td> 
           <td>Napthol</td><td>${r.dyeing.n.toLocaleString()}</td> 
           <td>Folding</td><td>${r.folding.toLocaleString()}</td> 
         
        <div class="summary-box ${statusClass}">Dye:${r.dyeTotal.toLocaleString()} | ${statusText} ${Math.abs(r.diff).toLocaleString()}</div>
        ${idx < reports.length - 1 ? '<div style="margin:5px 0;"></div>' : ''}
      `;
    });
    return htmlWrapper(`Sill Report`, output);
  }

  function formatMonthSummaryHTML(monthName, process, dyeing, folding, dyeTotal) {
    return htmlWrapper(`${monthName} Summary`, `
      <table class="erp-table">
         <td>Singing</td><td>${process.s.toLocaleString()}</td> 
         <td>Mercerise</td><td>${process.m.toLocaleString()}</td> 
         <td>Bleach</td><td>${process.b.toLocaleString()}</td> 
         <td>CPB</td><td>${dyeing.c.toLocaleString()}</td> 
         <td>Jigger</td><td>${dyeing.j.toLocaleString()}</td> 
         <td>Ex-Jigger</td><td>${dyeing.ex.toLocaleString()}</td> 
         <td>Napthol</td><td>${dyeing.n.toLocaleString()}</td> 
         <td>Folding</td><td>${folding.toLocaleString()}</td> 
       
      <div class="summary-box">Dye Total: ${dyeTotal.toLocaleString()}</div>
    `);
  }

  function formatTotalDyeingHTML(c, j, ex, n) {
    const total = c + j + ex + n;
    return htmlWrapper(`Total Dyeing`, `
      <table class="erp-table">
         <td>CPB</td><td>${c.toLocaleString()}</td> 
         <td>Jigger</td><td>${j.toLocaleString()}</td> 
         <td>Ex-Jigger</td><td>${ex.toLocaleString()}</td> 
         <td>Napthol</td><td>${n.toLocaleString()}</td> 
       
      <div class="summary-box">Total: ${total.toLocaleString()}</div>
    `);
  }

  // ================= কুয়েরি প্রসেসিং =================

  // PARTY + CONSTRUCTION SEARCH
  const partyConstructionMatch = question.match(/^(.+?)\s+(\d{1,3}[x*]\d{1,3}(?:\/\d{1,3}[x*]\d{1,3})?)$/i);
  if (partyConstructionMatch) {
    const partyName = partyConstructionMatch[1].trim();
    let construction = partyConstructionMatch[2].trim();
    construction = construction.replace(/\*/g, 'x');
    const partyData = getPartyConstructionSummary(db, partyName, construction);
    if (partyData) {
      return res.json({ reply: formatPartyConstructionHTML(partyData, construction) });
    } else {
      return res.json({ reply: htmlWrapper('Not Found', `<div>❌ No data found for party "${partyName}" with construction "${construction}"</div>`) });
    }
  }

  // HELP
  if(cleanInput==="help"){
    return res.json({ reply: htmlWrapper('Commands', `<div>• cpb per day<br>• total dyeing<br>• totall<br>• 15 feb<br>• 15 feb cpb<br>• 12345 (lot)<br>• party name<br>• party name construction (e.g., noor 50x50)<br>• feb per day dyeing</div>`) });
  }

  // MONTH PER DAY DYEING
  const monthPerDayDyeingMatch = question.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+per\s+day\s+dyeing$/);
  if (monthPerDayDyeingMatch) {
    const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    const selectedMonthIndex = months[monthPerDayDyeingMatch[1]];
    const monthName = monthPerDayDyeingMatch[1].toUpperCase();
    const year = new Date().getFullYear();
    const daysInMonth = new Date(year, selectedMonthIndex+1, 0).getDate();
    let rowsHtml = "";
    let totalCPB = 0, totalJigger = 0, totalEx = 0, totalNapthol = 0, overallTotal = 0;
    function sumProcess(sheet, d){
      return db[sheet]?.slice(1).reduce((total,row)=>{
        const rowDate = parseSheetDate(row[0]);
        if(rowDate && rowDate.getFullYear()===year && rowDate.getMonth()===selectedMonthIndex && rowDate.getDate()===d){
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
      totalCPB += cpb; totalJigger += jigger; totalEx += ex; totalNapthol += napthol; overallTotal += dayTotal;
      if(dayTotal > 0) {
        rowsHtml += `持续<td>${String(d).padStart(2,"0")}</td><td>${cpb.toLocaleString()}</td><td>${jigger.toLocaleString()}</td><td>${ex.toLocaleString()}</td><td>${napthol.toLocaleString()}</td><td>${dayTotal.toLocaleString()}</td>            `;
      }
    }
    return res.json({ reply: htmlWrapper(`${monthName} Daily`, `<div class="month-header">${monthName} DAILY DYEING</div><table class="erp-table"><thead> <th>Dt</th><th>CPB</th><th>Jig</th><th>Ex</th><th>Nap</th><th>Tot</th> </thead><tbody>${rowsHtml || '   <td colspan="6">No data   '}</tbody><tfoot><tr style="background:#e2e8f0;font-weight:bold"> <td>Tot</td><td>${totalCPB.toLocaleString()}</td><td>${totalJigger.toLocaleString()}</td><td>${totalEx.toLocaleString()}</td><td>${totalNapthol.toLocaleString()}</td><td>${overallTotal.toLocaleString()}</td> </tr></tfoot>`) });
  }

  // PER DAY
  const perDayMatch = question.match(/(cpb|jigger|ex-jigger|exjigger|napthol|singing|marcerise|bleach|folding)\s*per\s*day/);
  if(perDayMatch){
    const proc = perDayMatch[1].replace("exjigger","ex_jigger").replace("ex-jigger","ex_jigger");
    const data = getMonthlyPerDay(db,proc);
    return res.json({reply: formatPerDayHTML(proc, data)});
  }

  // TOTAL DYEING
  if(cleanInput==="totaldyeing"||cleanInput==="total dyeing"){
    const c = getProcessSum(db,"cpb");
    const j = getProcessSum(db,"jigger");
    const ex = getProcessSum(db,"ex_jigger");
    const n = getProcessSum(db,"napthol");
    return res.json({reply: formatTotalDyeingHTML(c, j, ex, n)});
  }

  // FACTORY SUMMARY
  if(cleanInput==="totall"){
    const data = getFactoryTotals(db);
    return res.json({reply: formatFactorySummaryHTML(data)});
  }

  // DATE + PROCESS
  const dateObj = getKeywordDate(question);
  const procMatch = question.match(/(cpb|jigger|exjigger|ex-jigger|napthol|singing|marcerise|bleach|folding)/);
  if(dateObj && procMatch){
    const proc = procMatch[1].replace("exjigger","ex_jigger").replace("ex-jigger","ex_jigger");
    const rows = db[proc]?.slice(1).filter(row=>{
      const rowDate = parseSheetDate(row[0]);
      return rowDate && sameDate(rowDate,dateObj);
    })||[];
    if(rows.length===0) return res.json({reply: htmlWrapper('No Data', 'No production on this date.')});
    const combined = {};
    rows.forEach(row=>{
      const sill = normalizeSill(row[1]);
      const qty = safeNumber(row[6]);
      if(!combined[sill]){
        const greyRow = db.grey?.slice(1).find(g=>normalizeSill(g[1])===sill);
        combined[sill] = { party: greyRow?.[2]||"N/A", quality: greyRow?.[3]||"N/A", construction: greyRow?.[4]||"N/A", qty:0 };
      }
      combined[sill].qty += qty;
    });
    let tableRows = '';
    Object.entries(combined).forEach(([sill, data]) => {
      tableRows += `持续<td>${sill}</td><td>${data.party.substring(0,8)}</td><td>${data.quality}</td><td>${data.construction}</td><td>${data.qty.toLocaleString()}</td>            `;
    });
    const total = rows.reduce((t,r)=>t+safeNumber(r[6]),0);
    return res.json({ reply: htmlWrapper(`${proc.toUpperCase()} ${dateObj.getDate()} ${dateObj.toLocaleString('default',{month:'short'})}`, `<table class="erp-table"><thead> <th>Sill</th><th>Party</th><th>Quali</th><th>Const</th><th>Yds</th> </thead><tbody>${tableRows}</tbody> <div class="summary-box">Total: ${total.toLocaleString()}</div>`) });
  }

  // DATE ONLY
  if(dateObj){
    const data = getDateReport(db,dateObj);
    return res.json({reply: formatDateReportHTML(data, `${dateObj.getDate()} ${dateObj.toLocaleString('default',{month:'short'})}`)});
  }

  // MONTH SMART SUMMARY
  const monthMatch = question.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(process|dyeing|folding|totall|total|report|full|summary)?$/);
  if (monthMatch) {
    const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    const selectedMonthIndex = months[monthMatch[1]];
    const section = monthMatch[2] || "full";
    const year = new Date().getFullYear();
    function getMonthSum(sheet){
      return db[sheet]?.slice(1).reduce((t,row)=>{
        const d = parseSheetDate(row[0]);
        if(d && d.getMonth()===selectedMonthIndex && d.getFullYear()===year) return t + safeNumber(row[6]);
        return t;
      },0) || 0;
    }
    const process = { s: getMonthSum("singing"), m: getMonthSum("marcerise"), b: getMonthSum("bleach") };
    const dyeing = { c: getMonthSum("cpb"), j: getMonthSum("jigger"), ex: getMonthSum("ex_jigger"), n: getMonthSum("napthol") };
    const folding = getMonthSum("folding");
    const dyeTotal = dyeing.c + dyeing.j + dyeing.ex + dyeing.n;
    if(section === "dyeing"){
      return res.json({ reply: htmlWrapper(`${monthMatch[1].toUpperCase()} Dyeing`, `<table class="erp-table"> <th>CPB</th><th>${dyeing.c.toLocaleString()}</th>  <th>Jigger</th><th>${dyeing.j.toLocaleString()}</th>  <th>Ex-Jigger</th><th>${dyeing.ex.toLocaleString()}</th>  <th>Napthol</th><th>${dyeing.n.toLocaleString()}</th>  <div class="summary-box">Total: ${dyeTotal.toLocaleString()}</div>`) });
    }
    if(section === "process"){
      return res.json({ reply: htmlWrapper(`${monthMatch[1].toUpperCase()} Process`, `<table class="erp-table"> <th>Singing</th><th>${process.s.toLocaleString()}</th>  <th>Mercerise</th><th>${process.m.toLocaleString()}</th>  <th>Bleach</th><th>${process.b.toLocaleString()}</th>  `) });
    }
    if(section === "folding"){
      return res.json({ reply: htmlWrapper(`${monthMatch[1].toUpperCase()} Folding`, `<div class="summary-box">Folding: ${folding.toLocaleString()}</div>`) });
    }
    return res.json({reply: formatMonthSummaryHTML(monthMatch[1].toUpperCase(), process, dyeing, folding, dyeTotal)});
  }

  // SILL SEARCH
  const numMatch = question.match(/(\d{3,})/);
  if(numMatch){
    const reports = getSillReport(db, normalizeSill(numMatch[1]));
    if(reports) return res.json({reply: formatSillReportHTML(reports)});
  }

  // PARTY + PROCESS
  const partyProcessMatch = question.match(/^(.+)\s+(cpb|jigger|exjigger|ex-jigger|napthol|singing|marcerise|bleach|folding)$/);
  if(partyProcessMatch){
    const partyName = partyProcessMatch[1].trim();
    const proc = partyProcessMatch[2].replace("exjigger","ex_jigger").replace("ex-jigger","ex_jigger");
    const greyRows = db.grey?.slice(1).filter(row=> row[2] && row[2].toLowerCase().includes(partyName)) || [];
    if(greyRows.length===0) return res.json({reply: htmlWrapper('Not Found', 'Party not found.')});
    let total = 0;
    let rows = '';
    greyRows.forEach(row=>{
      const sill = normalizeSill(row[1]);
      const quality = row[3] || "N/A";
      const construction = row[4] || "N/A";
      const lot = safeNumber(row[5]);
      const qty = db[proc]?.slice(1).reduce((t,r)=> normalizeSill(r[1])===sill ? t+safeNumber(r[6]) : t,0) || 0;
      if(qty>0){
        total += qty;
        rows += `持续<td>${sill}</td><td>${quality}</td><td>${construction}</td><td>${lot.toLocaleString()}</td><td>${qty.toLocaleString()}</td>            `;
      }
    });
    return res.json({ reply: htmlWrapper(`${partyName.substring(0,10)} - ${proc}`, `<table class="erp-table"><thead> <th>Sill</th><th>Quali</th><th>Const</th><th>Lot</th><th>Yards</th> </thead><tbody>${rows || '   <td colspan="5">No data   '}</tbody> <div class="summary-box">Total ${proc.toUpperCase()}: ${total.toLocaleString()} yds</div>`) });
  }

  // PARTY SUMMARY
  const partyData = getPartyFullSummary(db, question);
  if (partyData) return res.json({ reply: formatPartySummaryHTML(partyData) });

  // DEFAULT
  return res.json({ reply: htmlWrapper('ERP Search', `<div>Type <b>help</b> for commands</div>`) });
});

module.exports = router;
