
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
   PART 3 – ROUTER START + FORMATTERS
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


  /* ===================== FORMATTERS ===================== */

  function formatPerDay(proc,data){

    const today=new Date();
    const monthName=today.toLocaleString("default",{month:"long"});
    const year=today.getFullYear();

    const lines=data.days.map(d=>
      `${String(d.day).padStart(2,"0")} ${monthName.slice(0,3)} : ${d.qty.toLocaleString()} yds`
    ).join("\n");

    return `
${proc.toUpperCase()} DAILY PRODUCTION
Month: ${monthName} ${year}
----------------------------------
${lines}
----------------------------------
Highest: ${data.highest.toLocaleString()} yds
Lowest : ${data.lowest.toLocaleString()} yds
----------------------------------
TOTAL  : ${data.total.toLocaleString()} yds
`;
  }


  function formatFactorySummary(data){
    return `
FACTORY SUMMARY
----------------------------------
PROCESS
Singing   : ${data.process.s.toLocaleString()}
Mercerise : ${data.process.m.toLocaleString()}
Bleach    : ${data.process.b.toLocaleString()}

DYEING
CPB       : ${data.dyeing.c.toLocaleString()}
Jigger    : ${data.dyeing.j.toLocaleString()}
Ex-Jigger : ${data.dyeing.ex.toLocaleString()}
Napthol   : ${data.dyeing.n.toLocaleString()}

Folding   : ${data.folding.toLocaleString()}
----------------------------------
TOTAL DYEING : ${data.dyeTotal.toLocaleString()} yds
`;
  }


  function formatDateReport(data){
    return `
DAILY REPORT
----------------------------------
PROCESS
Singing   : ${data.process.s.toLocaleString()}
Mercerise : ${data.process.m.toLocaleString()}
Bleach    : ${data.process.b.toLocaleString()}

DYEING
CPB       : ${data.dyeing.c.toLocaleString()}
Jigger    : ${data.dyeing.j.toLocaleString()}
Ex-Jigger : ${data.dyeing.ex.toLocaleString()}
Napthol   : ${data.dyeing.n.toLocaleString()}

Folding   : ${data.folding.toLocaleString()}
----------------------------------
TOTAL : ${data.total.toLocaleString()} yds
`;
  }


  function formatPartySummary(data){

    const {reports,totalCount,totalLot,totalDye}=data;

    const completion= totalLot>0
      ? ((totalDye/totalLot)*100).toFixed(1)
      : 0;

    const blocks=reports.map(r=>`
Sill : ${r.sill}
Quality : ${r.quality}
Lot : ${r.lot.toLocaleString()}
Dye : ${r.dyeTotal.toLocaleString()}
Status : ${r.lot-r.dyeTotal<=0?"EXTRA":"SHORT"}
`).join("\n-----------------------------\n");

    return `
PARTY REPORT
Showing ${reports.length} of ${totalCount}
----------------------------------
${blocks}
----------------------------------
TOTAL LOT  : ${totalLot.toLocaleString()}
TOTAL DYE  : ${totalDye.toLocaleString()}
COMPLETION : ${completion} %
`;
  }


  function formatSillReport(reports){

    const blocks=reports.map(r=>`
Sill : ${r.sill}
Party : ${r.party}
Quality : ${r.quality}
Lot : ${r.lot.toLocaleString()}

PROCESS
Singing   : ${r.process.s.toLocaleString()}
Mercerise : ${r.process.m.toLocaleString()}
Bleach    : ${r.process.b.toLocaleString()}

DYEING
CPB       : ${r.dyeing.c.toLocaleString()}
Jigger    : ${r.dyeing.j.toLocaleString()}
Ex-Jigger : ${r.dyeing.ex.toLocaleString()}
Napthol   : ${r.dyeing.n.toLocaleString()}

Folding : ${r.folding.toLocaleString()}
Total Dye : ${r.dyeTotal.toLocaleString()}
Status : ${r.diff<=0?"EXTRA":"SHORT"}
`).join("\n=================================\n");

    return `
SILL PRODUCTION REPORT
=================================
${blocks}
=================================
`;
  }
/* ===================== HELP ===================== */

  if(cleanInput==="help"){
    return res.json({
      reply:`
Available Commands:
cpb per day
jigger per day
napthol per day
total dyeing
totall
15 feb
15 feb cpb
12345
noor
noor cpb
`
    });
  }


  /* ===================== PER DAY ===================== */

  const perDayMatch=question.match(/(cpb|jigger|ex-jigger|exjigger|napthol|singing|marcerise|bleach|folding)\s*per\s*day/);

  if(perDayMatch){
    const proc=perDayMatch[1]
      .replace("exjigger","ex_jigger")
      .replace("ex-jigger","ex_jigger");

    const data=getMonthlyPerDay(db,proc);
    return res.json({reply:formatPerDay(proc,data)});
  }


  /* ===================== TOTAL DYEING ===================== */

  if(cleanInput==="totaldyeing"||cleanInput==="total dyeing"){
    const c=getProcessSum(db,"cpb");
    const j=getProcessSum(db,"jigger");
    const ex=getProcessSum(db,"ex_jigger");
    const n=getProcessSum(db,"napthol");

    return res.json({
      reply:`
TOTAL DYEING
----------------------------------
CPB       : ${c.toLocaleString()}
Jigger    : ${j.toLocaleString()}
Ex-Jigger : ${ex.toLocaleString()}
Napthol   : ${n.toLocaleString()}
----------------------------------
TOTAL     : ${(c+j+ex+n).toLocaleString()} yds
`
    });
  }


  /* ===================== FACTORY SUMMARY ===================== */

  if(cleanInput==="totall"){
    const data=getFactoryTotals(db);
    return res.json({reply:formatFactorySummary(data)});
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
      return res.json({reply:"No production on this date."});

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

    const list=Object.entries(combined)
      .map(([sill,data])=>
        `${sill} | ${data.party} : ${data.qty.toLocaleString()} yds`
      ).join("\n");

    const total=rows.reduce((t,r)=>t+safeNumber(r[6]),0);

    return res.json({
      reply:`
DATE : ${dateObj.toDateString()}
PROCESS : ${proc.toUpperCase()}
----------------------------------
${list}
----------------------------------
TOTAL : ${total.toLocaleString()} yds
`
    });
  }


  /* ===================== DATE ONLY ===================== */

  if(dateObj){
    const data=getDateReport(db,dateObj);
    return res.json({reply:formatDateReport(data)});
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
      reply:`
${monthMatch[1].toUpperCase()} DYEING SUMMARY
----------------------------------
CPB       : ${dyeing.c.toLocaleString()}
Jigger    : ${dyeing.j.toLocaleString()}
Ex-Jigger : ${dyeing.ex.toLocaleString()}
Napthol   : ${dyeing.n.toLocaleString()}
----------------------------------
TOTAL     : ${dyeTotal.toLocaleString()} yds
`
    });
  }

  if(section === "process"){
    return res.json({
      reply:`
${monthMatch[1].toUpperCase()} PROCESS SUMMARY
----------------------------------
Singing   : ${process.s.toLocaleString()}
Mercerise : ${process.m.toLocaleString()}
Bleach    : ${process.b.toLocaleString()}
`
    });
  }

  if(section === "folding"){
    return res.json({
      reply:`
${monthMatch[1].toUpperCase()} FOLDING
----------------------------------
Total Folding : ${folding.toLocaleString()} yds
`
    });
  }

  // Default Full Report
  return res.json({
    reply:`
MONTHLY FACTORY SUMMARY (${monthMatch[1].toUpperCase()})
----------------------------------
PROCESS
Singing   : ${process.s.toLocaleString()}
Mercerise : ${process.m.toLocaleString()}
Bleach    : ${process.b.toLocaleString()}

DYEING
CPB       : ${dyeing.c.toLocaleString()}
Jigger    : ${dyeing.j.toLocaleString()}
Ex-Jigger : ${dyeing.ex.toLocaleString()}
Napthol   : ${dyeing.n.toLocaleString()}

Folding   : ${folding.toLocaleString()}
----------------------------------
TOTAL DYEING : ${dyeTotal.toLocaleString()} yds
`
  });

}

  /* ===================== SILL SEARCH ===================== */

  const numMatch=question.match(/(\d{3,})/);
  if(numMatch){
    const reports=getSillReport(db,normalizeSill(numMatch[1]));
    if(reports)
      return res.json({reply:formatSillReport(reports)});
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
      return res.json({reply:"Party not found."});

    let total=0;
    let lines=[];

    greyRows.forEach(row=>{
      const sill=normalizeSill(row[1]);

      const qty=db[proc]?.slice(1).reduce((t,r)=>
        normalizeSill(r[1])===sill ? t+safeNumber(r[6]) : t
      ,0)||0;

      if(qty>0){
        total+=qty;
        lines.push(`${sill} : ${qty.toLocaleString()} yds`);
      }
    });

    return res.json({
      reply:`
Party : ${partyName.toUpperCase()}
Process : ${proc.toUpperCase()}
----------------------------------
${lines.join("\n")}
----------------------------------
TOTAL : ${total.toLocaleString()} yds
`
    });
  }


  /* ===================== PARTY SUMMARY ===================== */

  const partyData = getPartyFullSummary(db, question);
  if (partyData)
    return res.json({ reply: formatPartySummary(partyData) });

  return res.json({
    reply: "Command not recognized. Type help."
  });
});   // ← router.post("/ask") এর closing bracket

module.exports = router;
