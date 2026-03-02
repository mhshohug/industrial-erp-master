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

// NEW: total / totall detect
const isTotalQuery = /\btotall?\b/.test(q);

// NEW: smart month map (short + full)
const monthMap = {
    jan:0, january:0,
    feb:1, february:1,
    mar:2, march:2,
    apr:3, april:3,
    may:4,
    jun:5, june:5,
    jul:6, july:6,
    aug:7, august:7,
    sep:8, september:8,
    oct:9, october:9,
    nov:10, november:10,
    dec:11, december:11
};

const sheets=await Promise.all(Object.values(GID_MAP).map(fetchSheet));
const [grey,sing,marc,cpb,jet,jig,roll]=sheets;

const getRollingBySill=(sill)=>{
return roll.reduce((a,r)=>(
(r[1]||"").trim()===sill
? a+(parseFloat((r[7]||"").replace(/,/g,''))||0)
: a
),0);
};

// ================= SMART PARTY SEARCH =================
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
        let last15=rows.slice(-15);

        let reply=`🏷️ Party: ${bestMatch.toUpperCase()}
━━━━━━━━━━━━━━━━\n`;

        last15.forEach(r=>{
            let lot=parseFloat((r[6]||"").replace(/,/g,''))||0;
            let rolling=getRollingBySill((r[2]||"").trim());
            let diff=rolling-lot;

            let status=diff>=0
            ? `Extra ${Math.abs(diff).toLocaleString()}`
            : `Short ${Math.abs(diff).toLocaleString()}`;

            reply+=`🔹 Sill ${r[2]} | ${r[4]} | Lot ${lot.toLocaleString()} | Roll ${rolling.toLocaleString()} | ${status} yds\n`;
        });

        reply+=`\n📊 Showing ${last15.length} of ${rows.length} entries`;
        return res.json({reply});
    }
}
   /* ================= ORIGINAL CODE CONTINUES ================= */

// ===== DATE SEARCH =====
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
    details.push(`🔹 Sill ${s} | ${d.party} | Lot ${d.lot.toLocaleString()} | ${d.val.toLocaleString()} yds`);
    total+=d.val;
});

if(details.length)
return res.json({reply:`📅 **${targetKey.toUpperCase()} - ${dateInput}**
━━━━━━━━━━━━━━━━
${details.join("\n")}

📍 **Total: ${total.toLocaleString()} yds**`});

return res.json({reply:`📅 ${dateInput} এ ${targetKey} সেকশনে কোনো ডাটা পাওয়া যায়নি।`});
}

// daily summary
const dSum=(rows,idx)=>rows.reduce((acc,r)=>
normalizeSheetDate(r[0])===normalizeSheetDate(dateInput)
?acc+(parseFloat((r[idx]||"").replace(/,/g,''))||0)
:acc,0);

const cVal=dSum(cpb,6),jVal=dSum(jet,6),jgVal=dSum(jig,7);

return res.json({reply:`📅 **Daily Summary: ${dateInput}**
━━━━━━━━━━━━━━━━
🔹 Singing: ${dSum(sing,8).toLocaleString()} yds
🔹 Marcerise: ${dSum(marc,8).toLocaleString()} yds
🔹 CPB: ${cVal.toLocaleString()} yds
🔹 Jet: ${jVal.toLocaleString()} yds
🔹 Jigger: ${jgVal.toLocaleString()} yds
📍 **Total Dyeing: ${(cVal+jVal+jgVal).toLocaleString()} yds
✅ Rolling: ${dSum(roll,7).toLocaleString()} yds`});
}


// ===== SILL REPORT =====
let sMatch=q.match(/(\d+)/);
if(sMatch && !q.includes("total")){

const sill=sMatch[1];
const gRow=grey.find(r=>(r[2]||"").trim()===sill);
if(!gRow) return res.json({reply:`Sill ${sill} পাওয়া যায়নি ওস্তাদ।`});

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
const diff=lotSize-data.roll;

return res.json({reply:`📊 **Report: Sill ${sill}**
━━━━━━━━━━━━━━━━
👤 Party: ${gRow[3]}
📜 Quality: ${gRow[4]}
📦 Lot Size: ${lotSize.toLocaleString()} yds

⚙️ Process Details:
🔹 Singing: ${data.sing.toLocaleString()} yds
🔹 Marcerise: ${data.marc.toLocaleString()} yds

🎨 Dyeing Section:
🔹 CPB: ${data.cpb.toLocaleString()} yds
🔹 Jet: ${data.jet.toLocaleString()} yds
🔹 Jigger: ${data.jig.toLocaleString()} yds
📍 Total Dyeing: ${(data.cpb+data.jet+data.jig).toLocaleString()} yds

✅ Rolling: ${data.roll.toLocaleString()} yds
━━━━━━━━━━━━━━━━
📊 ${diff<=0?"Extra":"Short"}: ${Math.abs(diff).toLocaleString()} yds`});
}
// ===== LOT SEARCH =====
let lotMatch = q.match(/lot\s*(\d+)/) || q.match(/^\d{4,6}$/);

if(lotMatch && !q.includes("sill")){

    const lotNumber = lotMatch[1] || lotMatch[0];

    const gRow = grey.find(r =>
        (r[6]||"").replace(/,/g,'').trim() === lotNumber
    );

    if(!gRow)
        return res.json({reply:`Lot ${lotNumber} পাওয়া যায়নি ওস্তাদ।`});

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

    return res.json({
        reply:`📦 LOT REPORT: ${lotNumber}
━━━━━━━━━━━━━━━━
🏷️ Party: ${party}
🔹 Sill: ${sill}
📜 Quality: ${quality}
📦 Lot Size: ${lotSize.toLocaleString()} yds
✅ Rolling: ${rolling.toLocaleString()} yds
📊 ${diff>=0?"Extra":"Short"}: ${Math.abs(diff).toLocaleString()} yds`
    });
}
// ===== SMART MONTH + DYEING (e.g. feb dyeing / march dyeing) =====

const monthOnlyMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);

if(monthOnlyMatch && q.includes("dyeing")){

    const monthName = monthOnlyMatch[1];
    const monthIndex = moment().month(monthName).month(); // 0-11

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
        return res.json({reply:`📅 ${monthName.toUpperCase()} মাসে কোনো Dyeing ডাটা পাওয়া যায়নি ওস্তাদ।`});
    }

    return res.json({
        reply:`🎨 **${monthName.toUpperCase()} Dyeing Report**
━━━━━━━━━━━━━━━━
🔹 CPB: ${cpbTotal.toLocaleString()} yds
🔹 Jet: ${jetTotal.toLocaleString()} yds
🔹 Jigger: ${jiggerTotal.toLocaleString()} yds
━━━━━━━━━━━━━━━━
📍 **Total Dyeing: ${grandTotal.toLocaleString()} yds**`
    });
}
// ===== OLD MONTHLY NAME SEARCH (তোমার পুরাতনটা থাকবে) =====
const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);

if(monthMatch && q.includes("total")){

    const monthName = monthMatch[1];
    const monthIndex = moment().month(monthName).month();

    const filterByMonth=(rows,idx)=>
    rows.reduce((acc,r)=>{
        const d=normalizeSheetDate(r[0]);
        const m=moment(d,"DD-MMM-YYYY",true);
        if(m.isValid()&&m.month()===monthIndex)
            return acc+(parseFloat((r[idx]||"").replace(/,/g,''))||0);
        return acc;
    },0);

    const totals={
        s:filterByMonth(sing,8),
        m:filterByMonth(marc,8),
        c:filterByMonth(cpb,6),
        j:filterByMonth(jet,6),
        jg:filterByMonth(jig,7),
        r:filterByMonth(roll,7)
    };

    if(q.includes("dyeing")){
        return res.json({reply:`📅 ${monthName.toUpperCase()} Dyeing Report
━━━━━━━━━━━━━━━━
🔹 CPB: ${totals.c.toLocaleString()} yds
🔹 Jet: ${totals.j.toLocaleString()} yds
🔹 Jigger: ${totals.jg.toLocaleString()} yds
📍 Total Dyeing: ${(totals.c+totals.j+totals.jg).toLocaleString()} yds`});
    }

    return res.json({reply:`📅 ${monthName.toUpperCase()} Monthly Report
━━━━━━━━━━━━━━━━
🔹 Singing: ${totals.s.toLocaleString()} yds
🔹 Marcerise: ${totals.m.toLocaleString()} yds
🔹 CPB: ${totals.c.toLocaleString()} yds
🔹 Jet: ${totals.j.toLocaleString()} yds
🔹 Jigger: ${totals.jg.toLocaleString()} yds
✅ Total Rolling: ${totals.r.toLocaleString()} yds`});
}


// ===== UNIVERSAL PER DAY REPORT (SMART MONTH SUPPORT) =====

if(q.includes("per day")){

    const sectionMap = {
        singing: {rows: sing, idx: 8},
        marcerise: {rows: marc, idx: 8},
        cpb: {rows: cpb, idx: 6},
        jet: {rows: jet, idx: 6},
        jigger: {rows: jig, idx: 7},
        rolling: {rows: roll, idx: 7}
    };

    const sectionKey = Object.keys(sectionMap).find(s => q.includes(s));
    const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);

    if(sectionKey){

        const {rows, idx} = sectionMap[sectionKey];

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

            // যদি মাস দেওয়া থাকে তাহলে শুধু ওই মাস ফিল্টার হবে
            if(monthIndex !== null && m.month() !== monthIndex) return;

            const formattedDate = m.format("DD-MMM-YYYY");

            if(!dayMap[formattedDate]) dayMap[formattedDate] = 0;

            dayMap[formattedDate] += val;
        });

        const sortedDates = Object.keys(dayMap)
            .sort((a,b)=>moment(a,"DD-MMM-YYYY") - moment(b,"DD-MMM-YYYY"));

        if(!sortedDates.length)
            return res.json({reply:`ডাটা পাওয়া যায়নি ওস্তাদ।`});

        let total = 0;
        let titleMonth = monthMatch ? monthMatch[1].toUpperCase()+" " : "";

        let reply = `📅 ${titleMonth}${sectionKey.toUpperCase()} Per Day Report\n━━━━━━━━━━━━━━━━\n`;

        sortedDates.forEach((d,i)=>{
            total += dayMap[d];
            reply += `${i+1}. ${d} — ${dayMap[d].toLocaleString()} yds\n`;
        });

        reply += `\n📊 Total: ${total.toLocaleString()} yds`;

        return res.json({reply});
    }
}

     // ===== NEW GRAND TOTAL / MONTHLY BREAKDOWN =====
if(isTotalQuery){

    // ===== If totall dyeing → month wise breakdown =====
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
            return res.json({reply:"কোনো Dyeing ডাটা পাওয়া যায়নি।"});

        let reply = "🌍 Dyeing Monthly Breakdown\n━━━━━━━━━━━━━━━━\n";

        sortedMonths.forEach(m=>{
            const data = monthData[m];
            const total = data.cpb + data.jet + data.jigger;

            reply += `\n📅 ${m}
   🔹 CPB: ${data.cpb.toLocaleString()} yds
   🔹 Jet: ${data.jet.toLocaleString()} yds
   🔹 Jigger: ${data.jigger.toLocaleString()} yds
   📍 Total: ${total.toLocaleString()} yds\n`;
        });

        return res.json({reply});
    }

    // ===== Full Grand Total =====
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

    return res.json({
        reply:`🌍 Monthly Grand Total
━━━━━━━━━━━━━━━━
🔹 Singing: ${t.s.toLocaleString()} yds
🔹 Marcerise: ${t.m.toLocaleString()} yds
🔹 CPB: ${t.c.toLocaleString()} yds
🔹 Jet: ${t.j.toLocaleString()} yds
🔹 Jigger: ${t.jg.toLocaleString()} yds
✅ Total Rolling: ${t.r.toLocaleString()} yds`
    });
}
// ===== MONTH ROLLING INSPECTION (PRO GRID VERSION) =====

if(q.includes("rolling") && (q.includes("inspection") || q.includes("ins"))){

    const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);
    if(!monthMatch)
        return res.json({reply:"মাস লিখতে হবে (e.g. feb rolling inspection)"});

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

    // 🔹 Sort by Sill number ascending
    rows.sort((a,b)=>a.sill - b.sill);

    let html = `
    <h3 style="text-align:center;margin-bottom:10px;">
        ${monthName.toUpperCase()} ROLLING INSPECTION
    </h3>

    <table style="
        width:100%;
        border-collapse:collapse;
        font-size:14px;
        text-align:center;
    ">
        <thead>
            <tr style="background:#f2f2f2;font-weight:bold;">
                <th style="border:1px solid #000;padding:6px;">%</th>
                <th style="border:1px solid #000;padding:6px;">Sill</th>
                <th style="border:1px solid #000;padding:6px;">Party</th>
                <th style="border:1px solid #000;padding:6px;">Lot</th>
                <th style="border:1px solid #000;padding:6px;">Rolling</th>
                <th style="border:1px solid #000;padding:6px;">Diff</th>
            </tr>
        </thead>
        <tbody>
    `;

    rows.forEach(r=>{

        const isLoss = r.diff < 0;
        const color = isLoss ? "red" : "green";

        html += `
        <tr>
            <td style="border:1px solid #000;padding:6px;color:${color};font-weight:bold;">
                ${r.percent.toFixed(2)}%
            </td>
            <td style="border:1px solid #000;padding:6px;">
                ${r.sill}
            </td>
            <td style="border:1px solid #000;padding:6px;text-align:left;">
                ${r.party}
            </td>
            <td style="border:1px solid #000;padding:6px;">
                ${r.lot.toLocaleString()}
            </td>
            <td style="border:1px solid #000;padding:6px;">
                ${r.rollingTotal.toLocaleString()}
            </td>
            <td style="border:1px solid #000;padding:6px;color:${color};font-weight:bold;">
                ${r.diff>=0?"+":""}${r.diff.toLocaleString()}
            </td>
        </tr>
        `;
    });

    html += `
        </tbody>
    </table>
    `;

    return res.json({reply: html});
}

// ===== SMART DIRECT SEARCH (Original) =====
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

lines.push(`🔹 ${date} | ${val.toLocaleString()} yds`);
total+=val;
}
});

if(lines.length)
return res.json({reply:`📊 ${sectionKey.toUpperCase()} History — Sill ${sill}
━━━━━━━━━━━━━━━━
${lines.join("\n")}

📍 Total ${sectionKey.toUpperCase()}: ${total.toLocaleString()} yds`});
}

}


// ===== FINAL FALLBACK =====
res.json({reply:"Sill নম্বর বা তারিখ (e.g. 3 feb jet / kal cpb) লিখে সার্চ দিন ওস্তাদ!"});

});

module.exports = router;       
