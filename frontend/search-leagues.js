// search-leagues.js
import fs from "fs";

const leagues = JSON.parse(fs.readFileSync("./leagues.json", "utf-8"));

// Burada aramak istediğin kelimeleri gir
const queries = ["Euro", "Austria"];

for (const q of queries) {
  console.log(`\n=== Results for: ${q} ===`);
  const found = leagues.filter(l =>
    (l.name && l.name.toLowerCase().includes(q.toLowerCase())) ||
    (l.country && l.country.toLowerCase().includes(q.toLowerCase()))
  );
  if (found.length === 0) {
    console.log("No matches found.");
  } else {
    found.forEach(l => {
      console.log(`${l.id} | ${l.name} | ${l.country}`);
    });
  }
}