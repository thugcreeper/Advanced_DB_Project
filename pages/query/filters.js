export function initializeFilters({ form, county, minIncome, maxHospitals, minClinics, districts, onExecute }) {
  [...new Set(districts.map((d) => d.county))].forEach((name) => {
    const option = document.createElement("option"); option.value = name; option.textContent = name; county.append(option);
  });
  function execute() {
    if (!form.reportValidity()) return;
    const rows = districts.filter((d) =>
      (!county.value || d.county === county.value) &&
      (minIncome.value === "" || d.averageIncome >= Number(minIncome.value)) &&
      (maxHospitals.value === "" || d.hospitalCount <= Number(maxHospitals.value)) &&
      (minClinics.value === "" || d.clinicCount >= Number(minClinics.value))
    );
    onExecute(rows);
  }
  form.addEventListener("submit", (event) => { event.preventDefault(); execute(); });
  // Run after the browser's native reset has restored all control values.
  form.addEventListener("reset", (event) => { setTimeout(() => { if (!event.defaultPrevented) execute(); }, 0); });
  return { execute };
}
