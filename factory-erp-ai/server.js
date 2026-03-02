const express = require("express");
const axios = require("axios");
const cors = require("cors");
const moment = require("moment");

const router = express.Router();
router.use(cors());
router.use(express.json());
router.use(express.static(__dirname));

const SHEET_ID = "1-2U7bkuP1cPK9EgCzksYkeOUz0LGexCZQI-oeVmDEmw";

const GID_MAP = {
    grey: "1069156463",
    singing: "291372431",
    marcerise: "890189379",
    cpb: "809334692",
    jet: "1065130625",
    jigger: "392149567",
    rolling: "1498627234"
};

// HTML টেমপ্লেট ফাংশন
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
        .current-month-badge {
            background: #2d3748;
            color: white;
            padding: 2px 6px;
            border-radius: 12px;
            font-size: 10px;
            margin-left: 8px;
        }
        .dyeing-table {
            width: 100%;
            border-collapse: collapse;
            font-family: Arial, sans-serif;
            font-size: 12px;
            background: white;
        }
        .dyeing-table th {
            background: #2d3748;
            color: white;
            padding: 6px 4px;
            font-size: 11px;
            font-weight: bold;
            text-align: center;
            border: 1px solid #1a202c;
        }
        .dyeing-table td {
            padding: 4px;
            border: 1px solid #cbd5e0;
            text-align: right;
            color: #1a202c;
        }
        .dyeing-table td:first-child {
            text-align: center;
            font-weight: bold;
            background: #f0f4f8;
        }
        .dyeing-table tr:last-child td {
            background: #e2e8f0;
            font-weight: bold;
            border-top: 2px solid #2d3748;
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
    </style>
    <div class="erp-container">
        <div class="erp-header">📊 ${title}</div>
        ${content}
    </div>
    `;
};

const formatNumber = (num) => {
    return (num || 0).toLocaleString();
};

async function fetchSheet(gid) {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
        const response = await axios.get(url);
        return response.data.split('\n').map(row =>
            row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
               .map(cell => cell.replace(/"/g, '').trim())
        );
    } catch {
        return [];
    }
}

function normalizeSheetDate(value){
    if(!value) return "";
    value = value.toString().trim();

    if(!isNaN(value) && Number(value) > 40000)
        return moment("1899-12-30").add(Number(value), 'days').format("DD-MMM-YYYY");

    const formats = [
        "DD-MMM-YYYY", "D-MMM-YYYY", "DD/MM/YYYY",
        "D/M/YYYY", "YYYY-MM-DD",
        "DD-MMM-YY", "D-MMM-YY", "DD-MMM-YYYY HH:mm:ss"
    ];

    const m = moment(value, formats, true);
    if(m.isValid()) return m.format("DD-MMM-YYYY");

    return value.toUpperCase();
}

function getParsedDate(q){
    if(q.includes("today") || q.includes("aj"))
        return moment().format("DD-MMM-YYYY");

    if(q.includes("yesterday") || q.includes("kal"))
        return moment().subtract(1, 'days').format("DD-MMM-YYYY");

    if(q.includes("porshu"))
        return moment().subtract(2, 'days').format("DD-MMM-YYYY");

    const match = q.match(/(\d+)\s*([a-z]+)/);
    if(!match) return null;

    let year = moment().year();
    if(moment(`${match[1]} ${match[2]} ${year}`, "D MMM YYYY").isAfter(moment()))
        year--;

    return moment(`${match[1]} ${match[2]} ${year}`, "D MMM YYYY")
        .format("DD-MMM-YYYY");
}

// ================= ASK =================
router.post("/ask", async (req, res) => {

const q = (req.body.question || "").toLowerCase().trim();
const isTotalQuery = /\btot(al)?l?\b/.test(q);

const sheets = await Promise.all(Object.values(GID_MAP).map(fetchSheet));
const [grey, sing, marc, cpb, jet, jig, roll] = sheets;

// ================= পার্টি সার্চ =================
function normalizeName(str){
    return (str || "").toLowerCase().replace(/[\s.\-]/g, '').trim();
}

const uniqueParties = [...new Set(grey.map(r => r[3]).filter(Boolean))];

if(!q.match(/\d/) && q.length >= 2){

    let input = normalizeName(q);
    let bestMatch = uniqueParties.find(p => {
        let np = normalizeName(p);
        return np.includes(input);
    });

    if(bestMatch){

        let rows = grey.filter(r => normalizeName(r[3]) === normalizeName(bestMatch));
        let last10 = rows.slice(-10);

        let tableRows = '';
        last10.forEach(r => {
            let lot = parseFloat((r[6] || "").replace(/,/g, '')) || 0;
            let rolling = roll.reduce((a, rr) => (rr[1] || "").trim() === (r[2] || "").trim() ? a + (parseFloat((rr[7] || "").replace(/,/g, '')) || 0) : a, 0);
            let diff = rolling - lot;
            let diffClass = diff >= 0 ? 'positive' : 'negative';
            let diffSign = diff >= 0 ? '+' : '';

            tableRows += `
            <tr>
                <td><b>${r[2]}</b></td>
                <td>${r[4]}</td>
                <td>${formatNumber(lot)}</td>
                <td>${formatNumber(rolling)}</td>
                <td class="${diffClass}">${diffSign}${formatNumber(Math.abs(diff))}</td>
            </tr>`;
        });

        let html = htmlWrapper(`${bestMatch} - Last 10 Lots`, `
            <table class="erp-table">
                <tr><th>Sill</th><th>Quality</th><th>Lot</th><th>Roll</th><th>Diff</th></tr>
                ${tableRows}
            </table>
            <div class="summary-box">📊 Total: ${rows.length} entries | Showing last 10</div>
        `);

        return res.json({ reply: html });
    }
}

// ===== তারিখ ও সেকশন =====
const dateInput = getParsedDate(q);

if(dateInput && !q.match(/sill\s*(\d+)/) && !q.match(/^\d+$/)){

    const sections = { singing: sing, marcerise: marc, cpb: cpb, jet: jet, jigger: jig, rolling: roll };
    let targetKey = Object.keys(sections).find(s => q.includes(s));

    if(targetKey){

        let details = [], total = 0;
        let sillMap = {};

        let vIdx = (targetKey === "singing" || targetKey === "marcerise") ? 8 : (targetKey === "jet" || targetKey === "cpb" ? 6 : 7);

        sections[targetKey].forEach(r => {

            if(normalizeSheetDate(r[0]) === normalizeSheetDate(dateInput)){

                let sNum = r[1] || "N/A";
                let val = parseFloat((r[vIdx] || "").replace(/,/g, '')) || 0;
                if(val <= 0) return;

                let g = grey.find(gr => (gr[2] || "").trim() === sNum);
                let party = g ? g[3] : "Unknown";
                let lot = g ? parseFloat((g[6] || "").replace(/,/g, '')) || 0 : 0;

                if(!sillMap[sNum]){
                    sillMap[sNum] = { party, lot, val: 0 };
                }
                sillMap[sNum].val += val;

            }
        });

        Object.keys(sillMap).forEach(s => {
            let d = sillMap[s];
            details.push(`
            <tr>
                <td><b>${s}</b></td>
                <td>${d.party}</td>
                <td>${formatNumber(d.lot)}</td>
                <td>${formatNumber(d.val)}</td>
            </tr>`);
            total += d.val;
        });

        if(details.length){
            let html = htmlWrapper(`${targetKey.toUpperCase()} - ${dateInput}`, `
                <table class="erp-table">
                    <tr><th>Sill</th><th>Party</th><th>Lot</th><th>${targetKey}</th></tr>
                    ${details.join('')}
                </table>
                <div class="summary-box">📍 Total: ${formatNumber(total)} yds</div>
            `);
            return res.json({ reply: html });
        }

        return res.json({ reply: `No data for ${targetKey} on ${dateInput}` });
    }

    // দৈনিক সামারি
    const dSum = (rows, idx) => rows.reduce((acc, r) =>
        normalizeSheetDate(r[0]) === normalizeSheetDate(dateInput)
            ? acc + (parseFloat((r[idx] || "").replace(/,/g, '')) || 0)
            : acc, 0);

    const cVal = dSum(cpb, 6), jVal = dSum(jet, 6), jgVal = dSum(jig, 7);
    const singingVal = dSum(sing, 8);
    const marceriseVal = dSum(marc, 8);
    const rollingVal = dSum(roll, 7);
    const totalDyeing = cVal + jVal + jgVal;

    let html = htmlWrapper(`Daily Summary - ${dateInput}`, `
        <table class="erp-table">
            <tr><th>Section</th><th>Yards</th></tr>
            <tr><td>Singing</td><td>${formatNumber(singingVal)}</td></tr>
            <tr><td>Marcerise</td><td>${formatNumber(marceriseVal)}</td></tr>
            <tr><td>CPB</td><td>${formatNumber(cVal)}</td></tr>
            <tr><td>Jet</td><td>${formatNumber(jVal)}</td></tr>
            <tr><td>Jigger</td><td>${formatNumber(jgVal)}</td></tr>
            <tr><td style="font-weight:bold">Rolling</td><td style="font-weight:bold">${formatNumber(rollingVal)}</td></tr>
        </table>
        <div class="summary-box">📍 Total Dyeing: ${formatNumber(totalDyeing)} yds</div>
    `);

    return res.json({ reply: html });
}

    // ===== লট সার্চ =====
let lotMatch = q.match(/lot\s*(\d+)/i) || q.match(/\b(\d{5,6})\b/); // 5-6 ডিজিটের নম্বর

if(lotMatch && !q.includes("sill")){

    let lotNumber = lotMatch[1] || lotMatch[0];
    
    // লট নম্বর থেকে কমা এবং স্পেস রিমুভ
    lotNumber = lotNumber.toString().replace(/,/g, '').trim();
    
    // ডিবাগ জন্য কনসোল
    console.log("Searching for lot:", lotNumber);
    
    // গ্রে শীটে খোঁজা - Lot কলাম (ইনডেক্স 6)
    const gRow = grey.find(r => {
        const greyLot = (r[6] || "").replace(/,/g, '').trim();
        return greyLot === lotNumber;
    });

    if(!gRow) {
        // আবার চেষ্টা করি - যদি লট নম্বর sill এর সাথে মিলে
        const sillMatch = grey.find(r => {
            const greySill = (r[2] || "").trim();
            return greySill === lotNumber;
        });
        
        if(sillMatch) {
            return res.json({ reply: `🔍 আপনি কি Sill ${lotNumber} খুঁজছেন? Sill এর জন্য শুধু নম্বর দিন (যেমন: ${lotNumber})` });
        }
        
        return res.json({ reply: `❌ Lot ${lotNumber} পাওয়া যায়নি।` });
    }

    const sill = (gRow[2] || "").trim();
    const party = gRow[3] || "Unknown";
    const quality = gRow[4] || "Unknown";
    const lotSize = parseFloat((gRow[6] || "").replace(/,/g, '')) || 0;

    // রোলিং ডাটা কালেক্ট করা
    const rolling = roll.reduce((a, r) => {
        const rollSill = (r[1] || "").trim();
        if(rollSill === sill) {
            return a + (parseFloat((r[7] || "").replace(/,/g, '')) || 0);
        }
        return a;
    }, 0);

    const diff = rolling - lotSize;
    const diffClass = diff >= 0 ? 'positive' : 'negative';
    const diffText = diff >= 0 ? 'Extra' : 'Short';

    let html = htmlWrapper(`Lot ${lotNumber}`, `
        <table class="erp-table">
            <tr><th style="width:40%">Party</th><td>${party}</td></tr>
            <tr><th>Sill No</th><td>${sill}</td></tr>
            <tr><th>Quality</th><td>${quality}</td></tr>
            <tr><th>Lot Size</th><td>${formatNumber(lotSize)} yds</td></tr>
            <tr><th>Total Rolling</th><td>${formatNumber(rolling)} yds</td></tr>
            <tr><th>Difference</th><td class="${diffClass}">${diffText}: ${formatNumber(Math.abs(diff))} yds</td></tr>
        </table>
    `);

    return res.json({ reply: html });
}
// ===== সিল রিপোর্ট =====
let sMatch = q.match(/(\d+)/);
if(sMatch && !q.includes("total")){

    const sill = sMatch[1];
    const gRow = grey.find(r => (r[2] || "").trim() === sill);
    if(!gRow) return res.json({ reply: `Sill ${sill} not found.` });

    const getVal = (rows, s, sIdx, vIdx) =>
        rows.reduce((a, r) => r[sIdx] === s
            ? a + (parseFloat((r[vIdx] || "").replace(/,/g, '')) || 0)
            : a, 0);

    const data = {
        sing: getVal(sing, sill, 1, 8),
        marc: getVal(marc, sill, 1, 8),
        cpb: getVal(cpb, sill, 1, 6),
        jet: getVal(jet, sill, 1, 6),
        jig: getVal(jig, sill, 1, 7),
        roll: getVal(roll, sill, 1, 7)
    };

    const lotSize = parseFloat((gRow[6] || "").replace(/,/g, '')) || 0;
    const totalDyeing = data.cpb + data.jet + data.jig;
    const diff = lotSize - data.roll;
    const diffClass = diff <= 0 ? 'positive' : 'negative';
    const diffText = diff <= 0 ? 'Extra' : 'Short';

    let html = htmlWrapper(`Sill ${sill} Report`, `
        <div class="info-row">
            <span class="party-name">${gRow[3]}</span> | ${gRow[4]} | Lot: ${formatNumber(lotSize)} yds
        </div>
        <table class="erp-table">
            <tr><th>Process</th><th>Yards</th></tr>
            <tr><td>Singing</td><td>${formatNumber(data.sing)}</td></tr>
            <tr><td>Marcerise</td><td>${formatNumber(data.marc)}</td></tr>
            <tr><td>CPB</td><td>${formatNumber(data.cpb)}</td></tr>
            <tr><td>Jet</td><td>${formatNumber(data.jet)}</td></tr>
            <tr><td>Jigger</td><td>${formatNumber(data.jig)}</td></tr>
            <tr><td style="font-weight:bold">Rolling</td><td style="font-weight:bold">${formatNumber(data.roll)}</td></tr>
        </table>
        <div class="summary-box">
            📍 Dyeing: ${formatNumber(totalDyeing)} yds<br>
            <span class="${diffClass}">📊 ${diffText}: ${formatNumber(Math.abs(diff))} yds</span>
        </div>
    `);

    return res.json({ reply: html });
}

// ===== পার ডে ডাইং রিপোর্ট (মাস ওয়াইজ) - নতুন ফিচার =====
if(q.includes("per day") && q.includes("dyeing")){

    const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);
    
    if(!monthMatch) {
        return res.json({ reply: `Please specify month (e.g., mar per day dyeing)` });
    }

    const monthName = monthMatch[1];
    const monthIndex = moment().month(monthName).month();
    let monthYear = moment().year();
    
    if(moment().month(monthIndex).isAfter(moment())) {
        monthYear--;
    }

    let dailyData = {};
    
    for(let i = 1; i <= 31; i++) {
        dailyData[i] = {
            cpb: 0,
            jigger: 0,
            jet: 0,
            total: 0
        };
    }

    // CPB ডাটা
    cpb.forEach(r => {
        const date = normalizeSheetDate(r[0]);
        const m = moment(date, "DD-MMM-YYYY", true);
        if(!m.isValid()) return;
        
        if(m.month() === monthIndex && m.year() === monthYear) {
            const day = m.date();
            const val = parseFloat((r[6] || "").replace(/,/g, '')) || 0;
            dailyData[day].cpb += val;
            dailyData[day].total += val;
        }
    });

    // Jigger ডাটা
    jig.forEach(r => {
        const date = normalizeSheetDate(r[0]);
        const m = moment(date, "DD-MMM-YYYY", true);
        if(!m.isValid()) return;
        
        if(m.month() === monthIndex && m.year() === monthYear) {
            const day = m.date();
            const val = parseFloat((r[7] || "").replace(/,/g, '')) || 0;
            dailyData[day].jigger += val;
            dailyData[day].total += val;
        }
    });

    // Jet ডাটা
    jet.forEach(r => {
        const date = normalizeSheetDate(r[0]);
        const m = moment(date, "DD-MMM-YYYY", true);
        if(!m.isValid()) return;
        
        if(m.month() === monthIndex && m.year() === monthYear) {
            const day = m.date();
            const val = parseFloat((r[6] || "").replace(/,/g, '')) || 0;
            dailyData[day].jet += val;
            dailyData[day].total += val;
        }
    });

    let tableRows = '';
    let monthTotal = { cpb: 0, jigger: 0, jet: 0, total: 0 };

    for(let day = 1; day <= 31; day++) {
        const data = dailyData[day];
        
        if(data.total > 0) {
            tableRows += `
            <tr>
                <td style="font-weight:bold">${day.toString().padStart(2, '0')}</td>
                <td>${formatNumber(data.cpb)}</td>
                <td>${formatNumber(data.jigger)}</td>
                <td>${formatNumber(data.jet)}</td>
                <td style="font-weight:bold">${formatNumber(data.total)}</td>
            </tr>`;
            
            monthTotal.cpb += data.cpb;
            monthTotal.jigger += data.jigger;
            monthTotal.jet += data.jet;
            monthTotal.total += data.total;
        }
    }

    if(tableRows === '') {
        return res.json({ reply: `No dyeing data found for ${monthName.toUpperCase()}.` });
    }

    let html = htmlWrapper(`${monthName.toUpperCase()} Daily Dyeing`, `
        <div class="month-header">📊 ${monthName.toUpperCase()} DAILY DYEING REPORT</div>
        <table class="dyeing-table">
            <thead>
                <tr>
                    <th>DATE</th>
                    <th>CPB</th>
                    <th>JIGGER</th>
                    <th>JET</th>
                    <th>TOTAL</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
                <tr>
                    <td><b>TOTAL</b></td>
                    <td><b>${formatNumber(monthTotal.cpb)}</b></td>
                    <td><b>${formatNumber(monthTotal.jigger)}</b></td>
                    <td><b>${formatNumber(monthTotal.jet)}</b></td>
                    <td><b>${formatNumber(monthTotal.total)}</b></td>
                </tr>
            </tbody>
        </table>
    `);

    return res.json({ reply: html });
}

// ===== মাসিক ডাইং (নির্দিষ্ট মাস) =====
const monthOnlyMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);

if(monthOnlyMatch && q.includes("dyeing") && !isTotalQuery && !q.includes("per day")){

    const monthName = monthOnlyMatch[1];
    const monthIndex = moment().month(monthName).month();

    const filterByMonth = (rows, idx) => 
        rows.reduce((acc, r) => {
            const d = normalizeSheetDate(r[0]);
            const m = moment(d, "DD-MMM-YYYY", true);
            if(m.isValid() && m.month() === monthIndex){
                return acc + (parseFloat((r[idx] || "").replace(/,/g, '')) || 0);
            }
            return acc;
        }, 0);

    const cpbTotal = filterByMonth(cpb, 6);
    const jetTotal = filterByMonth(jet, 6);
    const jiggerTotal = filterByMonth(jig, 7);
    const grandTotal = cpbTotal + jetTotal + jiggerTotal;

    let html = htmlWrapper(`${monthName.toUpperCase()} Dyeing Report`, `
        <table class="erp-table">
            <tr><th>Section</th><th>Yards</th></tr>
            <tr><td>CPB</td><td>${formatNumber(cpbTotal)}</td></tr>
            <tr><td>Jet</td><td>${formatNumber(jetTotal)}</td></tr>
            <tr><td>Jigger</td><td>${formatNumber(jiggerTotal)}</td></tr>
        </table>
        <div class="summary-box">📍 Total: ${formatNumber(grandTotal)} yds</div>
    `);

    return res.json({ reply: html });
}

// ===== টোটাল ডাইং - শুধু কারেন্ট মাস =====
if(isTotalQuery && q.includes("dyeing")){

    const currentMonth = moment().month();
    const currentYear = moment().year();
    const monthName = moment().format("MMM").toUpperCase();

    const filterByCurrentMonth = (rows, idx) => 
        rows.reduce((acc, r) => {
            const d = normalizeSheetDate(r[0]);
            const m = moment(d, "DD-MMM-YYYY", true);
            if(m.isValid() && m.month() === currentMonth && m.year() === currentYear){
                return acc + (parseFloat((r[idx] || "").replace(/,/g, '')) || 0);
            }
            return acc;
        }, 0);

    const cpbTotal = filterByCurrentMonth(cpb, 6);
    const jetTotal = filterByCurrentMonth(jet, 6);
    const jiggerTotal = filterByCurrentMonth(jig, 7);
    const grandTotal = cpbTotal + jetTotal + jiggerTotal;

    let html = htmlWrapper(`${monthName} Dyeing Report (Current Month)`, `
        <table class="erp-table">
            <tr><th>Section</th><th>Yards</th></tr>
            <tr><td>CPB</td><td>${formatNumber(cpbTotal)}</td></tr>
            <tr><td>Jet</td><td>${formatNumber(jetTotal)}</td></tr>
            <tr><td>Jigger</td><td>${formatNumber(jiggerTotal)}</td></tr>
        </table>
        <div class="summary-box">📍 Total Dyeing (${monthName}): ${formatNumber(grandTotal)} yds</div>
    `);

    return res.json({ reply: html });
}

// ===== গ্র্যান্ড টোটাল (অন্যান্য) =====
if(isTotalQuery && !q.includes("dyeing")){

    const tSum = (rows, idx) =>
        rows.reduce((a, r) =>
            a + (parseFloat((r[idx] || "").replace(/,/g, '')) || 0), 0);

    const t = {
        s: tSum(sing, 8),
        m: tSum(marc, 8),
        c: tSum(cpb, 6),
        j: tSum(jet, 6),
        jg: tSum(jig, 7),
        r: tSum(roll, 7)
    };

    let html = htmlWrapper('Grand Total All Time', `
        <table class="erp-table">
            <tr><th>Section</th><th>Yards</th></tr>
            <tr><td>Singing</td><td>${formatNumber(t.s)}</td></tr>
            <tr><td>Marcerise</td><td>${formatNumber(t.m)}</td></tr>
            <tr><td>CPB</td><td>${formatNumber(t.c)}</td></tr>
            <tr><td>Jet</td><td>${formatNumber(t.j)}</td></tr>
            <tr><td>Jigger</td><td>${formatNumber(t.jg)}</td></tr>
            <tr><td style="font-weight:bold">Rolling</td><td style="font-weight:bold">${formatNumber(t.r)}</td></tr>
        </table>
    `);

    return res.json({ reply: html });
}

// ===== রোলিং ইন্সপেকশন =====
if(q.includes("rolling") && (q.includes("inspection") || q.includes("ins"))){

    const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);
    if(!monthMatch)
        return res.json({ reply: `Please specify month (e.g., feb rolling inspection)` });

    const monthName = monthMatch[1];
    const monthIndex = moment().month(monthName).month();

    let sillMap = {};

    roll.forEach(r => {
        const date = normalizeSheetDate(r[0]);
        const m = moment(date, "DD-MMM-YYYY", true);
        if(!m.isValid() || m.month() !== monthIndex) return;

        const sill = (r[1] || "").trim();
        const rollingVal = parseFloat((r[7] || "").replace(/,/g, '')) || 0;
        if(!sill || rollingVal <= 0) return;

        if(!sillMap[sill]) sillMap[sill] = 0;
        sillMap[sill] += rollingVal;
    });

    let rows = [];

    Object.keys(sillMap).forEach(sill => {
        const gRow = grey.find(gr => (gr[2] || "").trim() === sill);
        if(!gRow) return;

        const party = gRow[3] || "Unknown";
        const lot = parseFloat((gRow[6] || "").replace(/,/g, '')) || 0;
        const rollingTotal = sillMap[sill];
        const diff = rollingTotal - lot;
        const percent = lot > 0 ? ((diff / lot) * 100) : 0;

        rows.push({ sill: Number(sill), party, lot, rollingTotal, diff, percent });
    });

    rows.sort((a, b) => a.sill - b.sill);

    let tableRows = '';
    rows.forEach(r => {
        const diffClass = r.diff >= 0 ? 'positive' : 'negative';
        const diffSign = r.diff >= 0 ? '+' : '';
        
        tableRows += `
        <tr>
            <td><b>${r.sill}</b></td>
            <td>${r.party.substring(0, 15)}</td>
            <td>${formatNumber(r.lot)}</td>
            <td>${formatNumber(r.rollingTotal)}</td>
            <td class="${diffClass}">${diffSign}${formatNumber(Math.abs(r.diff))}</td>
            <td class="${diffClass}">${r.percent.toFixed(1)}%</td>
        </tr>`;
    });

    let html = htmlWrapper(`${monthName.toUpperCase()} Rolling Inspection`, `
        <table class="erp-table">
            <tr><th>Sill</th><th>Party</th><th>Lot</th><th>Roll</th><th>Diff</th><th>%</th></tr>
            ${tableRows}
        </table>
    `);

    return res.json({ reply: html });
}

// ===== সেকশন হিস্ট্রি =====
const secDetect = (q) => {
    if(/cpb/.test(q)) return "cpb";
    if(/\bjet\b/.test(q)) return "jet";
    if(/jig|jiger|jigger|jg/.test(q)) return "jigger";
    if(/roll/.test(q)) return "rolling";
    if(/sing/.test(q)) return "singing";
    if(/mar|merc/.test(q)) return "marcerise";
    return null;
};

const sectionKey = secDetect(q);

if(sectionKey && !q.includes("per day") && !q.includes("total")){

    const sectionMap = {
        singing: sing,
        marcerise: marc,
        cpb: cpb,
        jet: jet,
        jigger: jig,
        rolling: roll
    };

    const rows = sectionMap[sectionKey];
    let sMatch = q.match(/\b\d{3,4}\b/);

    if(sMatch){

        let sill = sMatch[0];
        let g = grey.find(r => (r[2] || "").trim() === sill);
        let party = g ? g[3] : "Unknown";

        let total = 0, tableRows = '';

        rows.forEach(r => {
            if((r[1] || "").trim() === sill){

                let date = normalizeSheetDate(r[0]);
                let vIdx = (sectionKey === "singing" || sectionKey === "marcerise") ? 8 : (sectionKey === "jet" || sectionKey === "cpb" ? 6 : 7);
                let val = parseFloat((r[vIdx] || "").replace(/,/g, '')) || 0;
                if(val <= 0) return;

                tableRows += `<tr><td>${date}</td><td>${formatNumber(val)}</td></tr>`;
                total += val;
            }
        });

        if(tableRows){
            let html = htmlWrapper(`${sectionKey} History - Sill ${sill}`, `
                <div class="info-row">
                    <span class="party-name">${party}</span>
                </div>
                <table class="erp-table">
                    <tr><th>Date</th><th>Yards</th></tr>
                    ${tableRows}
                </table>
                <div class="summary-box">📍 Total: ${formatNumber(total)} yds</div>
            `);
            return res.json({ reply: html });
        }
    }
}

// ===== পার ডে রিপোর্ট (শুধু কারেন্ট মাস, নির্দিষ্ট সেকশন) =====
if(q.includes("per day") && !q.includes("dyeing")){

    const sectionMap = {
        singing: { rows: sing, idx: 8, name: "Singing" },
        marcerise: { rows: marc, idx: 8, name: "Marcerise" },
        cpb: { rows: cpb, idx: 6, name: "CPB" },
        jet: { rows: jet, idx: 6, name: "Jet" },
        jigger: { rows: jig, idx: 7, name: "Jigger" },
        rolling: { rows: roll, idx: 7, name: "Rolling" }
    };

    const sectionKey = Object.keys(sectionMap).find(s => q.includes(s));
    const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);
    
    if(sectionKey){

        const { rows, idx, name } = sectionMap[sectionKey];
        
        let targetMonth, targetYear, monthName;
        
        if(monthMatch) {
            targetMonth = moment().month(monthMatch[1]).month();
            targetYear = moment().year();
            monthName = monthMatch[1].toUpperCase();
            
            if(moment().month(targetMonth).isAfter(moment())) {
                targetYear--;
            }
        } else {
            targetMonth = moment().month();
            targetYear = moment().year();
            monthName = moment().format("MMM").toUpperCase();
        }
        
        let dayMap = {};
        let total = 0;

        rows.forEach(r => {
            const date = normalizeSheetDate(r[0]);
            const m = moment(date, "DD-MMM-YYYY", true);
            const val = parseFloat((r[idx] || "").replace(/,/g, '')) || 0;

            if(!m.isValid() || val <= 0) return;
            
            if(m.month() === targetMonth && m.year() === targetYear) {
                const formattedDate = m.format("DD-MMM-YYYY");
                if(!dayMap[formattedDate]) dayMap[formattedDate] = 0;
                dayMap[formattedDate] += val;
                total += val;
            }
        });

        const sortedDates = Object.keys(dayMap)
            .sort((a, b) => moment(a, "DD-MMM-YYYY") - moment(b, "DD-MMM-YYYY"));

        if(!sortedDates.length)
            return res.json({ reply: `No data found for ${monthName} ${name}.` });

        let tableRows = '';

        sortedDates.forEach((d, i) => {
            tableRows += `<tr><td>${d}</td><td>${formatNumber(dayMap[d])}</td></tr>`;
        });

        let html = htmlWrapper(`${monthName} ${name} Per Day`, `
            <table class="erp-table">
                <tr><th>Date</th><th>Yards</th></tr>
                ${tableRows}
            </table>
            <div class="summary-box">📍 Total: ${formatNumber(total)} yds</div>
        `);

        return res.json({ reply: html });
    }
}

// ===== ফাইনাল =====
res.json({
    reply: `
    ${htmlWrapper('ERP Search', `
        <div style="padding:8px; color:#1a202c;">
            <b>🔍 Try these searches:</b><br><br>
            • Sill: 590<br>
            • Date+Section: 3 feb cpb<br>
            • Party: RB Design<br>
            • Month: feb dyeing<br>
            • Lot: 12345<br>
            • Total: total dyeing (current month only)<br>
            • Per Day: cpb per day (current month)<br>
            • Per Day Dyeing: mar per day dyeing (monthly table)<br>
            • Inspection: feb rolling inspection
        </div>
    `)}
`
});

});

module.exports = router;
