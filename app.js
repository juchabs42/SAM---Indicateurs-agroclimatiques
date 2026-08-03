const DEFAULT_LOCATION = {
  latitude: 43.6077,
  longitude: 4.0122,
  label: "Bassin de Mauguio — position de démonstration"
};

const state = {
  latitude: null,
  longitude: null,
  label: "",
  hourly: [],
  daily: [],
  charts: {}
};

const chartBase = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: "index" },
  plugins: {
    legend: {
      position: "bottom",
      labels: { usePointStyle: true, boxWidth: 8, padding: 18 }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
    },
    y: {
      beginAtZero: true,
      grid: { color: "rgba(101,114,126,.13)" }
    }
  }
};

function fmt(value, digits = 1) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function dateLabel(iso) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function dayLabel(iso) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(`${iso}T12:00:00`));
}

function vpdClass(vpd) {
  if (!Number.isFinite(vpd)) return "Donnée indisponible";
  if (vpd < 0.8) return "Demande atmosphérique faible";
  if (vpd < 1.5) return "Demande atmosphérique modérée";
  if (vpd < 2.5) return "Demande atmosphérique élevée";
  return "Demande atmosphérique très élevée";
}

function destroyChart(name) {
  if (state.charts[name]) {
    state.charts[name].destroy();
    state.charts[name] = null;
  }
}

function simulateSam(hourly) {
  return hourly.map((item, index) => {
    const hour = new Date(item.time).getHours();
    const cycle = Math.sin((index + 2) * 0.63);
    const daytimeEffect = hour >= 11 && hour <= 18 ? 0.10 : -0.03;
    const temperature = item.temperature + 0.45 * cycle + daytimeEffect;
    const humidity = Math.min(100, Math.max(0, item.humidity - 1.8 * cycle - daytimeEffect * 5));
    const vpd = Math.max(0, item.vpd + 0.07 * cycle + daytimeEffect);
    return { ...item, temperatureSam: temperature, humiditySam: humidity, vpdSam: vpd };
  });
}

async function fetchWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "vapour_pressure_deficit",
      "precipitation",
      "reference_evapotranspiration"
    ].join(","),
    timezone: "auto",
    past_days: "30",
    forecast_days: "7"
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error(`Erreur Open-Meteo (${response.status})`);

  const data = await response.json();
  const hourly = data.hourly.time.map((time, index) => ({
    time,
    temperature: data.hourly.temperature_2m[index],
    humidity: data.hourly.relative_humidity_2m[index],
    vpd: data.hourly.vapour_pressure_deficit[index],
    precipitation: data.hourly.precipitation[index],
    et0: data.hourly.reference_evapotranspiration[index]
  }));

  return {
    hourly: simulateSam(hourly),
    timezone: data.timezone,
    elevation: data.elevation
  };
}

function aggregateDaily(hourly) {
  const grouped = new Map();
  hourly.forEach((item) => {
    const day = item.time.slice(0, 10);
    if (!grouped.has(day)) grouped.set(day, { date: day, rain: 0, et0: 0 });
    const target = grouped.get(day);
    target.rain += Number(item.precipitation || 0);
    target.et0 += Number(item.et0 || 0);
  });
  return Array.from(grouped.values());
}

function findCurrentIndex() {
  const now = Date.now();
  let best = 0;
  let bestGap = Infinity;
  state.hourly.forEach((item, index) => {
    const gap = Math.abs(new Date(item.time).getTime() - now);
    if (gap < bestGap) {
      bestGap = gap;
      best = index;
    }
  });
  return best;
}

function futureSlice(hours) {
  const current = findCurrentIndex();
  return state.hourly.slice(current, current + hours);
}

function pastDays(days) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setDate(start.getDate() - days + 1);
  return state.daily.filter((item) => {
    const d = new Date(`${item.date}T12:00:00`);
    return d >= start && d <= today;
  });
}

function computeDeficit(daily, efficiency, resetMode) {
  let cumulative = 0;
  return daily.map((item) => {
    const effectiveRain = item.rain * efficiency;
    const balance = item.et0 - effectiveRain;
    cumulative += balance;
    if (resetMode === "zero") cumulative = Math.max(0, cumulative);
    return { ...item, effectiveRain, balance, cumulative };
  });
}

function initNavigation() {
  const links = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll(".page-section");
  const menu = document.getElementById("mainNav");
  const menuButton = document.getElementById("menuButton");

  function showSection(id) {
    sections.forEach((section) => section.classList.toggle("active", section.id === id));
    links.forEach((link) => link.classList.toggle("active", link.dataset.section === id));
    menu.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  links.forEach((link) => link.addEventListener("click", () => showSection(link.dataset.section)));
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.go));
  });

  menuButton.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
}

function setLoading(active) {
  document.getElementById("loadingPanel").classList.toggle("hidden", !active);
}

async function loadLocation(latitude, longitude, label) {
  const message = document.getElementById("locationMessage");
  setLoading(true);
  message.textContent = "";

  try {
    const result = await fetchWeather(latitude, longitude);
    state.latitude = latitude;
    state.longitude = longitude;
    state.label = label;
    state.hourly = result.hourly;
    state.daily = aggregateDaily(result.hourly);

    document.getElementById("locationTitle").textContent = label;
    document.getElementById("locationDetails").textContent =
      `Latitude ${fmt(latitude, 4)} · longitude ${fmt(longitude, 4)} · altitude modèle ${fmt(result.elevation, 0)} m · fuseau ${result.timezone}`;
    message.textContent = "Données actualisées depuis Open-Meteo.";

    renderAll();
  } catch (error) {
    message.textContent = `Impossible de charger les données : ${error.message}`;
  } finally {
    setLoading(false);
  }
}

function initLocationControls() {
  const form = document.getElementById("manualLocationForm");
  document.getElementById("manualButton").addEventListener("click", () => {
    form.classList.toggle("hidden");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const latitude = Number(document.getElementById("latitudeInput").value);
    const longitude = Number(document.getElementById("longitudeInput").value);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    loadLocation(latitude, longitude, "Position saisie manuellement");
  });

  document.getElementById("geolocateButton").addEventListener("click", () => {
    const message = document.getElementById("locationMessage");
    if (!navigator.geolocation) {
      message.textContent = "La géolocalisation n’est pas disponible dans ce navigateur.";
      return;
    }

    message.textContent = "Demande d’autorisation de localisation…";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        loadLocation(
          position.coords.latitude,
          position.coords.longitude,
          "Ma position"
        );
      },
      (error) => {
        const reasons = {
          1: "Autorisation de localisation refusée.",
          2: "Position indisponible.",
          3: "Délai de localisation dépassé."
        };
        message.textContent = `${reasons[error.code] || "Localisation impossible"} Utilisez la saisie manuelle.`;
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

function renderDashboard() {
  const currentIndex = findCurrentIndex();
  const current = state.hourly[currentIndex];
  const next24 = state.hourly.slice(currentIndex, currentIndex + 24);
  const max = next24.reduce((a, b) => b.vpd > a.vpd ? b : a, next24[0]);
  const threshold = Number(document.getElementById("vpdThreshold").value);
  const hoursAbove = next24.filter((item) => item.vpd > threshold).length;
  const deficit = computeDeficit(pastDays(30), 0.8, "zero");
  const deficitValue = deficit.at(-1)?.cumulative || 0;

  document.getElementById("currentVpd").textContent = `${fmt(current.vpd)} kPa`;
  document.getElementById("currentVpdClass").textContent = vpdClass(current.vpd);
  document.getElementById("maxVpd24").textContent = `${fmt(max.vpd)} kPa`;
  document.getElementById("maxVpdTime").textContent = dateLabel(max.time);
  document.getElementById("hoursAbove").textContent = `${hoursAbove} h`;
  document.getElementById("hoursThresholdLabel").textContent = `Au-dessus de ${fmt(threshold)} kPa sur 24 h`;
  document.getElementById("deficit30").textContent = `${fmt(deficitValue)} mm`;

  const next48 = futureSlice(48);
  destroyChart("dashboardVpd");
  state.charts.dashboardVpd = new Chart(document.getElementById("dashboardVpdChart"), {
    type: "line",
    data: {
      labels: next48.map((item) => dateLabel(item.time)),
      datasets: [{
        label: "VPD Open-Meteo",
        data: next48.map((item) => item.vpd),
        borderColor: "#7f1d2d",
        backgroundColor: "rgba(127,29,45,.10)",
        fill: true,
        tension: .25,
        pointRadius: 1.5
      }]
    },
    options: chartBase
  });

  destroyChart("dashboardDeficit");
  state.charts.dashboardDeficit = new Chart(document.getElementById("dashboardDeficitChart"), {
    type: "line",
    data: {
      labels: deficit.map((item) => dayLabel(item.date)),
      datasets: [{
        label: "Déficit cumulé",
        data: deficit.map((item) => item.cumulative),
        borderColor: "#a86516",
        backgroundColor: "rgba(168,101,22,.10)",
        fill: true,
        tension: .2,
        pointRadius: 1.5
      }]
    },
    options: chartBase
  });

  document.getElementById("dashboardInterpretation").textContent =
    `À ${state.label}, le maximum prévu sur les prochaines 24 heures est de ${fmt(max.vpd)} kPa. ` +
    `${hoursAbove} heure(s) dépassent ${fmt(threshold)} kPa. ` +
    `Le déficit climatique calculé sur les 30 derniers jours atteint ${fmt(deficitValue)} mm avec 80 % de pluie efficace.`;
}

function renderVpd() {
  const hours = Number(document.getElementById("vpdPeriod").value);
  const threshold = Number(document.getElementById("vpdThreshold").value);
  const source = document.getElementById("vpdSource").value;
  const rows = futureSlice(hours);
  if (!rows.length) return;

  const max = rows.reduce((a, b) => b.vpd > a.vpd ? b : a, rows[0]);
  const hoursAbove = rows.filter((item) => item.vpd > threshold).length;
  const daytime = rows.filter((item) => {
    const hour = new Date(item.time).getHours();
    return hour >= 8 && hour < 20;
  });
  const meanDay = daytime.reduce((sum, item) => sum + item.vpd, 0) / Math.max(1, daytime.length);
  const meanGap = rows.reduce((sum, item) => sum + (item.vpdSam - item.vpd), 0) / rows.length;

  document.getElementById("periodMaxVpd").textContent = `${fmt(max.vpd)} kPa`;
  document.getElementById("periodMaxTime").textContent = dateLabel(max.time);
  document.getElementById("periodHoursAbove").textContent = `${hoursAbove} h`;
  document.getElementById("periodThresholdText").textContent = `Au-dessus de ${fmt(threshold)} kPa`;
  document.getElementById("dayMeanVpd").textContent = `${fmt(meanDay)} kPa`;
  document.getElementById("meanVpdGap").textContent = `${meanGap >= 0 ? "+" : ""}${fmt(meanGap, 2)} kPa`;

  const datasets = [];
  if (source === "openmeteo" || source === "both") {
    datasets.push({
      label: "Open-Meteo",
      data: rows.map((item) => item.vpd),
      borderColor: "#7f1d2d",
      backgroundColor: "rgba(127,29,45,.08)",
      tension: .22,
      pointRadius: 1.5
    });
  }
  if (source === "sam" || source === "both") {
    datasets.push({
      label: "Station SAM simulée",
      data: rows.map((item) => item.vpdSam),
      borderColor: "#3f6f93",
      backgroundColor: "rgba(63,111,147,.08)",
      tension: .22,
      pointRadius: 1.5
    });
  }
  datasets.push({
    label: `Seuil ${fmt(threshold)} kPa`,
    data: rows.map(() => threshold),
    borderColor: "#a86516",
    borderDash: [6, 5],
    pointRadius: 0,
    borderWidth: 1.5
  });

  destroyChart("vpd");
  state.charts.vpd = new Chart(document.getElementById("vpdChart"), {
    type: "line",
    data: { labels: rows.map((item) => dateLabel(item.time)), datasets },
    options: {
      ...chartBase,
      scales: {
        ...chartBase.scales,
        y: {
          ...chartBase.scales.y,
          title: { display: true, text: "VPD (kPa)" }
        }
      }
    }
  });

  const thresholds = [1, 1.5, 2, 2.5, 3];
  destroyChart("threshold");
  state.charts.threshold = new Chart(document.getElementById("thresholdChart"), {
    type: "bar",
    data: {
      labels: thresholds.map((value) => `>${fmt(value)} kPa`),
      datasets: [{
        label: `Heures cumulées sur ${hours} h`,
        data: thresholds.map((value) => rows.filter((item) => item.vpd > value).length),
        backgroundColor: "rgba(127,29,45,.74)",
        borderRadius: 5
      }]
    },
    options: chartBase
  });

  document.getElementById("vpdReading").innerHTML = `
    <div class="reading-item">
      <strong>${vpdClass(max.vpd)}</strong>
      Le maximum attendu est de ${fmt(max.vpd)} kPa le ${dateLabel(max.time)}.
    </div>
    <div class="reading-item">
      <strong>Durée d’exposition</strong>
      ${hoursAbove} heure(s) dépassent le seuil sélectionné de ${fmt(threshold)} kPa.
    </div>
    <div class="reading-item">
      <strong>Prudence d’interprétation</strong>
      Un VPD élevé indique une forte demande atmosphérique, mais ne suffit pas à diagnostiquer
      un stress hydrique de l’arbre.
    </div>
  `;
}

function renderDeficit() {
  const days = Number(document.getElementById("deficitPeriod").value);
  const efficiency = Number(document.getElementById("rainEfficiency").value);
  const resetMode = document.getElementById("resetMode").value;
  const result = computeDeficit(pastDays(days), efficiency, resetMode);
  if (!result.length) return;

  const et0 = result.reduce((sum, item) => sum + item.et0, 0);
  const rain = result.reduce((sum, item) => sum + item.rain, 0);
  const effectiveRain = rain * efficiency;
  const finalDeficit = result.at(-1).cumulative;
  const last7 = result.slice(-7);
  const weekChange = last7.reduce((sum, item) => sum + item.balance, 0);

  document.getElementById("et0Total").textContent = `${fmt(et0)} mm`;
  document.getElementById("rainTotal").textContent = `${fmt(rain)} mm`;
  document.getElementById("effectiveRainTotal").textContent = `${fmt(effectiveRain)} mm efficaces`;
  document.getElementById("deficitTotal").textContent = `${fmt(finalDeficit)} mm`;
  document.getElementById("deficitWeekChange").textContent =
    `${weekChange >= 0 ? "+" : ""}${fmt(weekChange)} mm`;

  destroyChart("deficit");
  state.charts.deficit = new Chart(document.getElementById("deficitChart"), {
    data: {
      labels: result.map((item) => dayLabel(item.date)),
      datasets: [
        {
          type: "bar",
          label: "ET₀ quotidienne",
          data: result.map((item) => item.et0),
          backgroundColor: "rgba(168,101,22,.62)",
          yAxisID: "daily",
          borderRadius: 4
        },
        {
          type: "bar",
          label: "Pluie quotidienne",
          data: result.map((item) => item.rain),
          backgroundColor: "rgba(63,111,147,.62)",
          yAxisID: "daily",
          borderRadius: 4
        },
        {
          type: "line",
          label: "Déficit cumulé",
          data: result.map((item) => item.cumulative),
          borderColor: "#7f1d2d",
          backgroundColor: "#7f1d2d",
          yAxisID: "cumulative",
          tension: .22,
          pointRadius: 2
        }
      ]
    },
    options: {
      ...chartBase,
      scales: {
        x: chartBase.scales.x,
        daily: {
          beginAtZero: true,
          position: "left",
          title: { display: true, text: "ET₀ et pluie quotidiennes (mm)" },
          grid: { color: "rgba(101,114,126,.13)" }
        },
        cumulative: {
          position: "right",
          title: { display: true, text: "Déficit cumulé (mm)" },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function renderComparison() {
  const rows = futureSlice(48);
  if (!rows.length) return;

  const meanVpdGap = rows.reduce((sum, item) => sum + (item.vpdSam - item.vpd), 0) / rows.length;
  const maxVpdGap = Math.max(...rows.map((item) => Math.abs(item.vpdSam - item.vpd)));
  const meanTempGap = rows.reduce((sum, item) => sum + (item.temperatureSam - item.temperature), 0) / rows.length;
  const meanRhGap = rows.reduce((sum, item) => sum + (item.humiditySam - item.humidity), 0) / rows.length;

  document.getElementById("comparisonMeanGap").textContent =
    `${meanVpdGap >= 0 ? "+" : ""}${fmt(meanVpdGap, 2)} kPa`;
  document.getElementById("comparisonMaxGap").textContent = `${fmt(maxVpdGap, 2)} kPa`;
  document.getElementById("comparisonTempGap").textContent =
    `${meanTempGap >= 0 ? "+" : ""}${fmt(meanTempGap, 1)} °C`;
  document.getElementById("comparisonRhGap").textContent =
    `${meanRhGap >= 0 ? "+" : ""}${fmt(meanRhGap, 1)} %`;

  destroyChart("comparison");
  state.charts.comparison = new Chart(document.getElementById("comparisonChart"), {
    type: "line",
    data: {
      labels: rows.map((item) => dateLabel(item.time)),
      datasets: [
        {
          label: "Open-Meteo",
          data: rows.map((item) => item.vpd),
          borderColor: "#7f1d2d",
          tension: .22,
          pointRadius: 1.5
        },
        {
          label: "Station SAM simulée",
          data: rows.map((item) => item.vpdSam),
          borderColor: "#3f6f93",
          tension: .22,
          pointRadius: 1.5
        }
      ]
    },
    options: chartBase
  });
}

function renderAll() {
  renderDashboard();
  renderVpd();
  renderDeficit();
  renderComparison();
}

function initControls() {
  ["vpdPeriod", "vpdThreshold", "vpdSource"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      if (!state.hourly.length) return;
      renderVpd();
      renderDashboard();
    });
  });

  ["deficitPeriod", "rainEfficiency", "resetMode"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      if (!state.hourly.length) return;
      renderDeficit();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initLocationControls();
  initControls();
  loadLocation(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude, DEFAULT_LOCATION.label);
});
