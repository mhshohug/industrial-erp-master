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
        .perday-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin: 10px 0;
        }
        .perday-table th {
            background: #2d3748;
            color: white;
            padding: 8px 4px;
            font-size: 11px;
            font-weight: bold;
            text-align: center;
            border: 1px solid #1a202c;
        }
        .perday-table td {
            padding: 6px 4px;
            border: 1px solid #cbd5e0;
            text-align: center;
        }
        .perday-table tr:last-child td {
            background: #e2e8f0;
            font-weight: bold;
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
            .perday-table { font-size: 11px; }
        }
    </style>
    <div class="report-container">
        <div class="report-header">📊 ${title}</div>
        ${content}
    </div>
    `;
};

// ===============================
// METER → YDS CONVERSION (দশমিক বাদ)
// ===============================
function toYds(meter){
  return Math.round(meter * 1.09361);
}

// ===============================
// NUMBER FORMATTER (কমা সহ, দশমিক বাদ)
// ===============================
const formatNumber = (num) => {
  return Math.round(num).toLocaleString();
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
  const currentYear = now.getFullYear();

  // =====================================================
  // GET MONTHLY PER DAY MACHINE DATA
  // =====================================================
  async function getMonthlyPerDayMachine(selectedMonth, year) {
    let dailyData = {};
    
    // Initialize all STN columns
    for (let stn = 1; stn <= 5; stn++) {
      dailyData[stn] = {};
    }
    
    for (let stn in STN_GIDS) {
      const db = await fetchSheetByGid(STN_GIDS[stn]);
      if (!db || db.length <= 1) continue;
      
      const rows = db.slice(1);
      const monthIndex = months.indexOf(selectedMonth);
      
      rows.forEach(row => {
        if (!row[0]) return;
        
        // Parse date
        const d = new Date(row[0]);
        if (isNaN(d)) return;
        
        const rowMonth = d.getMonth();
        const rowYear = d.getFullYear();
        
        if (rowMonth === monthIndex && rowYear === year) {
          const day = d.getDate();
          let dayTotal = 0;
          
          // Sum all processes for this STN on this day
          for (let i = 1; i < row.length; i++) {
            dayTotal += toYds(parseFloat(row[i]) || 0);
          }
          
          if (!dailyData[stn][day]) dailyData[stn][day] = 0;
          dailyData[stn][day] += dayTotal;
        }
      });
    }
    
    return dailyData;
  }

  // =====================================================
  // GET MONTHLY PER DAY PROCESS DATA (IMPROVED)
  // =====================================================
  async function getMonthlyPerDayProcess(selectedMonth, year) {
    let dailyData = {};
    
    // Process names mapping with variations
    const processMap = {
      "Boro Finish": ["boro finish", "boro", "bf", "বড় ফিনিশ"],
      "Soto Finish": ["soto finish", "soto", "sf", "ছোট ফিনিশ"],
      "Digital Finish": ["digital finish", "digital", "df", "ডিজিটাল"],
      "Dry": ["dry", "drying", "ড্রাই"],
      "Re coating": ["re coating", "recoat", "re-coating", "recoating", "রি কোটি"],
      "Re finish": ["re finish", "refinish", "re-finish", "রি ফিনিশ"],
      "Agent": ["agent", "ag", "এজেন্ট"]
    };
    
    // Initialize process columns
    Object.keys(processMap).forEach(p => {
      dailyData[p] = {};
    });
    
    for (let stn in STN_GIDS) {
      const db = await fetchSheetByGid(STN_GIDS[stn]);
      if (!db || db.length <= 1) continue;
      
      const headers = db[0];
      const rows = db.slice(1);
      const monthIndex = months.indexOf(selectedMonth);
      
      rows.forEach(row => {
        if (!row[0]) return;
        
        // Parse date
        const d = new Date(row[0]);
        if (isNaN(d)) return;
        
        const rowMonth = d.getMonth();
        const rowYear = d.getFullYear();
        
        if (rowMonth === monthIndex && rowYear === year) {
          const day = d.getDate();
          
          // Map each process column
          headers.forEach((header, idx) => {
            if (idx === 0) return;
            
            const headerLower = header.toLowerCase().trim();
            
            // Check which process this header belongs to
            Object.entries(processMap).forEach(([processName, variations]) => {
              if (variations.some(v => headerLower.includes(v))) {
                const val = toYds(parseFloat(row[idx]) || 0);
                if (!dailyData[processName][day]) dailyData[processName][day] = 0;
                dailyData[processName][day] += val;
              }
            });
          });
        }
      });
    }
    
    return dailyData;
  }

  // =====================================================
  // PER DAY MACHINE REPORT
  // =====================================================
  const perDayMachineMatch = question.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+per\s+day\s+machine$/);

  if (perDayMachineMatch) {
    const selectedMonth = perDayMachineMatch[1];
    const year = currentYear;
    
    const dailyData = await getMonthlyPerDayMachine(selectedMonth, year);
    
    const monthIndex = months.indexOf(selectedMonth);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    
    let tableRows = '';
    let stnTotals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let grandTotal = 0;
    let hasData = false;
    
    for (let day = 1; day <= daysInMonth; day++) {
      let dayTotal = 0;
      let dayHasData = false;
      let row = `<tr><td><b>${day.toString().padStart(2, '0')}</b></td>`;
      
      for (let stn = 1; stn <= 5; stn++) {
        const val = dailyData[stn] && dailyData[stn][day] ? dailyData[stn][day] : 0;
        row += `<td>${formatNumber(val)}</td>`;
        if (val > 0) {
          stnTotals[stn] += val;
          dayTotal += val;
          dayHasData = true;
        }
      }
      
      row += `<td><b>${formatNumber(dayTotal)}</b></td></tr>`;
      
      if (dayHasData) {
        tableRows += row;
        grandTotal += dayTotal;
        hasData = true;
      }
    }
    
    if (!hasData) {
      return res.json({ reply: htmlWrapper("No Data", `❌ ${selectedMonth.toUpperCase()} মাসে কোনো ডাটা নেই`) });
    }
    
    // Add total row
    let totalRow = `<tr style="background:#e2e8f0;font-weight:bold"><td><b>TOTAL</b></td>`;
    for (let stn = 1; stn <= 5; stn++) {
      totalRow += `<td>${formatNumber(stnTotals[stn])}</td>`;
    }
    totalRow += `<td>${formatNumber(grandTotal)}</td></tr>`;
    
    const content = `
      <table class="perday-table">
        <tr>
          <th>Date</th>
          <th>STN 1</th>
          <th>STN 2</th>
          <th>STN 3</th>
          <th>STN 4</th>
          <th>STN 5</th>
          <th>TOTAL</th>
        </tr>
        ${tableRows}
        ${totalRow}
      </table>
    `;
    
    return res.json({ 
      reply: htmlWrapper(`${selectedMonth.toUpperCase()} PER DAY MACHINE REPORT`, content) 
    });
  }

  // =====================================================
  // PER DAY PROCESS REPORT (IMPROVED)
  // =====================================================
  const perDayProcessMatch = question.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+per\s+day\s+process$/);

  if (perDayProcessMatch) {
    const selectedMonth = perDayProcessMatch[1];
    const year = currentYear;
    
    const dailyData = await getMonthlyPerDayProcess(selectedMonth, year);
    
    const processNames = [
      "Boro Finish",
      "Soto Finish",
      "Digital Finish",
      "Dry",
      "Re coating",
      "Re finish",
      "Agent"
    ];
    
    const monthIndex = months.indexOf(selectedMonth);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    
    let tableRows = '';
    let processTotals = {};
    processNames.forEach(p => processTotals[p] = 0);
    let grandTotal = 0;
    let hasData = false;
    
    for (let day = 1; day <= daysInMonth; day++) {
      let dayTotal = 0;
      let dayHasData = false;
      let row = `<tr><td><b>${day.toString().padStart(2, '0')}</b></td>`;
      
      processNames.forEach(proc => {
        const val = dailyData[proc] && dailyData[proc][day] ? dailyData[proc][day] : 0;
        row += `<td>${formatNumber(val)}</td>`;
        if (val > 0) {
          processTotals[proc] += val;
          dayTotal += val;
          dayHasData = true;
        }
      });
      
      row += `<td><b>${formatNumber(dayTotal)}</b></td></tr>`;
      
      if (dayHasData) {
        tableRows += row;
        grandTotal += dayTotal;
        hasData = true;
      }
    }
    
    if (!hasData) {
      return res.json({ reply: htmlWrapper("No Data", `❌ ${selectedMonth.toUpperCase()} মাসে কোনো ডাটা নেই`) });
    }
    
    // Add total row
    let totalRow = `<tr style="background:#e2e8f0;font-weight:bold"><td><b>TOTAL</b></td>`;
    processNames.forEach(proc => {
      totalRow += `<td>${formatNumber(processTotals[proc])}</td>`;
    });
    totalRow += `<td>${formatNumber(grandTotal)}</td></tr>`;
    
    const content = `
      <table class="perday-table">
        <tr>
          <th>Date</th>
          <th>Boro Finish</th>
          <th>Soto Finish</th>
          <th>Digital Finish</th>
          <th>Dry</th>
          <th>Re coating</th>
          <th>Re finish</th>
          <th>Agent</th>
          <th>TOTAL</th>
        </tr>
        ${tableRows}
        ${totalRow}
      </table>
    `;
    
    return res.json({ 
      reply: htmlWrapper(`${selectedMonth.toUpperCase()} PER DAY PROCESS REPORT`, content) 
    });
  }

  // =====================================================
  // 1️⃣ MONTH REPORT
  // =====================================================
  const monthOnlyMatch = question.match(/^(total\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/);

  if (monthOnlyMatch) {

    const selectedMonth = monthOnlyMatch[2];
    const monthIndex = months.indexOf(selectedMonth);

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

      const filteredRows = rows.filter(r => {
        if (!r[0]) return false;
        const d = new Date(r[0]);
        if (isNaN(d)) return false;
        return d.getMonth() === monthIndex;
      });

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
  // 2️⃣ DATE REPORT
  // =====================================================
  const dateMatch = question.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/);

  if (dateMatch) {

    const day = parseInt(dateMatch[1]);
    const month = dateMatch[2];
    const monthIndex = months.indexOf(month);

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
        return d.getDate()===day && d.getMonth()===monthIndex;
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
  // 3️⃣ SINGLE STN REPORT
  // =====================================================
  const stnMatch = question.match(/^stn\s?([1-5])(\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))?$/);

  if (stnMatch) {

    const stnNumber = stnMatch[1];
    const selectedMonth = stnMatch[3] || currentMonth;
    const monthIndex = months.indexOf(selectedMonth);

    const db = await fetchSheetByGid(STN_GIDS[stnNumber]);
    if (!db || db.length <= 1)
      return res.json({ reply: htmlWrapper("Error", "❌ এই STN এ ডেটা নেই") });

    const headers = db[0];
    const rows = db.slice(1);

    const filteredRows = rows.filter(r => {
      if (!r[0]) return false;
      const d = new Date(r[0]);
      if (isNaN(d)) return false;
      return d.getMonth() === monthIndex;
    });

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

  // =====================================================
  // HELP / DEFAULT
  // =====================================================
  return res.json({
    reply: htmlWrapper("Commands", `
      <div style="padding:10px">
        <b>সঠিক কমান্ড লিখুন:</b><br><br>
        • mar (মাস রিপোর্ট)<br>
        • total mar (মাস রিপোর্ট)<br>
        • 1 mar (তারিখ রিপোর্ট)<br>
        • stn 3 mar (স্টেশন রিপোর্ট)<br>
        • mar per day machine (মেশিন পার ডে)<br>
        • mar per day process (প্রসেস পার ডে)
      </div>
    `)
  });

});

module.exports = router;
