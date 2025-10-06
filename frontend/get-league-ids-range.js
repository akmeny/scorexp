// Node 18+ (yerleşik fetch)
// Kullanım: node get-league-ids-range.js 2025-06-01 2025-07-15
import fs from "fs";

const [,, startArg, endArg] = process.argv;
const start = startArg || "2025-06-01";
const end   = endArg   || "2025-07-15";

const URL = `http://localhost:3001/api/league-ids-from-range?start=${start}&end=${end}`;

try {
  const res = await fetch(URL);
  if (!res.ok) {
    console.error("HTTP", res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  const lines = (data?.leagues || []).map(l => `${l.id} ${l.name}`).join("\n");

  console.log("📌 Lig ID listesi:\n");
  console.log(lines);
  fs.writeFileSync("./leagues.json", JSON.stringify(data?.leagues || [], null, 2));
  console.log("\n✅ leagues.json dosyasına yazıldı.");
} catch (e) {
  console.error("Hata:", e?.message || e);
  process.exit(1);
}