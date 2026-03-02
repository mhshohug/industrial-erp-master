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

async function fetchSheet(gid) {
    try {
        const url = `https://docs.google.com/spreadsheets/d/\( {SHEET_ID}/export?format=csv&gid= \){gid}`;
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
        return moment("1899-12-30").add(Number(value),'days').format("DD-MMM-YYYY");

    const formats = [
        "DD-MMM-YYYY","D-MMM-YYYY","DD/MM/YYYY",
        "D/M/YYYY","YYYY-MM-DD",
        "DD-MMM-YY","D-MMM-YY","DD-MMM-YYYY HH:mm:ss"
    ];

    const m = moment(value, formats, true);
    if(m.isValid()) return m.format("DD-MMM-YYYY");

    return value.toUpperCase();
}

function getParsedDate(q){
    if(q.includes("today") || q.includes("aj"))
        return moment().format("DD-MMM-YYYY");

    if(q.includes("yesterday") || q.includes("kal"))
        return moment().subtract(1,'days').format("DD-MMM-YYYY");

    if(q.includes("porshu"))
        return moment().subtract(2,'days').format("DD-MMM-YYYY");

    const match = q.match(/(\d+)\s*([a-z]+)/);
    if(!match) return null;

    let year = moment().year();
    if(moment(`${match[1]} ${match[2]} ${year}`,"D MMM YYYY").isAfter(moment()))
        year--;

    return moment(`${match[1]} ${match[2]} ${year}`,"D MMM YYYY")
        .format("DD-MMM-YYYY");
}

// ────────────────────────────────────────────────
//                  POST /ask handler
// ────────────────────────────────────────────────
router.post("/ask", async (req, res) => {

    const q = (req.body.question || "").toLowerCase().trim();

    const isTotalQuery = /\btotall?\b/.test(q);

    const sheets = await Promise.all(Object.values(GID_MAP).map(fetchSheet));
    const [grey, sing, marc, cpb, jet, jig, roll] = sheets;

    const getRollingBySill = (sill) => {
        return roll.reduce((a, r) => (
            (r[1] || "").trim() === sill
                ? a + (parseFloat((r[7] || "").replace(/,/g, '')) || 0)
                : a
        ), 0);
    };

    // ─── SMART PARTY SEARCH ────────────────────────────────────────
    function normalizeName(str) {
        return (str || "").toLowerCase().replace(/[\s.\-]/g, '').trim();
    }

    const uniqueParties = [...new Set(grey.map(r => r[3]).filter(Boolean))];

    if (!q.match(/\d/) && q.length >= 2) {
        let input = normalizeName(q);
        let bestMatch = uniqueParties.find(p => normalizeName(p).includes(input));

        if (bestMatch) {
            let rows = grey.filter(r => normalizeName(r[3]) === normalizeName(bestMatch));
            let last15 = rows.slice(-15);

            let reply = `🏷️ **Party: ${bestMatch.toUpperCase()}**\n━━━━━━━━━━━━━━━━━━━━━━━\n`;

            last15.forEach(r => {
                let lot = parseFloat((r[6] || "").replace(/,/g, '')) || 0;
                let rolling = getRollingBySill((r[2] || "").trim());
                let diff = rolling - lot;

                let status = diff >= 0
                    ? `Extra ${Math.abs(diff).toLocaleString()} yds`
                    : `Short ${Math.abs(diff).toLocaleString()} yds`;

                reply += `🔹 Sill ${r[2]}  |  ${r[4]}  |  Lot ${lot.toLocaleString()}  |  Roll ${rolling.toLocaleString()}  |  ${status}\n`;
            });

            reply += `\n📊 Showing last ${last15.length} of ${rows.length} entries`;
            return res.json({ reply });
        }
    }

    // ─── DATE SEARCH ───────────────────────────────────────────────
    const dateInput = getParsedDate(q);

    if (dateInput && !q.match(/sill\s*(\d+)/) && !q.match(/^\d+$/)) {

        const sections = { singing: sing, marcerise: marc, cpb: cpb, jet: jet, jigger: jig, rolling: roll };
        let targetKey = Object.keys(sections).find(s => q.includes(s));

        if (targetKey) {

            let details = [], total = 0;
            let sillMap = {};

            let vIdx = (targetKey === "singing" || targetKey === "marcerise") ? 8 : (targetKey === "jet" || targetKey === "cpb" ? 6 : 7);

            sections[targetKey].forEach(r => {
                if (normalizeSheetDate(r[0]) === normalizeSheetDate(dateInput)) {
                    let sNum = r[1] || "N/A";
                    let val = parseFloat((r[vIdx] || "").replace(/,/g, '')) || 0;
                    if (val <= 0) return;

                    let g = grey.find(gr => (gr[2] || "").trim() === sNum);
                    let party = g ? g[3] : "Unknown";
                    let lot = g ? parseFloat((g[6] || "").replace(/,/g, '')) || 0 : 0;

                    if (!sillMap[sNum]) {
                        sillMap[sNum] = { party, lot, val: 0 };
                    }
                    sillMap[sNum].val += val;
                }
            });

            Object.keys(sillMap).forEach(s => {
                let d = sillMap[s];
                details.push(`🔹 Sill ${s}  |  ${d.party}  |  Lot ${d.lot.toLocaleString()}  |  ${d.val.toLocaleString()} yds`);
                total += d.val;
            });

            if (details.length) {
                return res.json({
                    reply: `📅 **${targetKey.toUpperCase()} — \( {dateInput}**\n━━━━━━━━━━━━━━━━━━━━━━━\n \){details.join("\n")}\n\n📍 **Total: ${total.toLocaleString()} yds**`
                });
            }

            return res.json({ reply: `📅 ${dateInput} তারিখে ${targetKey} সেকশনে কোনো ডাটা পাওয়া যায়নি।` });
        }

        // daily summary
        const dSum = (rows, idx) => rows.reduce((acc, r) =>
            normalizeSheetDate(r[0]) === normalizeSheetDate(dateInput)
                ? acc + (parseFloat((r[idx] || "").replace(/,/g, '')) || 0)
                : acc, 0);

        const cVal = dSum(cpb, 6), jVal = dSum(jet, 6), jgVal = dSum(jig, 7);

        return res.json({
            reply: `📅 **Daily Summary — ${dateInput}**\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
                   `🔹 Singing:    ${dSum(sing, 8).toLocaleString()} yds\n` +
                   `🔹 Marcerise:  ${dSum(marc, 8).toLocaleString()} yds\n` +
                   `🔹 CPB:        ${cVal.toLocaleString()} yds\n` +
                   `🔹 Jet:        ${jVal.toLocaleString()} yds\n` +
                   `🔹 Jigger:     ${jgVal.toLocaleString()} yds\n` +
                   `───────────────────────────────\n` +
                   `📍 Total Dyeing:  ${(cVal + jVal + jgVal).toLocaleString()} yds\n` +
                   `✅ Rolling:       ${dSum(roll, 7).toLocaleString()} yds`
        });
    }

    // ─── SILL REPORT ───────────────────────────────────────────────
    let sMatch = q.match(/(\d+)/);
    if (sMatch && !q.includes("total")) {

        const sill = sMatch[1];
        const gRow = grey.find(r => (r[2] || "").trim() === sill);
        if (!gRow) return res.json({ reply: `Sill ${sill} পাওয়া যায়নি।` });

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
        const diff = lotSize - data.roll;

        return res.json({
            reply: `📊 **Sill Report — ${sill}**\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
                   `👤 Party:     ${gRow[3]}\n` +
                   `📜 Quality:   ${gRow[4]}\n` +
                   `📦 Lot Size:  ${lotSize.toLocaleString()} yds\n\n` +
                   `⚙️ Process:\n` +
                   `  Singing    → ${data.sing.toLocaleString()} yds\n` +
                   `  Marcerise  → ${data.marc.toLocaleString()} yds\n\n` +
                   `🎨 Dyeing:\n` +
                   `  CPB        → ${data.cpb.toLocaleString()} yds\n` +
                   `  Jet        → ${data.jet.toLocaleString()} yds\n` +
                   `  Jigger     → ${data.jig.toLocaleString()} yds\n` +
                   `───────────────────────────────\n` +
                   `📍 Total Dyeing → ${(data.cpb + data.jet + data.jig).toLocaleString()} yds\n\n` +
                   `✅ Rolling     → ${data.roll.toLocaleString()} yds\n` +
                   `───────────────────────────────\n` +
                   `${diff <= 0 ? "📈 Extra" : "📉 Short"}: ${Math.abs(diff).toLocaleString()} yds`
        });
    }

    // ─── LOT SEARCH ────────────────────────────────────────────────
    let lotMatch = q.match(/lot\s*(\d+)/) || q.match(/^\d{4,6}$/);

    if (lotMatch && !q.includes("sill")) {
        const lotNumber = lotMatch[1] || lotMatch[0];

        const gRow = grey.find(r =>
            (r[6] || "").replace(/,/g, '').trim() === lotNumber
        );

        if (!gRow)
            return res.json({ reply: `Lot ${lotNumber} পাওয়া যায়নি।` });

        const sill = gRow[2];
        const party = gRow[3];
        const quality = gRow[4];
        const lotSize = parseFloat((gRow[6] || "").replace(/,/g, '')) || 0;

        const rolling = roll.reduce((a, r) =>
            (r[1] || "").trim() === sill
                ? a + (parseFloat((r[7] || "").replace(/,/g, '')) || 0)
                : a
            , 0);

        const diff = rolling - lotSize;

        return res.json({
            reply: `📦 **Lot Report — ${lotNumber}**\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
                   `🏷️ Party:    ${party}\n` +
                   `🔹 Sill:      ${sill}\n` +
                   `📜 Quality:   ${quality}\n` +
                   `📦 Lot Size:  ${lotSize.toLocaleString()} yds\n` +
                   `✅ Rolling:   ${rolling.toLocaleString()} yds\n` +
                   `───────────────────────────────\n` +
                   `${diff >= 0 ? "📈 Extra" : "📉 Short"}: ${Math.abs(diff).toLocaleString()} yds`
        });
    }

    // ─── MONTH + DYEING (single month) ─────────────────────────────
    const monthOnlyMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i);

    if (monthOnlyMatch && q.includes("dyeing")) {
        const monthName = monthOnlyMatch[1].toLowerCase();
        const monthIndex = moment().month(monthName).month();

        const filterByMonth = (rows, idx) =>
            rows.reduce((acc, r) => {
                const d = normalizeSheetDate(r[0]);
                const m = moment(d, "DD-MMM-YYYY", true);
                if (m.isValid() && m.month() === monthIndex) {
                    return acc + (parseFloat((r[idx] || "").replace(/,/g, '')) || 0);
                }
                return acc;
            }, 0);

        const cpbTotal   = filterByMonth(cpb, 6);
        const jetTotal   = filterByMonth(jet, 6);
        const jiggerTotal = filterByMonth(jig, 7);

        const grandTotal = cpbTotal + jetTotal + jiggerTotal;

        if (grandTotal === 0) {
            return res.json({ reply: `📅 **${monthName.toUpperCase()}** মাসে কোনো Dyeing ডাটা পাওয়া যায়নি।` });
        }

        return res.json({
            reply: `🎨 **${monthName.toUpperCase()} Dyeing Report**\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
                   `🔹 CPB:     ${cpbTotal.toLocaleString()} yds\n` +
                   `🔹 Jet:     ${jetTotal.toLocaleString()} yds\n` +
                   `🔹 Jigger:  ${jiggerTotal.toLocaleString()} yds\n` +
                   `───────────────────────────────\n` +
                   `📍 Total Dyeing: ${grandTotal.toLocaleString()} yds`
        });
    }

    // ─── MONTH TOTAL (old style) ───────────────────────────────────
    const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i);

    if (monthMatch && q.includes("total")) {
        const monthName = monthMatch[1].toLowerCase();
        const monthIndex = moment().month(monthName).month();

        const filterByMonth = (rows, idx) =>
            rows.reduce((acc, r) => {
                const d = normalizeSheetDate(r[0]);
                const m = moment(d, "DD-MMM-YYYY", true);
                if (m.isValid() && m.month() === monthIndex)
                    return acc + (parseFloat((r[idx] || "").replace(/,/g, '')) || 0);
                return acc;
            }, 0);

        const totals = {
            s: filterByMonth(sing, 8),
            m: filterByMonth(marc, 8),
            c: filterByMonth(cpb, 6),
            j: filterByMonth(jet, 6),
            jg: filterByMonth(jig, 7),
            r: filterByMonth(roll, 7)
        };

        if (q.includes("dyeing")) {
            return res.json({
                reply: `📅 **${monthName.toUpperCase()} Dyeing**\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🔹 CPB:    ${totals.c.toLocaleString()} yds\n` +
                       `🔹 Jet:    ${totals.j.toLocaleString()} yds\n` +
                       `🔹 Jigger: ${totals.jg.toLocaleString()} yds\n` +
                       `───────────────────────────────\n` +
                       `📍 Total:  ${(totals.c + totals.j + totals.jg).toLocaleString()} yds`
            });
        }

        return res.json({
            reply: `📅 **${monthName.toUpperCase()} Monthly Report**\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
                   `🔹 Singing:   ${totals.s.toLocaleString()} yds\n` +
                   `🔹 Marcerise: ${totals.m.toLocaleString()} yds\n` +
                   `🔹 CPB:       ${totals.c.toLocaleString()} yds\n` +
                   `🔹 Jet:       ${totals.j.toLocaleString()} yds\n` +
                   `🔹 Jigger:    ${totals.jg.toLocaleString()} yds\n` +
                   `───────────────────────────────\n` +
                   `✅ Rolling:   ${totals.r.toLocaleString()} yds`
        });
    }

    // ─── PER DAY REPORT ────────────────────────────────────────────
    if (q.includes("per day")) {

        const sectionMap = {
            singing:   { rows: sing,   idx: 8 },
            marcerise: { rows: marc,   idx: 8 },
            cpb:       { rows: cpb,    idx: 6 },
            jet:       { rows: jet,    idx: 6 },
            jigger:    { rows: jig,    idx: 7 },
            rolling:   { rows: roll,   idx: 7 }
        };

        const sectionKey = Object.keys(sectionMap).find(s => q.includes(s));
        const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i);

        if (sectionKey) {
            const { rows, idx } = sectionMap[sectionKey];

            let dayMap = {};
            let monthIndex = monthMatch ? moment().month(monthMatch[1]).month() : null;

            rows.forEach(r => {
                const date = normalizeSheetDate(r[0]);
                const m = moment(date, "DD-MMM-YYYY", true);
                const val = parseFloat((r[idx] || "").replace(/,/g, '')) || 0;

                if (!m.isValid() || val <= 0) return;
                if (monthIndex !== null && m.month() !== monthIndex) return;

                const formattedDate = m.format("DD-MMM-YYYY");
                dayMap[formattedDate] = (dayMap[formattedDate] || 0) + val;
            });

            const sortedDates = Object.keys(dayMap).sort((a,b) => moment(a,"DD-MMM-YYYY") - moment(b,"DD-MMM-YYYY"));

            if (!sortedDates.length)
                return res.json({ reply: `এই সময়ের মধ্যে কোনো ডাটা পাওয়া যায়নি।` });

            let total = 0;
            let title = monthMatch ? `${monthMatch[1].toUpperCase()} ` : "";
            let reply = `📅 **\( {title} \){sectionKey.toUpperCase()} Per Day**\n━━━━━━━━━━━━━━━━━━━━━━━\n`;

            sortedDates.forEach((d, i) => {
                total += dayMap[d];
                reply += `${String(i+1).padStart(2,'0')}. ${d}  →  ${dayMap[d].toLocaleString()} yds\n`;
            });

            reply += `\n───────────────────────────────\n📊 Total: ${total.toLocaleString()} yds`;

            return res.json({ reply });
        }
    }

    // ─── TOTAL / MONTHLY BREAKDOWN ─────────────────────────────────
    if (isTotalQuery) {

        if (q.includes("dyeing")) {

            const sectionMap = {
                cpb:    { rows: cpb,  idx: 6 },
                jet:    { rows: jet,  idx: 6 },
                jigger: { rows: jig,  idx: 7 }
            };

            let monthData = {};

            Object.keys(sectionMap).forEach(sec => {
                const { rows, idx } = sectionMap[sec];

                rows.forEach(r => {
                    const d = normalizeSheetDate(r[0]);
                    const m = moment(d, "DD-MMM-YYYY", true);
                    if (!m.isValid()) return;

                    const monthKey = m.format("MMM-YYYY");
                    const val = parseFloat((r[idx] || "").replace(/,/g, '')) || 0;
                    if (val <= 0) return;

                    if (!monthData[monthKey]) {
                        monthData[monthKey] = { cpb: 0, jet: 0, jigger: 0 };
                    }

                    monthData[monthKey][sec] += val;
                });
            });

            const sortedMonths = Object.keys(monthData)
                .sort((a, b) => moment(a, "MMM-YYYY") - moment(b, "MMM-YYYY"));

            if (!sortedMonths.length)
                return res.json({ reply: "কোনো Dyeing ডাটা পাওয়া যায়নি।" });

            let html = `
<h3 style="text-align:center; margin:12px 0; color:#1e40af;">Dyeing Monthly Breakdown</h3>

<table style="width:100%; border-collapse:collapse; font-size:14px; line-height:1.5;">
  <thead>
    <tr style="background:#1e40af; color:white;">
      <th style="border:1px solid #93c5fd; padding:10px; text-align:center;">Month</th>
      <th style="border:1px solid #93c5fd; padding:10px; text-align:right;">CPB</th>
      <th style="border:1px solid #93c5fd; padding:10px; text-align:right;">Jet</th>
      <th style="border:1px solid #93c5fd; padding:10px; text-align:right;">Jigger</th>
      <th style="border:1px solid #93c5fd; padding:10px; text-align:right; background:#1e293b; color:white;">Total</th>
    </tr>
  </thead>
  <tbody>
`;

            sortedMonths.forEach(m => {
                const d = monthData[m];
                const total = d.cpb + d.jet + d.jigger;

                html += `
    <tr>
      <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:600;">${m}</td>
      <td style="border:1px solid #cbd5e1; padding:10px; text-align:right;">${d.cpb.toLocaleString()}</td>
      <td style="border:1px solid #cbd5e1; padding:10px; text-align:right;">${d.jet.toLocaleString()}</td>
      <td style="border:1px solid #cbd5e1; padding:10px; text-align:right;">${d.jigger.toLocaleString()}</td>
      <td style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:bold;">${total.toLocaleString()}</td>
    </tr>`;
            });

            html += `
  </tbody>
</table>
`;

            return res.json({ reply: html });
        }

        // Full grand total
        const tSum = (rows, idx) =>
            rows.reduce((a, r) => a + (parseFloat((r[idx] || "").replace(/,/g, '')) || 0), 0);

        const t = {
            s: tSum(sing, 8),
            m: tSum(marc, 8),
            c: tSum(cpb, 6),
            j: tSum(jet, 6),
            jg: tSum(jig, 7),
            r: tSum(roll, 7)
        };

        return res.json({
            reply: `🌍 **Overall Summary**\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
                   `🔹 Singing:   ${t.s.toLocaleString()} yds\n` +
                   `🔹 Marcerise: ${t.m.toLocaleString()} yds\n` +
                   `🔹 CPB:       ${t.c.toLocaleString()} yds\n` +
                   `🔹 Jet:       ${t.j.toLocaleString()} yds\n` +
                   `🔹 Jigger:    ${t.jg.toLocaleString()} yds\n` +
                   `───────────────────────────────\n` +
                   `✅ Total Rolling: ${t.r.toLocaleString()} yds`
        });
    }

    // ─── ROLLING INSPECTION ────────────────────────────────────────
    if (q.includes("rolling") && (q.includes("inspection") || q.includes("ins"))) {

        const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i);
        if (!monthMatch)
            return res.json({ reply: "মাস উল্লেখ করুন (যেমন: feb rolling inspection)" });

        const monthName = monthMatch[1].toLowerCase();
        const monthIndex = moment().month(monthName).month();

        let sillMap = {};

        roll.forEach(r => {
            const date = normalizeSheetDate(r[0]);
            const m = moment(date, "DD-MMM-YYYY", true);
            if (!m.isValid() || m.month() !== monthIndex) return;

            const sill = (r[1] || "").trim();
            const rollingVal = parseFloat((r[7] || "").replace(/,/g, '')) || 0;
            if (!sill || rollingVal <= 0) return;

            sillMap[sill] = (sillMap[sill] || 0) + rollingVal;
        });

        let rows = [];

        Object.keys(sillMap).forEach(sill => {
            const gRow = grey.find(gr => (gr[2] || "").trim() === sill);
            if (!gRow) return;

            const party = gRow[3] || "Unknown";
            const lot = parseFloat((gRow[6] || "").replace(/,/g, '')) || 0;
            const rollingTotal = sillMap[sill];
            const diff = rollingTotal - lot;
            const percent = lot > 0 ? ((diff / lot) * 100) : 0;

            rows.push({ sill: Number(sill), party, lot, rollingTotal, diff, percent });
        });

        rows.sort((a, b) => a.sill - b.sill);

        let html = `
<h3 style="text-align:center; margin:12px 0;">${monthName.toUpperCase()} Rolling Inspection</h3>

<table style="width:100%; border-collapse:collapse; font-size:14px; text-align:center;">
  <thead>
    <tr style="background:#334155; color:white; font-weight:bold;">
      <th style="border:1px solid #475569; padding:8px;">%</th>
      <th style="border:1px solid #475569; padding:8px;">Sill</th>
      <th style="border:1px solid #475569; padding:8px; text-align:left;">Party</th>
      <th style="border:1px solid #475569; padding:8px;">Lot</th>
      <th style="border:1px solid #475569; padding:8px;">Rolling</th>
      <th style="border:1px solid #475569; padding:8px;">Diff</th>
    </tr>
  </thead>
  <tbody>
`;

        rows.forEach(r => {
            const color = r.diff < 0 ? "color:#ef4444;" : "color:#22c55e;";
            html += `
    <tr>
      <td style="border:1px solid #cbd5e1; padding:8px; \( {color} font-weight:bold;"> \){r.percent.toFixed(1)}%</td>
      <td style="border:1px solid #cbd5e1; padding:8px;">${r.sill}</td>
      <td style="border:1px solid #cbd5e1; padding:8px; text-align:left;">${r.party}</td>
      <td style="border:1px solid #cbd5e1; padding:8px;">${r.lot.toLocaleString()}</td>
      <td style="border:1px solid #cbd5e1; padding:8px;">${r.rollingTotal.toLocaleString()}</td>
      <td style="border:1px solid #cbd5e1; padding:8px; \( {color} font-weight:bold;"> \){r.diff >= 0 ? '+' : ''}${r.diff.toLocaleString()}</td>
    </tr>`;
        });

        html += `</tbody></table>`;

        return res.json({ reply: html });
    }

    // ─── SMART DIRECT SECTION HISTORY ──────────────────────────────
    const secDetect = (q) => {
        if (/cpb/.test(q)) return "cpb";
        if (/\bjet\b/.test(q)) return "jet";
        if (/jig|jiger|jigger|jg/.test(q)) return "jigger";
        if (/roll/.test(q)) return "rolling";
        if (/sing/.test(q)) return "singing";
        if (/mar|merc/.test(q)) return "marcerise";
        return null;
    };

    const sectionKey = secDetect(q);

    if (sectionKey) {
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

        if (sMatch) {
            let sill = sMatch[0];
            let g = grey.find(r => (r[2] || "").trim() === sill);
            let party = g ? g[3] : "Unknown";

            let total = 0, lines = [];

            rows.forEach(r => {
                if ((r[1] || "").trim() === sill) {
                    let date = normalizeSheetDate(r[0]);
                    let vIdx = (sectionKey === "singing" || sectionKey === "marcerise") ? 8 : (sectionKey === "jet" || sectionKey === "cpb" ? 6 : 7);
                    let val = parseFloat((r[vIdx] || "").replace(/,/g, '')) || 0;
                    if (val <= 0) return;

                    lines.push(`🔹 ${date}   ${val.toLocaleString()} yds`);
                    total += val;
                }
            });

            if (lines.length) {
                return res.json({
                    reply: `📊 **${sectionKey.toUpperCase()} History — Sill ${sill}**\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
                           `${lines.join("\n")}\n\n` +
                           `📍 Total ${sectionKey.toUpperCase()}: ${total.toLocaleString()} yds`
                });
            }
        }
    }

    // ─── FALLBACK ──────────────────────────────────────────────────
    res.json({ reply: "Sill নম্বর, তারিখ, lot, party নাম বা মাসের নাম দিয়ে সার্চ করুন।\nউদাহরণ:\n• sill 590\n• 3 feb jet\n• total dyeing\n• feb rolling inspection" });

});

module.exports = router;
