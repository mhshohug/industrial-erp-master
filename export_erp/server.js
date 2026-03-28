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
        }
        .erp-table td {
            padding: 3px;
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
        }
        .info-row {
            background: #f0f4f8;
            padding: 4px 5px;
            margin: 3px 0;
            border-radius: 3px;
            font-size: 11px;
            color: #1a202c;
            border: 1px solid #cbd5e0;
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

// ================= UTILITY FUNCTIONS =================

function safeNumber(val) {
  return parseFloat((val || "0").toString().replace(/,/g, "")) || 0;
}

function normalizeSill(val) {
  return (val || "").toString().replace(/[^0-9]/g, "");
}

function parseSheetDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function sameDate(d1, d2) {
  return d1 && d2 &&
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();
}

function getKeywordDate(input) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const lower = input.toLowerCase();

  if (lower.includes("today") || lower.includes("aj")) return today;
  if (lower.includes("yesterday") || lower.includes("kal")) return yesterday;

  const match = lower.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (match) {
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    return new Date(today.getFullYear(), months[match[2].toLowerCase()], parseInt(match[1]));
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
  if (!sheetId || !gid || gid.toString().trim() === "") return [];
  try {
    const url = `https://docs.google.com/spreadsheets/d/\( {sheetId}/export?format=csv&gid= \){gid}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    return data.split(/\r?\n/).map(line =>
      line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map(cell => cell.replace(/^"|"$/g, "").trim())
    );
  } catch (e) {
    console.error(`Failed to fetch sheet ${sheetId} gid ${gid}:`, e.message);
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
      if (!gid || gid.toString().trim() === "") continue;
      const data = await fetchSheet(sheet.id, gid);
      if (data && data.length > 0) {
        if (!header && data[0]) {
          header = data[0];
          mergedData = [header]; // Reset with new header if first time
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
  let lowest = Infinity;

  for (let d = 1; d <= today.getDate(); d++) {
    const target = new Date(year, month, d);
    const qty = getProcessSum(db, sheetName, target);
    days.push({ day: d, qty });
    grandTotal += qty;
    if (qty > highest) highest = qty;
    if (qty < lowest) lowest = qty;
  }

  if (lowest === Infinity) lowest = 0;

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
    total: s + m + b + c + j + ex + n + f
  };
}

function getPartyFullSummary(db, partyName) {
  const searchParty = partyName.toLowerCase().trim();
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

    reports.push({ party: row[2] || "N/A", sill, quality, construction, lot, dyeTotal });
  });

  return { reports, totalCount: greyRows.length, totalLot, totalDye };
}

function getPartyConstructionSummary(db, partyName, construction) {
  const searchParty = partyName.toLowerCase().trim();
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
      party: row[2] || "N/A",
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

    return { 
      party, 
      sill, 
      quality, 
      construction, 
      lot, 
      process: { s, m, b }, 
      dyeing: { c, j, ex, n }, 
      folding: f, 
      dyeTotal, 
      diff 
    };
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

  try {
    for (const name of sheetNames) {
      db[name] = await fetchMergedSheet(name);
    }
  } catch (e) {
    console.error("Error fetching sheets:", e.message);
    return res.json({ reply: htmlWrapper("Error", "<div style='padding:10px;color:red;'>Failed to load data from Google Sheets. Please try again later.</div>") });
  }

  // ================= HTML FORMATTER FUNCTIONS =================

  function formatPerDayHTML(proc, data) {
    let rows = "";
    for (const d of data.days) {
      if (d.qty > 0) {
        rows += `<tr><td style="width:30%">\( {String(d.day).padStart(2, "0")}</td><td style="width:70%"> \){d.qty.toLocaleString()}</td></tr>`;
      }
    }
    const summary = `H: ${data.highest.toLocaleString()} | L: ${data.lowest.toLocaleString()} | T: ${data.total.toLocaleString()}`;
    return htmlWrapper(`${proc.toUpperCase()} Daily`, 
      `<table class="erp-table">
        <thead><tr><th style="width:30%">Date</th><th style="width:70%">Yards</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="2" style="text-align:center">No data</td></tr>'}</tbody>
      </table>
      <div class="summary-box">${summary}</div>`
    );
  }

  function formatFactorySummaryHTML(data) {
    return htmlWrapper("Factory Summary", 
      `<table class="erp-table">
        <thead><tr><th style="width:50%">Process</th><th style="width:50%">Yards</th></tr></thead>
        <tbody>
          <tr><td>Singing</td><td>${data.process.s.toLocaleString()}</td></tr>
          <tr><td>Mercerise</td><td>${data.process.m.toLocaleString()}</td></tr>
          <tr><td>Bleach</td><td>${data.process.b.toLocaleString()}</td></tr>
          <tr><td>CPB</td><td>${data.dyeing.c.toLocaleString()}</td></tr>
          <tr><td>Jigger</td><td>${data.dyeing.j.toLocaleString()}</td></tr>
          <tr><td>Ex-Jigger</td><td>${data.dyeing.ex.toLocaleString()}</td></tr>
          <tr><td>Napthol</td><td>${data.dyeing.n.toLocaleString()}</td></tr>
          <tr><td>Folding</td><td>${data.folding.toLocaleString()}</td></tr>
        </tbody>
      </table>
      <div class="summary-box">Dye Total: ${data.dyeTotal.toLocaleString()}</div>`
    );
  }

  function formatDateReportHTML(data, dateStr) {
    return htmlWrapper(`Daily - ${dateStr}`, 
      `<table class="erp-table">
        <thead><tr><th style="width:50%">Section</th><th style="width:50%">Yards</th></tr></thead>
        <tbody>
          <tr><td>Singing</td><td>${data.process.s.toLocaleString()}</td></tr>
          <tr><td>Mercerise</td><td>${data.process.m.toLocaleString()}</td></tr>
          <tr><td>Bleach</td><td>${data.process.b.toLocaleString()}</td></tr>
          <tr><td>CPB</td><td>${data.dyeing.c.toLocaleString()}</td></tr>
          <tr><td>Jigger</td><td>${data.dyeing.j.toLocaleString()}</td></tr>
          <tr><td>Ex-Jigger</td><td>${data.dyeing.ex.toLocaleString()}</td></tr>
          <tr><td>Napthol</td><td>${data.dyeing.n.toLocaleString()}</td></tr>
          <tr><td>Folding</td><td>${data.folding.toLocaleString()}</td></tr>
        </tbody>
      </table>
      <div class="summary-box">Total: ${data.total.toLocaleString()}</div>`
    );
  }

  function formatPartySummaryHTML(data) {
    const completion = data.totalLot > 0 ? ((data.totalDye / data.totalLot) * 100).toFixed(1) : "0";
    let rows = "";
    for (const r of data.reports) {
      const diff = r.lot - r.dyeTotal;
      const statusClass = diff <= 0 ? "positive" : "negative";
      const statusText = diff <= 0 ? "Extra" : "Short";
      rows += `<tr>
        <td style="width:10%">${r.sill}</td>
        <td style="width:15%">${r.quality}</td>
        <td style="width:15%">${r.construction}</td>
        <td style="width:20%">${r.lot.toLocaleString()}</td>
        <td style="width:20%">${r.dyeTotal.toLocaleString()}</td>
        <td class="\( {statusClass}" style="width:20%"> \){statusText}</td>
      </tr>`;
    }

    return htmlWrapper(`Party Report - ${data.reports[0]?.party || "Unknown"}`, 
      `<div class="info-row">Showing ${data.reports.length} of ${data.totalCount} entries (last 100)</div>
      <table class="erp-table">
        <thead><tr><th style="width:10%">Sill</th><th style="width:15%">Quali</th><th style="width:15%">Const</th><th style="width:20%">Lot</th><th style="width:20%">Dye</th><th style="width:20%">Status</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" style="text-align:center">No data</td></tr>'}</tbody>
      </table>
      <div class="summary-box">Lot: ${data.totalLot.toLocaleString()} | Dye: ${data.totalDye.toLocaleString()} | Completion: ${completion}%</div>`
    );
  }

  function formatPartyConstructionHTML(data, construction) {
    const completion = data.totalLot > 0 ? ((data.totalDye / data.totalLot) * 100).toFixed(1) : "0";
    let rows = "";
    for (const r of data.reports) {
      const diff = Math.abs(r.lot - r.dyeTotal);
      const statusClass = (r.lot - r.dyeTotal) <= 0 ? "positive" : "negative";
      const statusText = (r.lot - r.dyeTotal) <= 0 ? "Extra" : "Short";
      rows += `<tr>
        <td style="width:10%">${r.sill}</td>
        <td style="width:20%">${(r.party || "").substring(0, 15)}</td>
        <td style="width:15%">${r.quality}</td>
        <td style="width:20%">${r.construction}</td>
        <td style="width:15%">${r.lot.toLocaleString()}</td>
        <td style="width:15%">${r.dyeTotal.toLocaleString()}</td>
        <td class="\( {statusClass}" style="width:5%"> \){statusText} (${diff.toLocaleString()})</td>
      </tr>`;
    }

    return htmlWrapper(`Party + Construction - ${construction}`, 
      `<div class="info-row"><b>Party:</b> ${data.reports[0]?.party || "N/A"} | <b>Construction:</b> ${construction} | <b>Total Entries:</b> ${data.totalCount} | <b>Showing:</b> last ${data.reports.length}</div>
      <table class="erp-table">
        <thead><tr><th style="width:10%">Sill</th><th style="width:20%">Party</th><th style="width:15%">Quality</th><th style="width:20%">Construction</th><th style="width:15%">Lot</th><th style="width:15%">Dye</th><th style="width:5%">Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="summary-box">Total Lot: ${data.totalLot.toLocaleString()} | Total Dye: ${data.totalDye.toLocaleString()} | Completion: ${completion}% | Balance: ${(data.totalLot - data.totalDye).toLocaleString()}</div>`
    );
  }

  function formatConstructionHTML(data, construction) {
    const completion = data.totalLot > 0 ? ((data.totalDye / data.totalLot) * 100).toFixed(1) : "0";
    let rows = "";
    for (const r of data.reports) {
      const diff = Math.abs(r.lot - r.dyeTotal);
      const statusClass = (r.lot - r.dyeTotal) <= 0 ? "positive" : "negative";
      const statusText = (r.lot - r.dyeTotal) <= 0 ? "Extra" : "Short";
      rows += `<tr>
        <td style="width:10%">${r.sill}</td>
        <td style="width:20%">${(r.party || "").substring(0, 15)}</td>
        <td style="width:15%">${r.quality}</td>
        <td style="width:20%">${r.construction}</td>
        <td style="width:15%">${r.lot.toLocaleString()}</td>
        <td style="width:15%">${r.dyeTotal.toLocaleString()}</td>
        <td class="\( {statusClass}" style="width:5%"> \){statusText} (${diff.toLocaleString()})</td>
      </tr>`;
    }

    return htmlWrapper(`Construction Report - ${construction}`, 
      `<div class="info-row"><b>Construction:</b> ${construction} | <b>Total Entries:</b> ${data.totalCount} | <b>Showing:</b> last ${data.reports.length}</div>
      <table class="erp-table">
        <thead><tr><th style="width:10%">Sill</th><th style="width:20%">Party</th><th style="width:15%">Quality</th><th style="width:20%">Construction</th><th style="width:15%">Lot</th><th style="width:15%">Dye</th><th style="width:5%">Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="summary-box">Total Lot: ${data.totalLot.toLocaleString()} | Total Dye: ${data.totalDye.toLocaleString()} | Completion: ${completion}% | Balance: ${(data.totalLot - data.totalDye).toLocaleString()}</div>`
    );
  }

  function formatSillReportHTML(reports) {
    let output = "";
    for (let i = 0; i < reports.length; i++) {
      const r = reports[i];
      const statusClass = r.diff <= 0 ? "positive" : "negative";
      const statusText = r.diff <= 0 ? "EXTRA" : "SHORT";
      output += `
        <div class="info-row"><b>S${r.sill}</b> ${r.party} ${r.quality} \( {r.construction} L: \){r.lot.toLocaleString()}</div>
        <table class="erp-table">
          <tr><td style="width:50%">Singing</td><td style="width:50%">${r.process.s.toLocaleString()}</td></tr>
          <tr><td style="width:50%">Mercerise</td><td style="width:50%">${r.process.m.toLocaleString()}</td></tr>
          <tr><td style="width:50%">Bleach</td><td style="width:50%">${r.process.b.toLocaleString()}</td></tr>
          <tr><td style="width:50%">CPB</td><td style="width:50%">${r.dyeing.c.toLocaleString()}</td></tr>
          <tr><td style="width:50%">Jigger</td><td style="width:50%">${r.dyeing.j.toLocaleString()}</td></tr>
          <tr><td style="width:50%">Ex-Jigger</td><td style="width:50%">${r.dyeing.ex.toLocaleString()}</td></tr>
          <tr><td style="width:50%">Napthol</td><td style="width:50%">${r.dyeing.n.toLocaleString()}</td></tr>
          <tr><td style="width:50%">Folding</td><td style="width:50%">${r.folding.toLocaleString()}</td></tr>
        </table>
        <div class="summary-box ${statusClass}">Dye: ${r.dyeTotal.toLocaleString()} | ${statusText} ${Math.abs(r.diff).toLocaleString()}</div>
        ${i < reports.length - 1 ? '<div style="margin:8px 0; border-top:1px dashed #cbd5e0;"></div>' : ''}
      `;
    }
    return htmlWrapper("Sill Report", output || "<div style='padding:10px;'>No data found</div>");
  }

  function formatMonthSummaryHTML(monthName, process, dyeing, folding, dyeTotal) {
    return htmlWrapper(`${monthName} Summary`, 
      `<table class="erp-table">
        <tr><td style="width:50%">Singing</td><td style="width:50%">${process.s.toLocaleString()}</td></tr>
        <tr><td style="width:50%">Mercerise</td><td style="width:50%">${process.m.toLocaleString()}</td></tr>
        <tr><td style="width:50%">Bleach</td><td style="width:50%">${process.b.toLocaleString()}</td></tr>
        <tr><td style="width:50%">CPB</td><td style="width:50%">${dyeing.c.toLocaleString()}</td></tr>
        <tr><td style="width:50%">Jigger</td><td style="width:50%">${dyeing.j.toLocaleString()}</td></tr>
        <tr><td style="width:50%">Ex-Jigger</td><td style="width:50%">${dyeing.ex.toLocaleString()}</td></tr>
        <tr><td style="width:50%">Napthol</td><td style="width:50%">${dyeing.n.toLocaleString()}</td></tr>
        <tr><td style="width:50%">Folding</td><td style="width:50%">${folding.toLocaleString()}</td></tr>
      </table>
      <div class="summary-box">Dye Total: ${dyeTotal.toLocaleString()}</div>`
    );
  }

  function formatTotalDyeingHTML(c, j, ex, n) {
    const total = c + j + ex + n;
    return htmlWrapper("Total Dyeing", 
      `<table class="erp-table">
        <thead><tr><th style="width:50%">Process</th><th style="width:50%">Yards</th></tr></thead>
        <tbody>
          <tr><td>CPB</td><td>${c.toLocaleString()}</td></tr>
          <tr><td>Jigger</td><td>${j.toLocaleString()}</td></tr>
          <tr><td>Ex-Jigger</td><td>${ex.toLocaleString()}</td></tr>
          <tr><td>Napthol</td><td>${n.toLocaleString()}</td></tr>
        </tbody>
      </table>
      <div class="summary-box">Total: ${total.toLocaleString()}</div>`
    );
  }

  // ================= ONLY CONSTRUCTION SEARCH =================
  const onlyConstructionMatch = question.match(/^(\d{1,3}[x*×\/]\d{1,3}(?:[\/x*×]\d{1,3}[x*×\/]\d{1,3})?)$/i);
  if (onlyConstructionMatch) {
    let construction = onlyConstructionMatch[1].trim();
    construction = normalizeConstruction(construction);
    const constructionData = getConstructionSummary(db, construction);
    if (constructionData) {
      return res.json({ reply: formatConstructionHTML(constructionData, construction) });
    } else {
      return res.json({ reply: htmlWrapper("Not Found", `<div style="padding:5px;">No data found for construction "${construction}"</div>`) });
    }
  }

  // ================= PARTY + CONSTRUCTION SEARCH =================
  const partyConstructionMatch = question.match(/^(.+?)\s+(\d{1,3}[x*×\/]\d{1,3}(?:[\/x*×]\d{1,3}[x*×\/]\d{1,3})?)$/i);
  if (partyConstructionMatch) {
    const partyName = partyConstructionMatch[1].trim();
    let construction = partyConstructionMatch[2].trim();
    construction = normalizeConstruction(construction);
    const partyData = getPartyConstructionSummary(db, partyName, construction);
    if (partyData) {
      return res.json({ reply: formatPartyConstructionHTML(partyData, construction) });
    } else {
      return res.json({ reply: htmlWrapper("Not Found", `<div style="padding:5px;">No data found for party "\( {partyName}" with construction " \){construction}"</div>`) });
    }
  }

  // ================= HELP =================
  if (cleanInput === "help" || cleanInput === "হেল্প") {
    return res.json({ reply: htmlWrapper("Available Commands", `
      <div style="padding:5px; line-height:1.5;">
        • <b>help</b><br>
        • <b>totall</b> → Factory total<br>
        • <b>total dyeing</b><br>
        • <b>cpb per day</b> / <b>jigger per day</b> etc.<br>
        • <b>15 feb</b> → Daily report<br>
        • <b>15 feb cpb</b><br>
        • <b>12345</b> → Sill / Lot number<br>
        • <b>Party Name</b><br>
        • <b>Party Name 50x50</b><br>
        • <b>50x50</b> → Construction only<br>
        • <b>feb per day dyeing</b><br>
        • <b>feb dyeing</b> / <b>feb process</b>
      </div>
    `) });
  }

  // ================= MONTH PER DAY DYEING =================
  const monthPerDayDyeingMatch = question.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+per\s+day\s+dyeing$/i);
  if (monthPerDayDyeingMatch) {
    const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    const monthKey = monthPerDayDyeingMatch[1].toLowerCase();
    const selectedMonthIndex = months[monthKey];
    const monthName = monthPerDayDyeingMatch[1].toUpperCase();
    const year = new Date().getFullYear();
    const daysInMonth = new Date(year, selectedMonthIndex + 1, 0).getDate();

    let rowsHtml = "";
    let totalCPB = 0, totalJigger = 0, totalEx = 0, totalNapthol = 0, overallTotal = 0;

    const sumProcess = (sheet, day) => {
      return db[sheet]?.slice(1).reduce((total, row) => {
        const rowDate = parseSheetDate(row[0]);
        if (rowDate && 
            rowDate.getFullYear() === year && 
            rowDate.getMonth() === selectedMonthIndex && 
            rowDate.getDate() === day) {
          return total + safeNumber(row[6]);
        }
        return total;
      }, 0) || 0;
    };

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
        rowsHtml += `<tr>
          <td style="width:10%">${String(d).padStart(2, "0")}</td>
          <td style="width:15%">${cpb.toLocaleString()}</td>
          <td style="width:15%">${jigger.toLocaleString()}</td>
          <td style="width:15%">${ex.toLocaleString()}</td>
          <td style="width:15%">${napthol.toLocaleString()}</td>
          <td style="width:15%">${dayTotal.toLocaleString()}</td>
        </tr>`;
      }
    }

    const tableContent = rowsHtml || `<tr><td colspan="6" style="text-align:center">No data</td></tr>`;

    return res.json({ 
      reply: htmlWrapper(`${monthName} Daily Dyeing`, 
        `<div class="month-header">${monthName} DAILY DYEING</div>
        <table class="erp-table">
          <thead>
            <tr><th>Dt</th><th>CPB</th><th>Jig</th><th>Ex</th><th>Nap</th><th>Tot</th></tr>
          </thead>
          <tbody>${tableContent}</tbody>
          <tfoot>
            <tr style="background:#e2e8f0;font-weight:bold">
              <td>Tot</td>
              <td>${totalCPB.toLocaleString()}</td>
              <td>${totalJigger.toLocaleString()}</td>
              <td>${totalEx.toLocaleString()}</td>
              <td>${totalNapthol.toLocaleString()}</td>
              <td>${overallTotal.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>`) 
    });
  }

  // ================= PER DAY =================
  const perDayMatch = question.match(/(cpb|jigger|ex[-_]?jigger|exjigger|napthol|singing|marcerise|bleach|folding)\s+per\s+day/i);
  if (perDayMatch) {
    let proc = perDayMatch[1].toLowerCase()
      .replace(/ex[-_]?jigger|exjigger/g, "ex_jigger");

    const data = getMonthlyPerDay(db, proc);
    return res.json({ reply: formatPerDayHTML(proc, data) });
  }

  // ================= TOTAL DYEING =================
  if (cleanInput === "totaldyeing" || cleanInput === "totaldye" || question.includes("total dyeing")) {
    const c = getProcessSum(db, "cpb");
    const j = getProcessSum(db, "jigger");
    const ex = getProcessSum(db, "ex_jigger");
    const n = getProcessSum(db, "napthol");
    return res.json({ reply: formatTotalDyeingHTML(c, j, ex, n) });
  }

  // ================= FACTORY SUMMARY =================
  if (cleanInput === "totall" || cleanInput === "total" || question.includes("factory") || question.includes("totall")) {
    const data = getFactoryTotals(db);
    return res.json({ reply: formatFactorySummaryHTML(data) });
  }

  // ================= DATE + PROCESS =================
  const dateObj = getKeywordDate(rawInput); // Use rawInput for better keyword detection
  const procMatch = question.match(/(cpb|jigger|ex[-_]?jigger|exjigger|napthol|singing|marcerise|bleach|folding)/i);

  if (dateObj && procMatch) {
    let proc = procMatch[1].toLowerCase()
      .replace(/ex[-_]?jigger|exjigger/g, "ex_jigger");

    const rows = db[proc]?.slice(1).filter(row => {
      const rowDate = parseSheetDate(row[0]);
      return rowDate && sameDate(rowDate, dateObj);
    }) || [];

    if (rows.length === 0) {
      return res.json({ reply: htmlWrapper("No Data", "<div style='padding:10px;'>No production found on this date.</div>") });
    }

    const combined = {};
    for (const row of rows) {
      const sill = normalizeSill(row[1]);
      const qty = safeNumber(row[6]);
      if (!combined[sill]) {
        const greyRow = db.grey?.slice(1).find(g => normalizeSill(g[1]) === sill);
        combined[sill] = { 
          party: greyRow?.[2] || "N/A", 
          quality: greyRow?.[3] || "N/A", 
          construction: greyRow?.[4] || "N/A", 
          qty: 0 
        };
      }
      combined[sill].qty += qty;
    }

    let tableRows = "";
    let total = 0;

    Object.entries(combined).forEach(([sill, data]) => {
      tableRows += `<tr>
        <td style="width:15%">${sill}</td>
        <td style="width:25%">${(data.party || "").substring(0, 8)}</td>
        <td style="width:20%">${data.quality}</td>
        <td style="width:20%">${data.construction}</td>
        <td style="width:20%">${data.qty.toLocaleString()}</td>
      </tr>`;
      total += data.qty;
    });

    const dateDisplay = `${dateObj.getDate()} ${dateObj.toLocaleString("default", { month: "short" })}`;

    return res.json({ 
      reply: htmlWrapper(`${proc.toUpperCase()} ${dateDisplay}`, 
        `<table class="erp-table">
          <thead><tr><th style="width:15%">Sill</th><th style="width:25%">Party</th><th style="width:20%">Quali</th><th style="width:20%">Const</th><th style="width:20%">Yds</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="summary-box">Total: ${total.toLocaleString()}</div>`) 
    });
  }

  // ================= DATE ONLY =================
  if (dateObj) {
    const data = getDateReport(db, dateObj);
    const dateStr = `${dateObj.getDate()} ${dateObj.toLocaleString("default", { month: "short" })}`;
    return res.json({ reply: formatDateReportHTML(data, dateStr) });
  }

  // ================= MONTH SMART SUMMARY =================
  const monthMatch = question.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(process|dyeing|folding|totall|total|report|full|summary)?$/i);
  if (monthMatch) {
    const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    const selectedMonthIndex = months[monthMatch[1].toLowerCase()];
    const section = (monthMatch[2] || "full").toLowerCase();
    const year = new Date().getFullYear();
    const monthName = monthMatch[1].toUpperCase();

    const getMonthSum = (sheet) => {
      return db[sheet]?.slice(1).reduce((t, row) => {
        const d = parseSheetDate(row[0]);
        if (d && d.getMonth() === selectedMonthIndex && d.getFullYear() === year) {
          return t + safeNumber(row[6]);
        }
        return t;
      }, 0) || 0;
    };

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
    const dyeTotal = dyeing.c + dyeing.j + dyeing.ex + dyeing.n;

    if (section === "dyeing") {
      return res.json({ 
        reply: htmlWrapper(`${monthName} Dyeing`, 
          `<table class="erp-table">
            <thead><tr><th style="width:50%">Process</th><th style="width:50%">Yards</th></tr></thead>
            <tbody>
              <tr><td>CPB</td><td>${dyeing.c.toLocaleString()}</td></tr>
              <tr><td>Jigger</td><td>${dyeing.j.toLocaleString()}</td></tr>
              <tr><td>Ex-Jigger</td><td>${dyeing.ex.toLocaleString()}</td></tr>
              <tr><td>Napthol</td><td>${dyeing.n.toLocaleString()}</td></tr>
            </tbody>
          </table>
          <div class="summary-box">Total: ${dyeTotal.toLocaleString()}</div>`) 
      });
    }

    if (section === "process") {
      return res.json({ 
        reply: htmlWrapper(`${monthName} Process`, 
          `<table class="erp-table">
            <thead><tr><th style="width:50%">Process</th><th style="width:50%">Yards</th></tr></thead>
            <tbody>
              <tr><td>Singing</td><td>${process.s.toLocaleString()}</td></tr>
              <tr><td>Mercerise</td><td>${process.m.toLocaleString()}</td></tr>
              <tr><td>Bleach</td><td>${process.b.toLocaleString()}</td></tr>
            </tbody>
          </table>`) 
      });
    }

    if (section === "folding") {
      return res.json({ 
        reply: htmlWrapper(`${monthName} Folding`, 
          `<div class="summary-box">Folding: ${folding.toLocaleString()}</div>`) 
      });
    }

    return res.json({ 
      reply: formatMonthSummaryHTML(monthName, process, dyeing, folding, dyeTotal) 
    });
  }

  // ================= SILL SEARCH =================
  const numMatch = question.match(/(\d{3,})/);
  if (numMatch) {
    const sillNumber = normalizeSill(numMatch[1]);
    const reports = getSillReport(db, sillNumber);
    if (reports && reports.length > 0) {
      return res.json({ reply: formatSillReportHTML(reports) });
    }
  }

  // ================= PARTY + PROCESS =================
  const partyProcessMatch = question.match(/^(.+)\s+(cpb|jigger|ex[-_]?jigger|exjigger|napthol|singing|marcerise|bleach|folding)$/i);
  if (partyProcessMatch) {
    const partyName = partyProcessMatch[1].trim();
    let proc = partyProcessMatch[2].toLowerCase()
      .replace(/ex[-_]?jigger|exjigger/g, "ex_jigger");

    const greyRows = db.grey?.slice(1).filter(row => 
      row[2] && row[2].toLowerCase().includes(partyName.toLowerCase())
    ) || [];

    if (greyRows.length === 0) {
      return res.json({ reply: htmlWrapper("Not Found", "<div style='padding:10px;'>Party not found.</div>") });
    }

    let total = 0;
    let rows = "";

    for (const row of greyRows) {
      const sill = normalizeSill(row[1]);
      const quality = row[3] || "N/A";
      const construction = row[4] || "N/A";
      const lot = safeNumber(row[5]);
      const qty = db[proc]?.slice(1).reduce((t, r) => 
        normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t, 0) || 0;

      if (qty > 0) {
        total += qty;
        rows += `<tr>
          <td style="width:15%">${sill}</td>
          <td style="width:20%">${quality}</td>
          <td style="width:20%">${construction}</td>
          <td style="width:20%">${lot.toLocaleString()}</td>
          <td style="width:25%">${qty.toLocaleString()}</td>
        </tr>`;
      }
    }

    return res.json({ 
      reply: htmlWrapper(`${partyName.substring(0, 10)} - ${proc.toUpperCase()}`, 
        `<table class="erp-table">
          <thead><tr><th style="width:15%">Sill</th><th style="width:20%">Quali</th><th style="width:20%">Const</th><th style="width:20%">Lot</th><th style="width:25%">Yards</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" style="text-align:center">No data</td></tr>'}</tbody>
        </table>
        <div class="summary-box">Total ${proc.toUpperCase()}: ${total.toLocaleString()} yds</div>`) 
    });
  }

  // ================= PARTY SUMMARY =================
  const partyData = getPartyFullSummary(db, rawInput); // Use rawInput for party name
  if (partyData) {
    return res.json({ reply: formatPartySummaryHTML(partyData) });
  }

  // ================= DEFAULT =================
  return res.json({ 
    reply: htmlWrapper("ERP Search", `<div style="padding:10px;">Type <b>help</b> to see available commands.<br><br>Example:<br>• totall<br>• 50x50<br>• noor 50x50<br>• 15 feb</div>`) 
  });
});

module.exports = router;
