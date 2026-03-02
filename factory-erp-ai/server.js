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

// Utility functions for beautiful formatting
const formatHeader = (title) => {
    const line = "━".repeat(40);
    return `${line}\n   📌 ${title}\n${line}`;
};

const formatNumber = (num) => {
    return (num || 0).toLocaleString('en-IN');
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

const monthMap = {
    jan:0, january:0, feb:1, february:1, mar:2, march:2,
    apr:3, april:3, may:4, jun:5, june:5, jul:6, july:6,
    aug:7, august:7, sep:8, september:8, oct:9, october:9,
    nov:10, november:10, dec:11, december:11
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

        let reply = `${formatHeader(bestMatch.toUpperCase())}\n\n`;

        last15.forEach(r=>{
            let lot=parseFloat((r[6]||"").replace(/,/g,''))||0;
            let rolling=getRollingBySill((r[2]||"").trim());
            let diff=rolling-lot;

            reply += `🔹 Sill ${r[2]} | ${r[4]}\n`;
            reply += `   📦 Lot: ${formatNumber(lot)} yds\n`;
            reply += `   ✅ Roll: ${formatNumber(rolling)} yds\n`;
            reply += `   📊 ${formatStatus(diff)}\n\n`;
        });

        reply += `━━━━━━━━━━━━━━━━━━━━━━\n📊 মোট ${rows.length} এর মধ্যে সর্বশেষ ${last15.length} টি দেখানো হচ্ছে`;

        return res.json({reply});
    }
}

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
    details.push(`🔹 Sill ${s} | ${d.party}\n   📦 Lot: ${formatNumber(d.lot)} yds\n   🎨 ${targetKey.toUpperCase()}: ${formatNumber(d.val)} yds`);
    total+=d.val;
});

if(details.length){
let reply = `${formatHeader(`${targetKey.toUpperCase()} - ${dateInput}`)}\n\n`;
reply += details.join("\n\n");
reply += `\n\n━━━━━━━━━━━━━━━━━━━━━━\n📍 **মোট ${targetKey.toUpperCase()}: ${formatNumber(total)} yds**`;
return res.json({reply});
}

return res.json({reply:`${formatHeader("তথ্য পাওয়া যায়নি")}\n\n📅 ${dateInput} তারিখে ${targetKey} সেকশনে কোনো ডাটা পাওয়া যায়নি।`});
}

// daily summary
const dSum=(rows,idx)=>rows.reduce((acc,r)=>
normalizeSheetDate(r[0])===normalizeSheetDate(dateInput)
?acc+(parseFloat((r[idx]||"").replace(/,/g,''))||0)
:acc,0);

const cVal=dSum(cpb,6),jVal=dSum(jet,6),jgVal=dSum(jig,7);
const singingVal = dSum(sing,8);
const marceriseVal = dSum(marc,8);
const rollingVal = dSum(roll,7);
const totalDyeing = cVal + jVal + jgVal;

let reply = `${formatHeader(`📅 দৈনিক রিপোর্ট - ${dateInput}`)}\n\n`;
reply += `🎨 **প্রি-ট্রিটমেন্ট**\n`;
reply += `🔹 সিংগিং: ${formatNumber(singingVal)} yds\n`;
reply += `🔹 মার্সারাইজ: ${formatNumber(marceriseVal)} yds\n\n`;
reply += `🎨 **ডাইং সেকশন**\n`;
reply += `🔹 CPB: ${formatNumber(cVal)} yds\n`;
reply += `🔹 Jet: ${formatNumber(jVal)} yds\n`;
reply += `🔹 Jigger: ${formatNumber(jgVal)} yds\n`;
reply += `━━━━━━━━━━━━━━━━━━━━━━\n`;
reply += `📍 **মোট ডাইং: ${formatNumber(totalDyeing)} yds**\n`;
reply += `✅ **রোলিং: ${formatNumber(rollingVal)} yds**`;

return res.json({reply});
}


// ===== SILL REPORT =====
let sMatch=q.match(/(\d+)/);
if(sMatch && !q.includes("total")){

const sill=sMatch[1];
const gRow=grey.find(r=>(r[2]||"").trim()===sill);
if(!gRow) return res.json({reply:`${formatHeader("তথ্য পাওয়া যায়নি")}\n\n❌ Sill ${sill} নম্বরটি খুঁজে পাওয়া যায়নি।`});

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

let reply = `${formatHeader(`📊 Sill ${sill} রিপোর্ট`)}\n\n`;
reply += `👤 **পার্টি:** ${gRow[3]}\n`;
reply += `📜 **কোয়ালিটি:** ${gRow[4]}\n`;
reply += `📦 **লট সাইজ:** ${formatNumber(lotSize)} yds\n\n`;
reply += `━━━━━━━━━━━━━━━━━━━━━━\n`;
reply += `🎨 **প্রি-ট্রিটমেন্ট**\n`;
reply += `🔹 সিংগিং: ${formatNumber(data.sing)} yds\n`;
reply += `🔹 মার্সারাইজ: ${formatNumber(data.marc)} yds\n\n`;
reply += `🎨 **ডাইং সেকশন**\n`;
reply += `🔹 CPB: ${formatNumber(data.cpb)} yds\n`;
reply += `🔹 Jet: ${formatNumber(data.jet)} yds\n`;
reply += `🔹 Jigger: ${formatNumber(data.jig)} yds\n`;
reply += `━━━━━━━━━━━━━━━━━━━━━━\n`;
reply += `📍 **মোট ডাইং: ${formatNumber(totalDyeing)} yds**\n`;
reply += `✅ **রোলিং: ${formatNumber(data.roll)} yds**\n\n`;
reply += `━━━━━━━━━━━━━━━━━━━━━━\n`;
reply += `📊 ${diff<=0?"✅ এক্সট্রা":"⚠️ শর্টেজ"}: ${formatNumber(Math.abs(diff))} yds`;

return res.json({reply});
}

// ===== LOT SEARCH =====
let lotMatch = q.match(/lot\s*(\d+)/) || q.match(/^\d{4,6}$/);

if(lotMatch && !q.includes("sill")){

    const lotNumber = lotMatch[1] || lotMatch[0];
    const gRow = grey.find(r => (r[6]||"").replace(/,/g,'').trim() === lotNumber);

    if(!gRow)
        return res.json({reply:`${formatHeader("তথ্য পাওয়া যায়নি")}\n\n❌ Lot ${lotNumber} নম্বরটি খুঁজে পাওয়া যায়নি।`});

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

    let reply = `${formatHeader(`📦 লট রিপোর্ট: ${lotNumber}`)}\n\n`;
    reply += `🏷️ **পার্টি:** ${party}\n`;
    reply += `🔹 **সিল নং:** ${sill}\n`;
    reply += `📜 **কোয়ালিটি:** ${quality}\n`;
    reply += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    reply += `📦 **লট সাইজ:** ${formatNumber(lotSize)} yds\n`;
    reply += `✅ **রোলিং:** ${formatNumber(rolling)} yds\n`;
    reply += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    reply += `📊 ${diff>=0?"✅ এক্সট্রা":"⚠️ শর্টেজ"}: ${formatNumber(Math.abs(diff))} yds`;

    return res.json({reply});
}

// ===== MONTHLY DYEING REPORT =====
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
        return res.json({reply:`${formatHeader("তথ্য পাওয়া যায়নি")}\n\n📅 ${monthName.toUpperCase()} মাসে কোনো ডাইং ডাটা পাওয়া যায়নি।`});
    }

    let reply = `${formatHeader(`🎨 ${monthName.toUpperCase()} ডাইং রিপোর্ট`)}\n\n`;
    reply += `🔹 **CPB:** ${formatNumber(cpbTotal)} yds\n`;
    reply += `🔹 **Jet:** ${formatNumber(jetTotal)} yds\n`;
    reply += `🔹 **Jigger:** ${formatNumber(jiggerTotal)} yds\n`;
    reply += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    reply += `📍 **মোট ডাইং: ${formatNumber(grandTotal)} yds**`;

    return res.json({reply});
}

// ===== GRAND TOTAL / MONTHLY BREAKDOWN =====
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
            return res.json({reply:`${formatHeader("তথ্য পাওয়া যায়নি")}\n\nকোনো ডাইং ডাটা পাওয়া যায়নি।`});

        let reply = `${formatHeader("🌍 মাসিক ডাইং ব্রেকডাউন")}\n`;

        sortedMonths.forEach(m=>{
            const data = monthData[m];
            const total = data.cpb + data.jet + data.jigger;

            reply += `\n📅 **${m}**\n`;
            reply += `   🔹 CPB: ${formatNumber(data.cpb)} yds\n`;
            reply += `   🔹 Jet: ${formatNumber(data.jet)} yds\n`;
            reply += `   🔹 Jigger: ${formatNumber(data.jigger)} yds\n`;
            reply += `   📍 **মোট: ${formatNumber(total)} yds**\n`;
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

    let reply = `${formatHeader("🌍 সব মিলিয়ে মোট পরিমাণ")}\n\n`;
    reply += `🎨 **প্রি-ট্রিটমেন্ট**\n`;
    reply += `🔹 সিংগিং: ${formatNumber(t.s)} yds\n`;
    reply += `🔹 মার্সারাইজ: ${formatNumber(t.m)} yds\n\n`;
    reply += `🎨 **ডাইং সেকশন**\n`;
    reply += `🔹 CPB: ${formatNumber(t.c)} yds\n`;
    reply += `🔹 Jet: ${formatNumber(t.j)} yds\n`;
    reply += `🔹 Jigger: ${formatNumber(t.jg)} yds\n`;
    reply += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    reply += `✅ **মোট রোলিং: ${formatNumber(t.r)} yds**`;

    return res.json({reply});
}

// ===== MONTHLY ROLLING INSPECTION =====
if(q.includes("rolling") && (q.includes("inspection") || q.includes("ins"))){

    const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);
    if(!monthMatch)
        return res.json({reply:`${formatHeader("ত্রুটি")}\n\nমাস লিখতে হবে (যেমন: feb rolling inspection)`});

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

    let reply = `${formatHeader(`${monthName.toUpperCase()} রোলিং ইন্সপেকশন`)}\n\n`;

    rows.forEach(r=>{
        const isLoss = r.diff < 0;
        const status = isLoss ? "⚠️" : "✅";
        
        reply += `🔹 **Sill ${r.sill}** | ${r.party}\n`;
        reply += `   📦 লট: ${formatNumber(r.lot)} yds\n`;
        reply += `   ✅ রোল: ${formatNumber(r.rollingTotal)} yds\n`;
        reply += `   ${status} ডিফারেন্স: ${r.diff>=0?"+":""}${formatNumber(r.diff)} yds (${r.percent.toFixed(2)}%)\n\n`;
    });

    return res.json({reply});
}

// ===== SECTION HISTORY =====
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

lines.push(`🔹 ${date} — ${formatNumber(val)} yds`);
total+=val;
}
});

if(lines.length){
let reply = `${formatHeader(`${sectionKey.toUpperCase()} হিস্ট্রি - Sill ${sill}`)}\n\n`;
reply += `👤 **পার্টি:** ${party}\n\n`;
reply += lines.join("\n");
reply += `\n\n━━━━━━━━━━━━━━━━━━━━━━\n📍 **মোট: ${formatNumber(total)} yds**`;
return res.json({reply});
}
}

}

// ===== PER DAY REPORT =====
if(q.includes("per day")){

    const sectionMap = {
        singing: {rows: sing, idx: 8, bn: "সিংগিং"},
        marcerise: {rows: marc, idx: 8, bn: "মার্সারাইজ"},
        cpb: {rows: cpb, idx: 6, bn: "CPB"},
        jet: {rows: jet, idx: 6, bn: "Jet"},
        jigger: {rows: jig, idx: 7, bn: "Jigger"},
        rolling: {rows: roll, idx: 7, bn: "রোলিং"}
    };

    const sectionKey = Object.keys(sectionMap).find(s => q.includes(s));
    const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);

    if(sectionKey){

        const {rows, idx, bn} = sectionMap[sectionKey];
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
            return res.json({reply:`${formatHeader("তথ্য পাওয়া যায়নি")}\n\nএই মাসে কোনো ডাটা নেই।`});

        let total = 0;
        let titleMonth = monthMatch ? monthMatch[1].toUpperCase()+" " : "";

        let reply = `${formatHeader(`📊 ${titleMonth}${bn} পার ডে রিপোর্ট`)}\n\n`;

        sortedDates.forEach((d,i)=>{
            total += dayMap[d];
            reply += `${i+1}. **${d}** — ${formatNumber(dayMap[d])} yds\n`;
        });

        reply += `\n━━━━━━━━━━━━━━━━━━━━━━\n📊 **মোট: ${formatNumber(total)} yds**`;

        return res.json({reply});
    }
}

// ===== FINAL FALLBACK =====
res.json({reply:`${formatHeader("স্বাগতম")}\n\nআপনি যা খুঁজছেন:\n\n` +
`🔹 সিল নং (যেমন: 590)\n` +
`🔹 তারিখ (যেমন: 3 feb cpb)\n` +
`🔹 পার্টির নাম\n` +
`🔹 মাস (যেমন: feb dyeing)\n` +
`🔹 লট নম্বর\n` +
`🔹 total dyeing (মাসিক ব্রেকডাউন)\n` +
`🔹 rolling inspection\n\n` +
`📝 দয়া করে উপরের যেকোনো একটি ফরম্যাটে লিখুন`});

});

module.exports = router;
