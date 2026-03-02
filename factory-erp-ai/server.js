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

// ইউটিলিটি ফাংশন
const formatHeader = (title) => {
    const line = "━".repeat(35);
    return `${line}\n   📌 ${title}\n${line}`;
};

const formatNumber = (num) => {
    return (num || 0).toLocaleString();
};

const formatDate = (date) => {
    return moment(date).format("DD-MMM-YYYY").toUpperCase();
};

const formatStatus = (diff) => {
    const absDiff = Math.abs(diff);
    if (diff >= 0) {
        return `✅ Extra: ${formatNumber(absDiff)} yds`;
    } else {
        return `⚠️ Short: ${formatNumber(absDiff)} yds`;
    }
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
    value=value.toString().trim();

    if(!isNaN(value) && Number(value)>40000)
        return moment("1899-12-30").add(Number(value),'days').format("DD-MMM-YYYY");

    const formats=[
        "DD-MMM-YYYY","D-MMM-YYYY","DD/MM/YYYY",
        "D/M/YYYY","YYYY-MM-DD",
        "DD-MMM-YY","D-MMM-YY","DD-MMM-YYYY HH:mm:ss"
    ];

    const m=moment(value,formats,true);
    if(m.isValid()) return m.format("DD-MMM-YYYY");

    return value.toUpperCase();
}

function getParsedDate(q){
    if(q.includes("today")||q.includes("aj"))
        return moment().format("DD-MMM-YYYY");

    if(q.includes("yesterday")||q.includes("kal"))
        return moment().subtract(1,'days').format("DD-MMM-YYYY");

    if(q.includes("porshu"))
        return moment().subtract(2,'days').format("DD-MMM-YYYY");

    const match=q.match(/(\d+)\s*([a-z]+)/);
    if(!match) return null;

    let year=moment().year();
    if(moment(`${match[1]} ${match[2]} ${year}`,"D MMM YYYY").isAfter(moment()))
        year--;

    return moment(`${match[1]} ${match[2]} ${year}`,"D MMM YYYY")
        .format("DD-MMM-YYYY");
}

// ================= ASK =================
router.post("/ask", async (req,res)=>{

const q=(req.body.question||"").toLowerCase().trim();
const isTotalQuery = /\btotall?\b/.test(q);

const sheets=await Promise.all(Object.values(GID_MAP).map(fetchSheet));
const [grey,sing,marc,cpb,jet,jig,roll]=sheets;

const getRollingBySill=(sill)=>{
return roll.reduce((a,r)=>(
(r[1]||"").trim()===sill
? a+(parseFloat((r[7]||"").replace(/,/g,''))||0)
: a
),0);
};

// ================= পার্টি সার্চ =================
function normalizeName(str){
    return (str||"").toLowerCase().replace(/[\s.\-]/g,'').trim();
}

const uniqueParties=[...new Set(grey.map(r=>r[3]).filter(Boolean))];

if(!q.match(/\d/) && q.length>=2){

    let input=normalizeName(q);
    let bestMatch=uniqueParties.find(p=>{
        let np=normalizeName(p);
        return np.includes(input);
    });

    if(bestMatch){

        let rows=grey.filter(r=>normalizeName(r[3])===normalizeName(bestMatch));
        let last10=rows.slice(-10);

        let reply = `${formatHeader(bestMatch.toUpperCase())}\n\n`;

        last10.forEach(r=>{
            let lot=parseFloat((r[6]||"").replace(/,/g,''))||0;
            let rolling=getRollingBySill((r[2]||"").trim());
            let diff=rolling-lot;

            reply += `🔹 Sill ${r[2]} | ${r[4]}\n`;
            reply += `   📦 Lot: ${formatNumber(lot)} yds\n`;
            reply += `   ✅ Roll: ${formatNumber(rolling)} yds\n`;
            reply += `   📊 ${formatStatus(diff)}\n\n`;
        });

        reply += `━━━━━━━━━━━━━━━━\n📊 Last ${last10.length} of ${rows.length}`;

        return res.json({reply});
    }
}

// ===== তারিখ সার্চ =====
const dateInput=getParsedDate(q);

if(dateInput && !q.match(/sill\s*(\d+)/) && !q.match(/^\d+$/)){

const sections={singing:sing,marcerise:marc,cpb:cpb,jet:jet,jigger:jig,rolling:roll};
let targetKey=Object.keys(sections).find(s=>q.includes(s));

if(targetKey){

let details=[],total=0;
let sillMap={};

let vIdx=(targetKey==="singing"||targetKey==="marcerise")?8:(targetKey==="jet"||targetKey==="cpb"?6:7);

sections[targetKey].forEach(r=>{

if(normalizeSheetDate(r[0])===normalizeSheetDate(dateInput)){

let sNum=r[1]||"N/A";
let val=parseFloat((r[vIdx]||"").replace(/,/g,''))||0;
if(val<=0) return;

let g=grey.find(gr=>(gr[2]||"").trim()===sNum);
let party=g?g[3]:"Unknown";
let lot=g?parseFloat((g[6]||"").replace(/,/g,''))||0:0;

if(!sillMap[sNum]){
    sillMap[sNum]={party,lot,val:0};
}
sillMap[sNum].val+=val;

}
});

Object.keys(sillMap).forEach(s=>{
    let d=sillMap[s];
    details.push(`🔹 Sill ${s} | ${d.party}\n   📦 Lot: ${formatNumber(d.lot)} yds\n   🎨 ${targetKey.toUpperCase()}: ${formatNumber(d.val)} yds`);
    total+=d.val;
});

if(details.length){
let reply = `${formatHeader(`${targetKey.toUpperCase()} - ${dateInput}`)}\n\n`;
reply += details.join("\n\n");
reply += `\n\n━━━━━━━━━━━━━━━━\n📍 Total: ${formatNumber(total)} yds`;
return res.json({reply});
}

return res.json({reply:`${formatHeader("No Data")}\n\n📅 No data for ${targetKey} on ${dateInput}`});
}

// দৈনিক সামারি
const dSum=(rows,idx)=>rows.reduce((acc,r)=>
normalizeSheetDate(r[0])===normalizeSheetDate(dateInput)
?acc+(parseFloat((r[idx]||"").replace(/,/g,''))||0)
:acc,0);

const cVal=dSum(cpb,6),jVal=dSum(jet,6),jgVal=dSum(jig,7);
const singingVal = dSum(sing,8);
const marceriseVal = dSum(marc,8);
const rollingVal = dSum(roll,7);
const totalDyeing = cVal + jVal + jgVal;

let reply = `${formatHeader(`Daily - ${dateInput}`)}\n\n`;
reply += `🎨 Pre:\n🔹 Sing: ${formatNumber(singingVal)}\n🔹 Marc: ${formatNumber(marceriseVal)}\n\n`;
reply += `🎨 Dye:\n🔹 CPB: ${formatNumber(cVal)}\n🔹 Jet: ${formatNumber(jVal)}\n🔹 Jig: ${formatNumber(jgVal)}\n`;
reply += `━━━━━━━━━━━━━━━━\n📍 Dye Total: ${formatNumber(totalDyeing)}\n✅ Rolling: ${formatNumber(rollingVal)}`;

return res.json({reply});
}


// ===== সিল রিপোর্ট =====
let sMatch=q.match(/(\d+)/);
if(sMatch && !q.includes("total")){

const sill=sMatch[1];
const gRow=grey.find(r=>(r[2]||"").trim()===sill);
if(!gRow) return res.json({reply:`${formatHeader("Not Found")}\n\n❌ Sill ${sill} not found.`});

const getVal=(rows,s,sIdx,vIdx)=>
rows.reduce((a,r)=>r[sIdx]===s
?a+(parseFloat((r[vIdx]||"").replace(/,/g,''))||0)
:a,0);

const data={
sing:getVal(sing,sill,1,8),
marc:getVal(marc,sill,1,8),
cpb:getVal(cpb,sill,1,6),
jet:getVal(jet,sill,1,6),
jig:getVal(jig,sill,1,7),
roll:getVal(roll,sill,1,7)
};

const lotSize=parseFloat((gRow[6]||"").replace(/,/g,''))||0;
const totalDyeing = data.cpb + data.jet + data.jig;
const diff = lotSize - data.roll;

let reply = `${formatHeader(`Sill ${sill}`)}\n\n`;
reply += `👤 ${gRow[3]}\n📜 ${gRow[4]}\n📦 Lot: ${formatNumber(lotSize)}\n\n`;
reply += `━━━━━━━━━━━━━━━━\n`;
reply += `🎨 Pre:\n🔹 Sing: ${formatNumber(data.sing)}\n🔹 Marc: ${formatNumber(data.marc)}\n\n`;
reply += `🎨 Dye:\n🔹 CPB: ${formatNumber(data.cpb)}\n🔹 Jet: ${formatNumber(data.jet)}\n🔹 Jig: ${formatNumber(data.jig)}\n`;
reply += `━━━━━━━━━━━━━━━━\n`;
reply += `📍 Dye Total: ${formatNumber(totalDyeing)}\n✅ Roll: ${formatNumber(data.roll)}\n`;
reply += `━━━━━━━━━━━━━━━━\n`;
reply += `📊 ${diff<=0?"✅ Extra":"⚠️ Short"}: ${formatNumber(Math.abs(diff))}`;

return res.json({reply});
}

// ===== লট সার্চ =====
let lotMatch = q.match(/lot\s*(\d+)/) || q.match(/^\d{4,6}$/);

if(lotMatch && !q.includes("sill")){

    const lotNumber = lotMatch[1] || lotMatch[0];
    const gRow = grey.find(r => (r[6]||"").replace(/,/g,'').trim() === lotNumber);

    if(!gRow)
        return res.json({reply:`${formatHeader("Not Found")}\n\n❌ Lot ${lotNumber} not found.`});

    const sill = gRow[2];
    const party = gRow[3];
    const quality = gRow[4];
    const lotSize = parseFloat((gRow[6]||"").replace(/,/g,''))||0;

    const rolling = roll.reduce((a,r)=>
        (r[1]||"").trim()===sill
        ? a+(parseFloat((r[7]||"").replace(/,/g,''))||0)
        : a
    ,0);

    const diff = rolling - lotSize;

    let reply = `${formatHeader(`Lot ${lotNumber}`)}\n\n`;
    reply += `🏷️ ${party}\n🔹 Sill: ${sill}\n📜 ${quality}\n`;
    reply += `━━━━━━━━━━━━━━━━\n`;
    reply += `📦 Lot: ${formatNumber(lotSize)}\n✅ Roll: ${formatNumber(rolling)}\n`;
    reply += `━━━━━━━━━━━━━━━━\n`;
    reply += `📊 ${diff>=0?"✅ Extra":"⚠️ Short"}: ${formatNumber(Math.abs(diff))}`;

    return res.json({reply});
}

// ===== মাসিক ডাইং রিপোর্ট =====
const monthOnlyMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);

if(monthOnlyMatch && q.includes("dyeing")){

    const monthName = monthOnlyMatch[1];
    const monthIndex = moment().month(monthName).month();

    const filterByMonth = (rows, idx) => 
        rows.reduce((acc, r) => {
            const d = normalizeSheetDate(r[0]);
            const m = moment(d, "DD-MMM-YYYY", true);
            if(m.isValid() && m.month() === monthIndex){
                return acc + (parseFloat((r[idx]||"").replace(/,/g,'')) || 0);
            }
            return acc;
        }, 0);

    const cpbTotal = filterByMonth(cpb,6);
    const jetTotal = filterByMonth(jet,6);
    const jiggerTotal = filterByMonth(jig,7);
    const grandTotal = cpbTotal + jetTotal + jiggerTotal;

    if(grandTotal === 0){
        return res.json({reply:`${formatHeader("No Data")}\n\n📅 No dyeing for ${monthName.toUpperCase()}`});
    }

    let reply = `${formatHeader(`${monthName.toUpperCase()} Dyeing`)}\n\n`;
    reply += `🔹 CPB: ${formatNumber(cpbTotal)}\n🔹 Jet: ${formatNumber(jetTotal)}\n🔹 Jig: ${formatNumber(jiggerTotal)}\n`;
    reply += `━━━━━━━━━━━━━━━━\n📍 Total: ${formatNumber(grandTotal)}`;

    return res.json({reply});
}

// ===== গ্র্যান্ড টোটাল / মাসিক ব্রেকডাউন =====
if(isTotalQuery){

    if(q.includes("dyeing")){

        const sectionMap = {
            cpb: {rows: cpb, idx: 6},
            jet: {rows: jet, idx: 6},
            jigger: {rows: jig, idx: 7}
        };

        let monthData = {};

        Object.keys(sectionMap).forEach(sec=>{
            const {rows, idx} = sectionMap[sec];

            rows.forEach(r=>{
                const d = normalizeSheetDate(r[0]);
                const m = moment(d,"DD-MMM-YYYY",true);
                if(!m.isValid()) return;

                const monthKey = m.format("MMM-YYYY");
                const val = parseFloat((r[idx]||"").replace(/,/g,''))||0;
                if(val<=0) return;

                if(!monthData[monthKey]){
                    monthData[monthKey] = {cpb:0, jet:0, jigger:0};
                }

                monthData[monthKey][sec] += val;
            });
        });

        const sortedMonths = Object.keys(monthData)
            .sort((a,b)=>moment(a,"MMM-YYYY")-moment(b,"MMM-YYYY"));

        if(!sortedMonths.length)
            return res.json({reply:`${formatHeader("No Data")}\n\nNo dyeing data found.`});

        let reply = `${formatHeader("Monthly Dyeing")}\n`;

        sortedMonths.forEach(m=>{
            const data = monthData[m];
            const total = data.cpb + data.jet + data.jigger;

            reply += `\n📅 ${m}\n`;
            reply += `   CPB: ${formatNumber(data.cpb)}\n`;
            reply += `   Jet: ${formatNumber(data.jet)}\n`;
            reply += `   Jig: ${formatNumber(data.jigger)}\n`;
            reply += `   📍 Total: ${formatNumber(total)}\n`;
        });

        return res.json({reply});
    }

    // Full Grand Total
    const tSum = (rows,idx)=>
        rows.reduce((a,r)=>
            a+(parseFloat((r[idx]||"").replace(/,/g,''))||0)
        ,0);

    const t = {
        s: tSum(sing,8),
        m: tSum(marc,8),
        c: tSum(cpb,6),
        j: tSum(jet,6),
        jg: tSum(jig,7),
        r: tSum(roll,7)
    };

    let reply = `${formatHeader("Grand Total")}\n\n`;
    reply += `🎨 Pre:\n🔹 Sing: ${formatNumber(t.s)}\n🔹 Marc: ${formatNumber(t.m)}\n\n`;
    reply += `🎨 Dye:\n🔹 CPB: ${formatNumber(t.c)}\n🔹 Jet: ${formatNumber(t.j)}\n🔹 Jig: ${formatNumber(t.jg)}\n`;
    reply += `━━━━━━━━━━━━━━━━\n✅ Rolling: ${formatNumber(t.r)}`;

    return res.json({reply});
}

// ===== রোলিং ইন্সপেকশন (HTML - ছোট সাইজ) =====
if(q.includes("rolling") && (q.includes("inspection") || q.includes("ins"))){

    const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);
    if(!monthMatch)
        return res.json({reply:`${formatHeader("Error")}\n\nPlease specify month (e.g., feb rolling inspection)`});

    const monthName = monthMatch[1];
    const monthIndex = moment().month(monthName).month();

    let sillMap = {};

    roll.forEach(r=>{
        const date = normalizeSheetDate(r[0]);
        const m = moment(date,"DD-MMM-YYYY",true);
        if(!m.isValid() || m.month() !== monthIndex) return;

        const sill = (r[1]||"").trim();
        const rollingVal = parseFloat((r[7]||"").replace(/,/g,'')) || 0;
        if(!sill || rollingVal <= 0) return;

        if(!sillMap[sill]) sillMap[sill] = 0;
        sillMap[sill] += rollingVal;
    });

    let rows = [];

    Object.keys(sillMap).forEach(sill=>{
        const gRow = grey.find(gr=>(gr[2]||"").trim()===sill);
        if(!gRow) return;

        const party = gRow[3] || "Unknown";
        const lot = parseFloat((gRow[6]||"").replace(/,/g,'')) || 0;
        const rollingTotal = sillMap[sill];
        const diff = rollingTotal - lot;
        const percent = lot>0 ? ((diff/lot)*100) : 0;

        rows.push({sill:Number(sill), party, lot, rollingTotal, diff, percent});
    });

    rows.sort((a,b)=>a.sill - b.sill);

    // ছোট HTML টেবিল - চ্যাটের ভিতরে থাকবে
    let html = `
    <style>
        .ins-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin: 5px 0;
        }
        .ins-table th {
            background: #2d3748;
            color: white;
            padding: 4px;
            font-size: 11px;
        }
        .ins-table td {
            padding: 3px 4px;
            border: 1px solid #cbd5e0;
        }
        .pos { color: #2f855a; font-weight: bold; }
        .neg { color: #c53030; font-weight: bold; }
        .title-small { font-size: 13px; font-weight: bold; margin: 2px 0; }
    </style>

    <div class="title-small">📊 ${monthName.toUpperCase()} ROLLING INSPECTION</div>
    <table class="ins-table">
        <tr><th>Sill</th><th>Party</th><th>Lot</th><th>Roll</th><th>Diff</th><th>%</th></tr>
    `;

    rows.forEach(r => {
        const diffClass = r.diff >= 0 ? 'pos' : 'neg';
        const diffSign = r.diff >= 0 ? '+' : '';
        
        html += `
        <tr>
            <td><b>${r.sill}</b></td>
            <td style="text-align:left">${r.party.substring(0,12)}</td>
            <td>${r.lot.toLocaleString()}</td>
            <td>${r.rollingTotal.toLocaleString()}</td>
            <td class="${diffClass}">${diffSign}${r.diff.toLocaleString()}</td>
            <td class="${diffClass}">${r.percent.toFixed(1)}%</td>
        </tr>
        `;
    });

    html += `</table>`;

    return res.json({reply: html});
}

// ===== সেকশন হিস্ট্রি =====
const secDetect=(q)=>{
if(/cpb/.test(q)) return "cpb";
if(/\bjet\b/.test(q)) return "jet";
if(/jig|jiger|jigger|jg/.test(q)) return "jigger";
if(/roll/.test(q)) return "rolling";
if(/sing/.test(q)) return "singing";
if(/mar|merc/.test(q)) return "marcerise";
return null;
};

const sectionKey=secDetect(q);

if(sectionKey){

const sectionMap={
singing:sing,
marcerise:marc,
cpb:cpb,
jet:jet,
jigger:jig,
rolling:roll
};

const rows=sectionMap[sectionKey];
let sMatch=q.match(/\b\d{3,4}\b/);

if(sMatch){

let sill=sMatch[0];
let g=grey.find(r=>(r[2]||"").trim()===sill);
let party=g?g[3]:"Unknown";

let total=0,lines=[];

rows.forEach(r=>{
if((r[1]||"").trim()===sill){

let date=normalizeSheetDate(r[0]);
let vIdx=(sectionKey==="singing"||sectionKey==="marcerise")?8:(sectionKey==="jet"||sectionKey==="cpb"?6:7);
let val=parseFloat((r[vIdx]||"").replace(/,/g,''))||0;
if(val<=0) return;

lines.push(`🔹 ${date} — ${formatNumber(val)}`);
total+=val;
}
});

if(lines.length){
let reply = `${formatHeader(`${sectionKey} - Sill ${sill}`)}\n\n`;
reply += `👤 ${party}\n\n`;
reply += lines.join("\n");
reply += `\n\n━━━━━━━━━━━━━━━━\n📍 Total: ${formatNumber(total)}`;
return res.json({reply});
}
}

}

// ===== পার ডে রিপোর্ট =====
if(q.includes("per day")){

    const sectionMap = {
        singing: {rows: sing, idx: 8, name: "Sing"},
        marcerise: {rows: marc, idx: 8, name: "Marc"},
        cpb: {rows: cpb, idx: 6, name: "CPB"},
        jet: {rows: jet, idx: 6, name: "Jet"},
        jigger: {rows: jig, idx: 7, name: "Jig"},
        rolling: {rows: roll, idx: 7, name: "Roll"}
    };

    const sectionKey = Object.keys(sectionMap).find(s => q.includes(s));
    const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);

    if(sectionKey){

        const {rows, idx, name} = sectionMap[sectionKey];
        let dayMap = {};
        let monthIndex = null;

        if(monthMatch){
            monthIndex = moment().month(monthMatch[1]).month();
        }

        rows.forEach(r=>{
            const date = normalizeSheetDate(r[0]);
            const m = moment(date,"DD-MMM-YYYY",true);
            const val = parseFloat((r[idx]||"").replace(/,/g,'')) || 0;

            if(!m.isValid() || val <= 0) return;
            if(monthIndex !== null && m.month() !== monthIndex) return;

            const formattedDate = m.format("DD-MMM-YYYY");
            if(!dayMap[formattedDate]) dayMap[formattedDate] = 0;
            dayMap[formattedDate] += val;
        });

        const sortedDates = Object.keys(dayMap)
            .sort((a,b)=>moment(a,"DD-MMM-YYYY") - moment(b,"DD-MMM-YYYY"));

        if(!sortedDates.length)
            return res.json({reply:`${formatHeader("No Data")}\n\nNo data for this month.`});

        let total = 0;
        let titleMonth = monthMatch ? monthMatch[1].toUpperCase()+" " : "";

        let reply = `${formatHeader(`${titleMonth}${name} Per Day`)}\n\n`;

        sortedDates.forEach((d,i)=>{
            total += dayMap[d];
            reply += `${i+1}. ${d} — ${formatNumber(dayMap[d])}\n`;
        });

        reply += `\n━━━━━━━━━━━━━━━━\n📊 Total: ${formatNumber(total)}`;

        return res.json({reply});
    }
}

// ===== ফাইনাল =====
res.json({reply:`${formatHeader("ERP Search")}\n\nTry:\n🔹 590\n🔹 3 feb cpb\n🔹 RB Design\n🔹 feb dyeing\n🔹 12345 (lot)\n🔹 total dyeing\n🔹 feb rolling inspection`});

});

module.exports = router;
