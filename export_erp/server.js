const express = require("express");
const axios = require("axios");
const cors = require("cors");

const router = express.Router();

router.use(cors());
router.use(express.json());
router.use(express.static(__dirname));

// ===================== CONFIGURATION =====================

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

const SHEET_2 = {
  id: "",
  name: "new_sheet",
  gids: {
    grey: [""],
    singing: [""],
    marcerise: [""],
    bleach: [""],
    cpb: ["", ""],
    napthol: [""],
    jigger: [""],
    ex_jigger: [""],
    folding: [""],
  }
};

const ALL_SHEETS = [SHEET_1, SHEET_2].filter(sheet => sheet.id && sheet.id.trim() !== "");

// ================= HTML WRAPPER FUNCTION =================

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
        }
        .erp-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin: 3px 0;
            background: white;
        }
        .erp-table th {
            background: #2d3748;
            color: white;
            padding: 6px 4px;
            font-size: 10px;
            font-weight: bold;
            text-align: center;
            border: 1px solid #1a202c;
        }
        .erp-table td {
            padding: 5px 4px;
            border: 1px solid #cbd5e0;
            color: #1a202c;
            background: white;
            text-align: center;
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
            padding: 6px 8px;
            margin-top: 6px;
            font-size: 11px;
            font-weight: bold;
            border-radius: 4px;
            border-left: 3px solid #2d3748;
            color: #1a202c;
            text-align: center;
        }
        .info-row {
            background: #f0f4f8;
            padding: 5px 8px;
            margin: 4px 0;
            border-radius: 4px;
            font-size: 11px;
            color: #1a202c;
            border: 1px solid #cbd5e0;
            text-align: center;
        }
        .month-header {
            font-size: 13px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 6px;
            padding: 5px;
            background: #edf2f7;
            border-radius: 4px;
            text-align: center;
        }
        @media (max-width: 480px) {
            .erp-table {
                font-size: 10px;
            }
            .erp-table th {
                font-size: 9px;
                padding: 4px 2px;
            }
            .erp-table td {
                padding: 3px 2px;
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

// ================= UTILITY FUNCTIONS =================

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
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();
}

function getKeywordDate(input){
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const lower = input.toLowerCase();

  if(lower.includes("today") || lower.includes("aj")) return today;
  if(lower.includes("yesterday") || lower.includes("kal")) return yesterday;

  const match = lower.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if(match){
    const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    return new Date(today.getFullYear(), months[match[2]], parseInt(match[1]));
  }

  return null;
}

function normalizeConstruction(construction) {
  if (!construction) return "";
  return construction.toString().toLowerCase()
    .replace(/\*/g, 'x')
    .replace(/×/g, 'x')
    .replace(/\//g, 'x')
    .replace(/\s+/g, '');
}

// ================= DATA FETCH FUNCTIONS =================

async function fetchSheet(sheetId, gid) {
  if (!sheetId || !gid || gid.trim() === "") return [];
  try{
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    const {data} = await axios.get(url);
    return data.split(/\r?\n/).map(line =>
      line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map(cell => cell.replace(/^"|"$/g, "").trim())
    );
  }catch{
    return [];
  }
}

async function fetchMergedSheet(sheetName) {
  let mergedData = [];
  let header = null;
  
  for (const sheet of ALL_SHEETS) {
    const gids = sheet.gids[sheetName];
    if (!gids || gids.length === 0) continue;
    
    for (const gid of gids) {
      if (!gid || gid.trim() === "") continue;
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
  const s = getProcessSum(db, "singing");
  const m = getProcessSum(db, "marcerise");
  const b = getProcessSum(db, "bleach");
  const c = getProcessSum(db, "cpb");
  const j = getProcessSum(db, "jigger");
  const ex = getProcessSum(db, "ex_jigger");
  const n = getProcessSum(db, "napthol");
  const f = getProcessSum(db, "folding");
  return {
    process: { s, m, b },
    dyeing: { c, j, ex, n },
    folding: f,
    dyeTotal: c + j + ex + n
  };
}

function getDateReport(db, targetDate) {
  const s = getProcessSum(db, "singing", targetDate);
  const m = getProcessSum(db, "marcerise", targetDate);
  const b = getProcessSum(db, "bleach", targetDate);
  const c = getProcessSum(db, "cpb", targetDate);
  const j = getProcessSum(db, "jigger", targetDate);
  const ex = getProcessSum(db, "ex_jigger", targetDate);
  const n = getProcessSum(db, "napthol", targetDate);
  const f = getProcessSum(db, "folding", targetDate);
  return {
    process: { s, m, b },
    dyeing: { c, j, ex, n },
    folding: f,
    total: s + m + b + c + j + ex + n
  };
}

function getPartyFullSummary(db, partyName) {
  const searchParty = partyName.toLowerCase();
  const greyRows = db.grey?.slice(1).filter(row =>
    row[2] && row[2].toLowerCase().includes(searchParty)
  ) || [];
  if (greyRows.length === 0) return null;
  
  const sortedRows = [...greyRows].sort((a, b) => {
    const sillA = parseInt(normalizeSill(a[1])) || 0;
    const sillB = parseInt(normalizeSill(b[1])) || 0;
    return sillA - sillB;
  });
  
  let reports = [];
  let totalLot = 0;
  let totalDye = 0;
  
  sortedRows.slice(-100).forEach(row => {
    const sill = normalizeSill(row[1]);
    const quality = row[3] || "N/A";
    const construction = row[4] || "N/A";
    const lot = safeNumber(row[5]);
    const sumProc = (proc) =>
      db[proc]?.slice(1).reduce((t, r) =>
        normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t, 0) || 0;
    const dyeTotal = sumProc("cpb") + sumProc("jigger") + sumProc("ex_jigger") + sumProc("napthol");
    totalLot += lot;
    totalDye += dyeTotal;
    reports.push({ party: row[2], sill, quality, construction, lot, dyeTotal });
  });
  return { reports, totalCount: greyRows.length, totalLot, totalDye };
}

function getPartyConstructionSummary(db, partyName, construction) {
  const searchParty = partyName.toLowerCase();
  const searchConstruction = normalizeConstruction(construction);
  
  const greyRows = db.grey?.slice(1).filter(row => {
    if (!row[2] || !row[4]) return false;
    const dbParty = row[2].toLowerCase();
    const dbConstruction = normalizeConstruction(row[4]);
    return dbParty.includes(searchParty) && dbConstruction.includes(searchConstruction);
  }) || [];

  if (greyRows.length === 0) return null;

  const sortedRows = [...greyRows].sort((a, b) => {
    const sillA = parseInt(normalizeSill(a[1])) || 0;
    const sillB = parseInt(normalizeSill(b[1])) || 0;
    return sillA - sillB;
  });

  let reports = [];
  let totalLot = 0;
  let totalDye = 0;

  sortedRows.slice(-100).forEach(row => {
    const sill = normalizeSill(row[1]);
    const quality = row[3] || "N/A";
    const constr = row[4] || "N/A";
    const lot = safeNumber(row[5]);

    const sumProc = (proc) =>
      db[proc]?.slice(1).reduce((t, r) =>
        normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t, 0) || 0;

    const dyeTotal = sumProc("cpb") + sumProc("jigger") + sumProc("ex_jigger") + sumProc("napthol");

    totalLot += lot;
    totalDye += dyeTotal;

    reports.push({
      party: row[2],
      sill,
      quality,
      construction: constr,
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

function getConstructionSummary(db, construction) {
  const searchConstruction = normalizeConstruction(construction);
  
  const greyRows = db.grey?.slice(1).filter(row => {
    if (!row[4]) return false;
    const dbConstruction = normalizeConstruction(row[4]);
    return dbConstruction.includes(searchConstruction);
  }) || [];

  if (greyRows.length === 0) return null;

  const sortedRows = [...greyRows].sort((a, b) => {
    const sillA = parseInt(normalizeSill(a[1])) || 0;
    const sillB = parseInt(normalizeSill(b[1])) || 0;
    return sillA - sillB;
  });

  let reports = [];
  let totalLot = 0;
  let totalDye = 0;

  sortedRows.slice(-100).forEach(row => {
    const sill = normalizeSill(row[1]);
    const party = row[2] || "N/A";
    const quality = row[3] || "N/A";
    const constr = row[4] || "N/A";
    const lot = safeNumber(row[5]);

    const sumProc = (proc) =>
      db[proc]?.slice(1).reduce((t, r) =>
        normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t, 0) || 0;

    const dyeTotal = sumProc("cpb") + sumProc("jigger") + sumProc("ex_jigger") + sumProc("napthol");

    totalLot += lot;
    totalDye += dyeTotal;

    reports.push({
      party,
      sill,
      quality,
      construction: constr,
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
      db[proc]?.slice(1).reduce((t, r) =>
        normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t, 0) || 0;
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
//   ROUTER
// =========================================================

router.post("/ask", async (req, res) => {
  const rawInput = (req.body.question || "").trim();
  const question = rawInput.toLowerCase();
  const cleanInput = question.replace(/\s+/g, "");

  const sheetNames = ["grey", "singing", "marcerise", "bleach", "cpb", "napthol", "jigger", "ex_jigger", "folding"];
  const db = {};
  for (const name of sheetNames) {
    db[name] = await fetchMergedSheet(name);
  }

  // ================= HTML FORMATTER FUNCTIONS =================

  function formatPerDayHTML(proc, data) {
    let rows = "";
    for (let i = 0; i < data.days.length; i++) {
      const d = data.days[i];
      if (d.qty > 0) {
        rows += "<tr>" +
          "<td style='text-align:center; width:30%'>" + String(d.day).padStart(2, "0") + "</td>" +
          "<td style='text-align:center; width:70%'>" + d.qty.toLocaleString() + "</td>" +
          "</tr>";
      }
    }
    return htmlWrapper(proc.toUpperCase() + " Daily", 
      '<table class="erp-table"><thead> <th style="width:30%">Date</th><th style="width:70%">Yards</th> </thead><tbody>' + 
      (rows || '<tr><td colspan="2" style="text-align:center">No data</td></tr>') + 
      '</tbody></table><div class="summary-box">H:' + data.highest.toLocaleString() + ' L:' + data.lowest.toLocaleString() + ' T:' + data.total.toLocaleString() + '</div>'
    );
  }

  function formatFactorySummaryHTML(data) {
    return htmlWrapper("Factory Summary", 
      '<table class="erp-table"><thead> <th style="width:50%">Process</th><th style="width:50%">Yards</th> </thead><tbody>' +
      '<tr><td style="width:50%">Singing</td><td style="text-align:center; width:50%">' + data.process.s.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Mercerise</td><td style="text-align:center; width:50%">' + data.process.m.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Bleach</td><td style="text-align:center; width:50%">' + data.process.b.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">CPB</td><td style="text-align:center; width:50%">' + data.dyeing.c.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Jigger</td><td style="text-align:center; width:50%">' + data.dyeing.j.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Ex-Jigger</td><td style="text-align:center; width:50%">' + data.dyeing.ex.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Napthol</td><td style="text-align:center; width:50%">' + data.dyeing.n.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Folding</td><td style="text-align:center; width:50%">' + data.folding.toLocaleString() + '</td></tr>' +
      '</tbody></table><div class="summary-box">Dye Total: ' + data.dyeTotal.toLocaleString() + '</div>'
    );
  }

  function formatDateReportHTML(data, dateStr) {
    return htmlWrapper("Daily - " + dateStr, 
      '<table class="erp-table"><thead> <th style="width:50%">Section</th><th style="width:50%">Yards</th> </thead><tbody>' +
      '<tr><td style="width:50%">Singing</td><td style="text-align:center; width:50%">' + data.process.s.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Mercerise</td><td style="text-align:center; width:50%">' + data.process.m.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Bleach</td><td style="text-align:center; width:50%">' + data.process.b.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">CPB</td><td style="text-align:center; width:50%">' + data.dyeing.c.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Jigger</td><td style="text-align:center; width:50%">' + data.dyeing.j.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Ex-Jigger</td><td style="text-align:center; width:50%">' + data.dyeing.ex.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Napthol</td><td style="text-align:center; width:50%">' + data.dyeing.n.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Folding</td><td style="text-align:center; width:50%">' + data.folding.toLocaleString() + '</td></tr>' +
      '</tbody></table><div class="summary-box">Total: ' + data.total.toLocaleString() + '</div>'
    );
  }

  function formatPartySummaryHTML(data) {
    const completion = data.totalLot > 0 ? ((data.totalDye / data.totalLot) * 100).toFixed(1) : 0;
    let rows = "";
    for (let i = 0; i < data.reports.length; i++) {
      const r = data.reports[i];
      const status = r.lot - r.dyeTotal <= 0 ? "positive" : "negative";
      const statusText = r.lot - r.dyeTotal <= 0 ? "E" : "S";
      rows += "<tr>" +
        "<td style='text-align:center'>" + r.sill + "</td>" +
        "<td style='text-align:center'>" + r.quality + "</td>" +
        "<td style='text-align:center'>" + r.construction + "</td>" +
        "<td style='text-align:center'>" + r.lot.toLocaleString() + "</td>" +
        "<td style='text-align:center'>" + r.dyeTotal.toLocaleString() + "</td>" +
        "<td class='" + status + "' style='text-align:center'>" + statusText + "</td>" +
        "</tr>";
    }
    return htmlWrapper("Party Report - " + data.reports[0].party, 
      '<div class="info-row">Showing ' + data.reports.length + ' of ' + data.totalCount + ' entries (last 100)</div>' +
      '<table class="erp-table"><thead>' +
      '<tr><th>Sill</th><th>Quali</th><th>Const</th><th>Lot</th><th>Dye</th><th>St</th></tr>' +
      '</thead><tbody>' + rows + '</tbody></table>' +
      '<div class="summary-box">Lot: ' + data.totalLot.toLocaleString() + ' | Dye: ' + data.totalDye.toLocaleString() + ' | Comp: ' + completion + '%</div>'
    );
  }

  function formatPartyConstructionHTML(data, construction) {
    const completion = data.totalLot > 0 ? ((data.totalDye / data.totalLot) * 100).toFixed(1) : 0;
    let rows = "";
    for (let i = 0; i < data.reports.length; i++) {
      const r = data.reports[i];
      const status = r.lot - r.dyeTotal <= 0 ? "positive" : "negative";
      const statusText = r.lot - r.dyeTotal <= 0 ? "E" : "S";
      const diff = Math.abs(r.lot - r.dyeTotal);
      rows += "<tr>" +
        "<td style='text-align:center'>" + r.sill + "</td>" +
        "<td style='text-align:center'>" + r.party.substring(0, 12) + "</td>" +
        "<td style='text-align:center'>" + r.quality + "</td>" +
        "<td style='text-align:center'>" + r.construction + "</td>" +
        "<td style='text-align:center'>" + r.lot.toLocaleString() + "</td>" +
        "<td style='text-align:center'>" + r.dyeTotal.toLocaleString() + "</td>" +
        "<td class='" + status + "' style='text-align:center'>" + statusText + "(" + diff.toLocaleString() + ")</td>" +
        "</tr>";
    }
    return htmlWrapper("Party+Const - " + construction, 
      '<div class="info-row"><b>Party:</b> ' + data.reports[0].party + ' | <b>Const:</b> ' + construction + ' | <b>Entries:</b> ' + data.totalCount + '</div>' +
      '<table class="erp-table"><thead>' +
      '<tr><th>Sill</th><th>Party</th><th>Quali</th><th>Const</th><th>Lot</th><th>Dye</th><th>St</th></tr>' +
      '</thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr style="background:#e2e8f0;font-weight:bold">' +
      '<td colspan="4">Total</td>' +
      '<td style="text-align:center">' + data.totalLot.toLocaleString() + '</td>' +
      '<td style="text-align:center">' + data.totalDye.toLocaleString() + '</td>' +
      '<td class="' + (data.totalLot - data.totalDye <= 0 ? "positive" : "negative") + '" style="text-align:center">' + (data.totalLot - data.totalDye).toLocaleString() + '</td>' +
      '</tr></tfoot></table>' +
      '<div class="summary-box">Comp: ' + completion + '%</div>'
    );
  }

  function formatConstructionHTML(data, construction) {
    const completion = data.totalLot > 0 ? ((data.totalDye / data.totalLot) * 100).toFixed(1) : 0;
    let rows = "";
    for (let i = 0; i < data.reports.length; i++) {
      const r = data.reports[i];
      const status = r.lot - r.dyeTotal <= 0 ? "positive" : "negative";
      const statusText = r.lot - r.dyeTotal <= 0 ? "E" : "S";
      const diff = Math.abs(r.lot - r.dyeTotal);
      rows += "<tr>" +
        "<td style='text-align:center'>" + r.sill + "</td>" +
        "<td style='text-align:center'>" + r.party.substring(0, 12) + "</td>" +
        "<td style='text-align:center'>" + r.quality + "</td>" +
        "<td style='text-align:center'>" + r.construction + "</td>" +
        "<td style='text-align:center'>" + r.lot.toLocaleString() + "</td>" +
        "<td style='text-align:center'>" + r.dyeTotal.toLocaleString() + "</td>" +
        "<td class='" + status + "' style='text-align:center'>" + statusText + "(" + diff.toLocaleString() + ")</td>" +
        "</tr>";
    }
    return htmlWrapper("Const Report - " + construction, 
      '<div class="info-row"><b>Const:</b> ' + construction + ' | <b>Entries:</b> ' + data.totalCount + '</div>' +
      '<table class="erp-table"><thead>' +
      '<tr><th>Sill</th><th>Party</th><th>Quali</th><th>Const</th><th>Lot</th><th>Dye</th><th>St</th></tr>' +
      '</thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr style="background:#e2e8f0;font-weight:bold">' +
      '<td colspan="4">Total</td>' +
      '<td style="text-align:center">' + data.totalLot.toLocaleString() + '</td>' +
      '<td style="text-align:center">' + data.totalDye.toLocaleString() + '</td>' +
      '<td class="' + (data.totalLot - data.totalDye <= 0 ? "positive" : "negative") + '" style="text-align:center">' + (data.totalLot - data.totalDye).toLocaleString() + '</td>' +
      '</tr></tfoot></table>' +
      '<div class="summary-box">Comp: ' + completion + '%</div>'
    );
  }

  function formatSillReportHTML(reports) {
    let output = "";
    for (let i = 0; i < reports.length; i++) {
      const r = reports[i];
      const statusClass = r.diff <= 0 ? "positive" : "negative";
      const statusText = r.diff <= 0 ? "E" : "S";
      output += '<div class="info-row"><b>S' + r.sill + '</b> ' + r.party + ' ' + r.quality + ' ' + r.construction + ' L:' + r.lot.toLocaleString() + '</div>' +
        '<table class="erp-table">' +
        '<tr><td style="width:50%">Singing</td><td style="text-align:center; width:50%">' + r.process.s.toLocaleString() + '</td></tr>' +
        '<tr><td style="width:50%">Mercerise</td><td style="text-align:center; width:50%">' + r.process.m.toLocaleString() + '</td></tr>' +
        '<tr><td style="width:50%">Bleach</td><td style="text-align:center; width:50%">' + r.process.b.toLocaleString() + '</td></tr>' +
        '<tr><td style="width:50%">CPB</td><td style="text-align:center; width:50%">' + r.dyeing.c.toLocaleString() + '</td></tr>' +
        '<tr><td style="width:50%">Jigger</td><td style="text-align:center; width:50%">' + r.dyeing.j.toLocaleString() + '</td></tr>' +
        '<tr><td style="width:50%">Ex-Jigger</td><td style="text-align:center; width:50%">' + r.dyeing.ex.toLocaleString() + '</td></tr>' +
        '<tr><td style="width:50%">Napthol</td><td style="text-align:center; width:50%">' + r.dyeing.n.toLocaleString() + '</td></tr>' +
        '<tr><td style="width:50%">Folding</td><td style="text-align:center; width:50%">' + r.folding.toLocaleString() + '</td></tr>' +
        '</table>' +
        '<div class="summary-box ' + statusClass + '">Dye:' + r.dyeTotal.toLocaleString() + ' | ' + statusText + ' ' + Math.abs(r.diff).toLocaleString() + '</div>' + 
        (i < reports.length - 1 ? '<div style="margin:5px 0;"></div>' : "");
    }
    return htmlWrapper("Sill Report", output);
  }

  function formatMonthSummaryHTML(monthName, process, dyeing, folding, dyeTotal) {
    return htmlWrapper(monthName + " Summary", 
      '<table class="erp-table">' +
      '<tr><td style="width:50%">Singing</td><td style="text-align:center; width:50%">' + process.s.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Mercerise</td><td style="text-align:center; width:50%">' + process.m.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Bleach</td><td style="text-align:center; width:50%">' + process.b.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">CPB</td><td style="text-align:center; width:50%">' + dyeing.c.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Jigger</td><td style="text-align:center; width:50%">' + dyeing.j.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Ex-Jigger</td><td style="text-align:center; width:50%">' + dyeing.ex.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Napthol</td><td style="text-align:center; width:50%">' + dyeing.n.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Folding</td><td style="text-align:center; width:50%">' + folding.toLocaleString() + '</td></tr>' +
      '</table><div class="summary-box">Dye Total: ' + dyeTotal.toLocaleString() + '</div>'
    );
  }

  function formatTotalDyeingHTML(c, j, ex, n) {
    const total = c + j + ex + n;
    return htmlWrapper("Total Dyeing", 
      '<table class="erp-table"><thead> <th style="width:50%">Process</th><th style="width:50%">Yards</th> </thead><tbody>' +
      '<tr><td style="width:50%">CPB</td><td style="text-align:center; width:50%">' + c.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Jigger</td><td style="text-align:center; width:50%">' + j.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Ex-Jigger</td><td style="text-align:center; width:50%">' + ex.toLocaleString() + '</td></tr>' +
      '<tr><td style="width:50%">Napthol</td><td style="text-align:center; width:50%">' + n.toLocaleString() + '</td></tr>' +
      '</tbody></table><div class="summary-box">Total: ' + total.toLocaleString() + '</div>'
    );
  }
    // ================= ONLY CONSTRUCTION SEARCH =================
  const onlyConstructionMatch = question.match(/^(\d{1,3}[x*×\/]\d{1,3}(?:\/\d{1,3}[x*×\/]\d{1,3})?)$/i);
  if (onlyConstructionMatch) {
    let construction = onlyConstructionMatch[1].trim();
    construction = normalizeConstruction(construction);
    const constructionData = getConstructionSummary(db, construction);
    if (constructionData) {
      return res.json({ reply: formatConstructionHTML(constructionData, construction) });
    } else {
      return res.json({ reply: htmlWrapper("Not Found", '<div style="padding:5px;">No data found for construction "' + construction + '"</div>') });
    }
  }

  // ================= PARTY + CONSTRUCTION SEARCH =================
  const partyConstructionMatch = question.match(/^(.+?)\s+(\d{1,3}[x*×\/]\d{1,3}(?:\/\d{1,3}[x*×\/]\d{1,3})?)$/i);
  if (partyConstructionMatch) {
    const partyName = partyConstructionMatch[1].trim();
    let construction = partyConstructionMatch[2].trim();
    construction = normalizeConstruction(construction);
    const partyData = getPartyConstructionSummary(db, partyName, construction);
    if (partyData) {
      return res.json({ reply: formatPartyConstructionHTML(partyData, construction) });
    } else {
      return res.json({ reply: htmlWrapper("Not Found", '<div style="padding:5px;">No data found for party "' + partyName + '" with construction "' + construction + '"</div>') });
    }
  }

  // ================= HELP =================
  if (cleanInput === "help") {
    return res.json({ reply: htmlWrapper("Commands", '<div style="padding:5px;">• cpb per day<br>• total dyeing<br>• totall<br>• 15 feb<br>• 15 feb cpb<br>• 12345 (lot)<br>• party name<br>• party name construction (e.g., noor 50x50)<br>• construction only (e.g., 50x50, 50*50, 50/50)<br>• feb per day dyeing</div>') });
  }

  // ================= MONTH PER DAY DYEING =================
  const monthPerDayDyeingMatch = question.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+per\s+day\s+dyeing$/);
  if (monthPerDayDyeingMatch) {
    const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    const selectedMonthIndex = months[monthPerDayDyeingMatch[1]];
    const monthName = monthPerDayDyeingMatch[1].toUpperCase();
    const year = new Date().getFullYear();
    const daysInMonth = new Date(year, selectedMonthIndex + 1, 0).getDate();
    let rowsHtml = "";
    let totalCPB = 0, totalJigger = 0, totalEx = 0, totalNapthol = 0, overallTotal = 0;
    
    function sumProcess(sheet, d) {
      return db[sheet]?.slice(1).reduce((total, row) => {
        const rowDate = parseSheetDate(row[0]);
        if (rowDate && rowDate.getFullYear() === year && rowDate.getMonth() === selectedMonthIndex && rowDate.getDate() === d) {
          return total + safeNumber(row[6]);
        }
        return total;
      }, 0) || 0;
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
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
      if (dayTotal > 0) {
        rowsHtml += "<tr>" +
          "<td style='text-align:center'>" + String(d).padStart(2, "0") + "</td>" +
          "<td style='text-align:center'>" + cpb.toLocaleString() + "</td>" +
          "<td style='text-align:center'>" + jigger.toLocaleString() + "</td>" +
          "<td style='text-align:center'>" + ex.toLocaleString() + "</td>" +
          "<td style='text-align:center'>" + napthol.toLocaleString() + "</td>" +
          "<td style='text-align:center'>" + dayTotal.toLocaleString() + "</td>" +
          "</tr>";
      }
    }
    
    return res.json({ reply: htmlWrapper(monthName + " Daily", 
      '<div class="month-header">' + monthName + ' DAILY DYEING</div>' +
      '<table class="erp-table"><thead>' +
      "<tr><th style='width:10%'>Dt</th><th style='width:18%'>CPB</th><th style='width:18%'>Jig</th><th style='width:18%'>Ex</th><th style='width:18%'>Nap</th><th style='width:18%'>Tot</th></tr>" +
      '</thead><tbody>' + (rowsHtml || '<tr><td colspan="6" style="text-align:center">No data</td></tr>') + '</tbody>' +
      '<tfoot><tr style="background:#e2e8f0;font-weight:bold">' +
      '<td style="text-align:center">Tot</td>' +
      '<td style="text-align:center">' + totalCPB.toLocaleString() + '</td>' +
      '<td style="text-align:center">' + totalJigger.toLocaleString() + '</td>' +
      '<td style="text-align:center">' + totalEx.toLocaleString() + '</td>' +
      '<td style="text-align:center">' + totalNapthol.toLocaleString() + '</td>' +
      '<td style="text-align:center">' + overallTotal.toLocaleString() + '</td>' +
      '</tr></tfoot></table>') });
  }
    
  // ================= PER DAY =================
  const perDayMatch = question.match(/(cpb|jigger|ex-jigger|exjigger|napthol|singing|marcerise|bleach|folding)\s*per\s*day/);
  if (perDayMatch) {
    const proc = perDayMatch[1].replace("exjigger", "ex_jigger").replace("ex-jigger", "ex_jigger");
    const data = getMonthlyPerDay(db, proc);
    return res.json({ reply: formatPerDayHTML(proc, data) });
  }

  // ================= TOTAL DYEING =================
  if (cleanInput === "totaldyeing" || cleanInput === "total dyeing") {
    const c = getProcessSum(db, "cpb");
    const j = getProcessSum(db, "jigger");
    const ex = getProcessSum(db, "ex_jigger");
    const n = getProcessSum(db, "napthol");
    return res.json({ reply: formatTotalDyeingHTML(c, j, ex, n) });
  }

  // ================= FACTORY SUMMARY =================
  if (cleanInput === "totall") {
    const data = getFactoryTotals(db);
    return res.json({ reply: formatFactorySummaryHTML(data) });
  }

  // ================= DATE + PROCESS =================
  const dateObj = getKeywordDate(question);
  const procMatch = question.match(/(cpb|jigger|exjigger|ex-jigger|napthol|singing|marcerise|bleach|folding)/);
  if (dateObj && procMatch) {
    const proc = procMatch[1].replace("exjigger", "ex_jigger").replace("ex-jigger", "ex_jigger");
    const rows = db[proc]?.slice(1).filter(row => {
      const rowDate = parseSheetDate(row[0]);
      return rowDate && sameDate(rowDate, dateObj);
    }) || [];
    if (rows.length === 0) return res.json({ reply: htmlWrapper("No Data", "No production on this date.") });
    
    const combined = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sill = normalizeSill(row[1]);
      const qty = safeNumber(row[6]);
      if (!combined[sill]) {
        const greyRow = db.grey?.slice(1).find(g => normalizeSill(g[1]) === sill);
        combined[sill] = { party: greyRow?.[2] || "N/A", quality: greyRow?.[3] || "N/A", construction: greyRow?.[4] || "N/A", qty: 0 };
      }
      combined[sill].qty += qty;
    }
    
    let tableRows = "";
    const entries = Object.entries(combined);
    for (let i = 0; i < entries.length; i++) {
      const sill = entries[i][0];
      const data = entries[i][1];
      tableRows += "<tr>" +
        "<td style='text-align:center'>" + sill + "</td>" +
        "<td style='text-align:center'>" + data.party.substring(0, 8) + "</td>" +
        "<td style='text-align:center'>" + data.quality + "</td>" +
        "<td style='text-align:center'>" + data.construction + "</td>" +
        "<td style='text-align:center'>" + data.qty.toLocaleString() + "</td>" +
        "</tr>";
    }
    
    let total = 0;
    for (let i = 0; i < rows.length; i++) {
      total += safeNumber(rows[i][6]);
    }
    
    return res.json({ reply: htmlWrapper(proc.toUpperCase() + " " + dateObj.getDate() + " " + dateObj.toLocaleString("default", {month:"short"}), 
      '<table class="erp-table"><thead>' +
      "<tr><th style='width:15%'>Sill</th><th style='width:25%'>Party</th><th style='width:20%'>Quali</th><th style='width:20%'>Const</th><th style='width:20%'>Yds</th></tr>" +
      '</thead><tbody>' + tableRows + '</tbody></table>' +
      '<div class="summary-box">Total: ' + total.toLocaleString() + '</div>') });
  }

  // ================= DATE ONLY =================
  if (dateObj) {
    const data = getDateReport(db, dateObj);
    return res.json({ reply: formatDateReportHTML(data, dateObj.getDate() + " " + dateObj.toLocaleString("default", {month:"short"})) });
  }

  // ================= MONTH SMART SUMMARY =================
  const monthMatch = question.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(process|dyeing|folding|totall|total|report|full|summary)?$/);
  if (monthMatch) {
    const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    const selectedMonthIndex = months[monthMatch[1]];
    const section = monthMatch[2] || "full";
    const year = new Date().getFullYear();
    
    function getMonthSum(sheet) {
      return db[sheet]?.slice(1).reduce((t, row) => {
        const d = parseSheetDate(row[0]);
        if (d && d.getMonth() === selectedMonthIndex && d.getFullYear() === year) return t + safeNumber(row[6]);
        return t;
      }, 0) || 0;
    }
    
    const process = { s: getMonthSum("singing"), m: getMonthSum("marcerise"), b: getMonthSum("bleach") };
    const dyeing = { c: getMonthSum("cpb"), j: getMonthSum("jigger"), ex: getMonthSum("ex_jigger"), n: getMonthSum("napthol") };
    const folding = getMonthSum("folding");
    const dyeTotal = dyeing.c + dyeing.j + dyeing.ex + dyeing.n;
    
    if (section === "dyeing") {
      return res.json({ reply: htmlWrapper(monthMatch[1].toUpperCase() + " Dyeing", 
        '<table class="erp-table"><thead> <th style="width:50%">Process</th><th style="width:50%">Yards</th> </thead><tbody>' +
        '<tr><td style="width:50%">CPB</td><td style="text-align:center; width:50%">' + dyeing.c.toLocaleString() + '</td></tr>' +
        '<tr><td style="width:50%">Jigger</td><td style="text-align:center; width:50%">' + dyeing.j.toLocaleString() + '</td></tr>' +
        '<tr><td style="width:50%">Ex-Jigger</td><td style="text-align:center; width:50%">' + dyeing.ex.toLocaleString() + '</td></tr>' +
        '<tr><td style="width:50%">Napthol</td><td style="text-align:center; width:50%">' + dyeing.n.toLocaleString() + '</td></tr>' +
        '</tbody></table><div class="summary-box">Total: ' + dyeTotal.toLocaleString() + '</div>') });
    }
    if (section === "process") {
      return res.json({ reply: htmlWrapper(monthMatch[1].toUpperCase() + " Process", 
        '<table class="erp-table"><thead> <th style="width:50%">Process</th><th style="width:50%">Yards</th> </thead><tbody>' +
        '<tr><td style="width:50%">Singing</td><td style="text-align:center; width:50%">' + process.s.toLocaleString() + '</td></tr>' +
        '<tr><td style="width:50%">Mercerise</td><td style="text-align:center; width:50%">' + process.m.toLocaleString() + '</td></tr>' +
        '<tr><td style="width:50%">Bleach</td><td style="text-align:center; width:50%">' + process.b.toLocaleString() + '</td></tr>' +
        '</tbody></table>') });
    }
    if (section === "folding") {
      return res.json({ reply: htmlWrapper(monthMatch[1].toUpperCase() + " Folding", '<div class="summary-box">Folding: ' + folding.toLocaleString() + '</div>') });
    }
    return res.json({ reply: formatMonthSummaryHTML(monthMatch[1].toUpperCase(), process, dyeing, folding, dyeTotal) });
  }

  // ================= SILL SEARCH =================
  const numMatch = question.match(/(\d{3,})/);
  if (numMatch) {
    const reports = getSillReport(db, normalizeSill(numMatch[1]));
    if (reports) return res.json({ reply: formatSillReportHTML(reports) });
  }

  // ================= PARTY + PROCESS =================
  const partyProcessMatch = question.match(/^(.+)\s+(cpb|jigger|exjigger|ex-jigger|napthol|singing|marcerise|bleach|folding)$/);
  if (partyProcessMatch) {
    const partyName = partyProcessMatch[1].trim();
    const proc = partyProcessMatch[2].replace("exjigger", "ex_jigger").replace("ex-jigger", "ex_jigger");
    const greyRows = db.grey?.slice(1).filter(row => row[2] && row[2].toLowerCase().includes(partyName)) || [];
    if (greyRows.length === 0) return res.json({ reply: htmlWrapper("Not Found", "Party not found.") });
    
    let total = 0;
    let rows = "";
    for (let i = 0; i < greyRows.length; i++) {
      const row = greyRows[i];
      const sill = normalizeSill(row[1]);
      const quality = row[3] || "N/A";
      const construction = row[4] || "N/A";
      const lot = safeNumber(row[5]);
      const qty = db[proc]?.slice(1).reduce((t, r) => normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t, 0) || 0;
      if (qty > 0) {
        total += qty;
        rows += "<tr>" +
          "<td style='text-align:center'>" + sill + "</td>" +
          "<td style='text-align:center'>" + quality + "</td>" +
          "<td style='text-align:center'>" + construction + "</td>" +
          "<td style='text-align:center'>" + lot.toLocaleString() + "</td>" +
          "<td style='text-align:center'>" + qty.toLocaleString() + "</td>" +
          "</tr>";
      }
    }
    
    return res.json({ reply: htmlWrapper(partyName.substring(0, 10) + " - " + proc, 
      '<table class="erp-table"><thead>' +
      "</table><th style='width:15%'>Sill</th><th style='width:20%'>Quali</th><th style='width:20%'>Const</th><th style='width:20%'>Lot</th><th style='width:25%'>Yards</th><th style='width:25%'>Yards</th> </thead><tbody>" + (rows || '<tr><td colspan="5" style="text-align:center">No data</td></tr>') + '</tbody>' +
      '<div class="summary-box">Total ' + proc.toUpperCase() + ': ' + total.toLocaleString() + ' yds</div>') });
  }

  // ================= PARTY SUMMARY =================
  const partyData = getPartyFullSummary(db, question);
  if (partyData) return res.json({ reply: formatPartySummaryHTML(partyData) });

  // ================= DEFAULT =================
  return res.json({ reply: htmlWrapper("ERP Search", '<div style="padding:5px;">Type <b>help</b> for commands</div>') });
});

module.exports = router;
