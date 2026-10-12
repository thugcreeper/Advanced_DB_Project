import { districts } from "../../shared/data/districts.js";
import { examples } from "./examples.js";
import { initializeEditor } from "./editor.js";
import { initializeFilters } from "./filters.js";
import { initializeModes } from "./modes.js";
import { initializeMap } from "./map.js";
import { initializeResults } from "./results.js";

const get = (id) => document.getElementById(id);
const map = initializeMap({ container: get("map"), status: get("mapStatus"), homeButton: get("resetMap"), count: get("markerCount") });
const results = initializeResults({ body: get("resultRows"), count: get("resultCount"), empty: get("resultsEmpty"), download: get("downloadCsv"), sortButtons: [...document.querySelectorAll("[data-sort]")], onSort: (rows) => map.update(rows, { fit: false }) });
function showResults(rows, source, fit = true) {
  const displayedRows = results.update(rows); map.update(displayedRows, { fit });
  get("queryModeLabel").textContent = `${source}・示範資料`;
}
initializeModes({ tabs: [...document.querySelectorAll(".mode-tab")], panes: [...document.querySelectorAll(".mode-pane")] });
initializeEditor({ input: get("cypherInput"), clearButton: get("clearCypher"), form: get("cypherPane"), status: get("cypherStatus"), exampleSelect: get("exampleQuery"), onExecute: (example) => showResults(districts.filter(example.matches), `Cypher：${example.label}`) });
initializeFilters({ form: get("builderPane"), county: get("county"), minIncome: get("minIncome"), maxHospitals: get("maxHospitals"), minClinics: get("minClinics"), districts, onExecute: (rows) => showResults(rows, "條件篩選") });
get("aboutButton").addEventListener("click", () => get("aboutDialog").showModal());
showResults(districts.filter(examples[0].matches), `Cypher：${examples[0].label}`, false);
