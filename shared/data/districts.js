// Fictional statistics and approximate representative coordinates for UI demos.
export const datasetInfo = Object.freeze({
  label: "行政區示範資料",
  incomeUnit: "千元",
  notice: "統計數值為固定虛構資料，非政府統計；座標為行政區概略代表位置，僅供展示。",
});

export const districts = Object.freeze([
  { name: "大安區", county: "臺北市", latitude: 25.026, longitude: 121.543, averageIncome: 1972, hospitalCount: 3, clinicCount: 210, chineseDoctorCount: 45 },
  { name: "信義區", county: "臺北市", latitude: 25.033, longitude: 121.565, averageIncome: 1941, hospitalCount: 2, clinicCount: 165, chineseDoctorCount: 32 },
  { name: "板橋區", county: "新北市", latitude: 25.011, longitude: 121.462, averageIncome: 1602, hospitalCount: 4, clinicCount: 190, chineseDoctorCount: 40 },
  { name: "坪林區", county: "新北市", latitude: 24.935, longitude: 121.711, averageIncome: 920, hospitalCount: 0, clinicCount: 4, chineseDoctorCount: 0 },
  { name: "東區", county: "新竹市", latitude: 24.798, longitude: 120.998, averageIncome: 2186, hospitalCount: 2, clinicCount: 100, chineseDoctorCount: 18 },
  { name: "竹北市", county: "新竹縣", latitude: 24.839, longitude: 121.004, averageIncome: 1985, hospitalCount: 1, clinicCount: 85, chineseDoctorCount: 12 },
  { name: "西屯區", county: "臺中市", latitude: 24.182, longitude: 120.639, averageIncome: 1682, hospitalCount: 3, clinicCount: 145, chineseDoctorCount: 35 },
  { name: "和平區", county: "臺中市", latitude: 24.174, longitude: 120.883, averageIncome: 780, hospitalCount: 0, clinicCount: 6, chineseDoctorCount: 0 },
  { name: "中西區", county: "臺南市", latitude: 22.993, longitude: 120.196, averageIncome: 1280, hospitalCount: 1, clinicCount: 90, chineseDoctorCount: 24 },
  { name: "苓雅區", county: "高雄市", latitude: 22.625, longitude: 120.317, averageIncome: 1420, hospitalCount: 2, clinicCount: 120, chineseDoctorCount: 28 },
  { name: "花蓮市", county: "花蓮縣", latitude: 23.976, longitude: 121.606, averageIncome: 1120, hospitalCount: 2, clinicCount: 65, chineseDoctorCount: 14 },
  { name: "成功鎮", county: "臺東縣", latitude: 23.1, longitude: 121.379, averageIncome: 860, hospitalCount: 1, clinicCount: 8, chineseDoctorCount: 0 },
].map((district) => Object.freeze(district)));
