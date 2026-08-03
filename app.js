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

const vpdBandsPlugin = {
  id: "vpdBands",
  beforeDraw(chart, args, options) {
    if (!options || options.enabled === false || !chart.chartArea) return;
    const { ctx, chartArea, scales } = chart;
    const y = scales.y;
    if (!y) return;

    const bands = [
      { min: 0, max: 1.0, color: "rgba(72, 149, 239, 0.16)" },
      { min: 1.0, max: 1.5, color: "rgba(82, 183, 136, 0.16)" },
      { min: 1.5, max: 2.5, color: "rgba(248, 196, 62, 0.18)" },
      { min: 2.5, max: 3.5, color: "rgba(244, 140, 54, 0.18)" },
      { min: 3.5, max: 4.5, color: "rgba(214, 69, 65, 0.18)" },
      { min: 4.5, max: Math.max(6, y.max), color: "rgba(83, 52, 131, 0.18)" }
    ];

    ctx.save();
    bands.forEach((band) => {
      const top = y.getPixelForValue(Math.min(band.max, y.max));
      const bottom = y.getPixelForValue(Math.max(band.min, y.min));
      ctx.fillStyle = band.color;
      ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, bottom - top);
    });
    ctx.restore();
  }
};

Chart.register(vpdBandsPlugin);

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
  if (vpd < 1.0) return "Faible demande atmosphérique";
  if (vpd < 1.5) return "Conditions favorables";
  if (vpd < 2.5) return "Début de régulation stomatique";
  if (vpd < 3.5) return "Contrainte atmosphérique élevée";
  if (vpd < 4.5) return "Stress sévère";
  return "Stress extrême";
}

function destroyChart(name) {
  if (state.charts[name]) {
    state.charts[name].destroy();
    state.charts[name] = null;
  }
}


function calculateVpd(temperature, humidity) {
  if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) return 0;
  const saturationPressure = 0.6108 * Math.exp((17.27 * temperature) / (temperature + 237.3));
  return Math.max(0, saturationPressure * (1 - humidity / 100));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    let details = "";
    try {
      const errorData = await response.json();
      details = errorData.reason ? ` : ${errorData.reason}` : "";
    } catch {
      details = "";
    }
    throw new Error(`Erreur Open-Meteo (${response.status})${details}`);
  }
  return response.json();
}

async function fetchWeather(latitude, longitude) {
  /*
   * Appel volontairement simplifié :
   * - le VPD est recalculé localement à partir de T et HR ;
   * - l'ET0 est récupérée en valeur quotidienne ;
   * - cela évite les erreurs 400 liées à certaines combinaisons de variables horaires.
   */
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation"
    ].join(","),
    daily: [
      "precipitation_sum",
      "et0_fao_evapotranspiration"
    ].join(","),
    timezone: "auto",
    past_days: "30",
    forecast_days: "7"
  });

  const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);

  if (!data.hourly || !data.hourly.time) {
    throw new Error("réponse horaire absente");
  }

  const hourly = data.hourly.time.map((time, index) => {
    const temperature = Number(data.hourly.temperature_2m[index]);
    const humidity = Number(data.hourly.relative_humidity_2m[index]);

    return {
      time,
      temperature,
      humidity,
      vpd: calculateVpd(temperature, humidity),
      precipitation: Number(data.hourly.precipitation[index] || 0),
      et0: 0
    };
  });

  const daily = data.daily && data.daily.time
    ? data.daily.time.map((date, index) => ({
        date,
        rain: Number(data.daily.precipitation_sum[index] || 0),
        et0: Number(data.daily.et0_fao_evapotranspiration[index] || 0)
      }))
    : aggregateDaily(hourly);

  return {
    hourly,
    daily,
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
    state.daily = result.daily || aggregateDaily(result.hourly);

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
  const threshold = 2;
  const hoursAbove = next24.filter((item) => item.vpd > threshold).length;
  const deficit = computeDeficit(pastDays(30), 0.8, "zero");
  const deficitValue = deficit.at(-1)?.cumulative || 0;

  document.getElementById("currentVpd").textContent = `${fmt(current.vpd)} kPa`;
  document.getElementById("currentVpdClass").textContent = vpdClass(current.vpd);
  document.getElementById("maxVpd24").textContent = `${fmt(max.vpd)} kPa`;
  document.getElementById("maxVpdTime").textContent = dateLabel(max.time);
  document.getElementById("hoursAbove").textContent = `${hoursAbove} h`;
  document.getElementById("hoursThresholdLabel").textContent = `VPD ≥ ${fmt(threshold)} kPa sur 24 h`;
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
    options: {
      ...chartBase,
      plugins: {
        ...chartBase.plugins,
        vpdBands: { enabled: true }
      }
    }
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
    `${hoursAbove} heure(s) présentent un VPD supérieur ou égal à ${fmt(threshold)} kPa. ` +
    `Le bilan climatique cumulé sur les 30 derniers jours atteint ${fmt(deficitValue)} mm, avec 100 % de la pluie prise en compte.`;
}

function renderVpd() {
  const hours = Number(document.getElementById("vpdPeriod").value);
  const rows = futureSlice(hours);
  if (!rows.length) return;

  const max = rows.reduce((a, b) => b.vpd > a.vpd ? b : a, rows[0]);
  const hoursAbove15 = rows.filter((item) => item.vpd > 1.5).length;
  const hoursAbove25 = rows.filter((item) => item.vpd > 2.5).length;
  const hoursAbove35 = rows.filter((item) => item.vpd > 3.5).length;
  const hoursAbove45 = rows.filter((item) => item.vpd > 4.5).length;
  const daytime = rows.filter((item) => {
    const hour = new Date(item.time).getHours();
    return hour >= 8 && hour < 20;
  });
  const meanDay = daytime.reduce((sum, item) => sum + item.vpd, 0) / Math.max(1, daytime.length);

  destroyChart("vpd");
  state.charts.vpd = new Chart(document.getElementById("vpdChart"), {
    type: "line",
    data: {
      labels: rows.map((item) => dateLabel(item.time)),
      datasets: [{
        label: "VPD Open-Meteo",
        data: rows.map((item) => item.vpd),
        borderColor: "#7f1d2d",
        backgroundColor: "rgba(127,29,45,.06)",
        tension: .22,
        pointRadius: 1.5,
        fill: false
      }]
    },
    options: {
      ...chartBase,
      plugins: {
        ...chartBase.plugins,
        vpdBands: { enabled: true }
      },
      scales: {
        ...chartBase.scales,
        y: {
          ...chartBase.scales.y,
          suggestedMax: 5.5,
          title: { display: true, text: "VPD (kPa)" }
        }
      }
    }
  });

  const thresholds = [1.5, 2.5, 3.5, 4.5];
  destroyChart("threshold");
  state.charts.threshold = new Chart(document.getElementById("thresholdChart"), {
    type: "bar",
    data: {
      labels: [
        "> 1,5 kPa — régulation stomatique",
        "> 2,5 kPa — contrainte importante",
        "> 3,5 kPa — stress sévère",
        "> 4,5 kPa — stress extrême"
      ],
      datasets: [{
        label: `Heures cumulées sur ${hours} h`,
        data: thresholds.map((value) => rows.filter((item) => item.vpd > value).length),
        backgroundColor: [
          "rgba(248, 196, 62, 0.78)",
          "rgba(244, 140, 54, 0.78)",
          "rgba(214, 69, 65, 0.78)",
          "rgba(83, 52, 131, 0.78)"
        ],
        borderRadius: 5
      }]
    },
    options: {
      ...chartBase,
      indexAxis: "y",
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "Nombre d’heures" },
          grid: { color: "rgba(101,114,126,.13)" }
        },
        y: {
          grid: { display: false }
        }
      }
    }
  });

  document.getElementById("vpdReading").innerHTML = `
    <div class="reading-item">
      <strong>Bleu — 0 à 1,0 kPa</strong>
      Faible demande atmosphérique.
    </div>
    <div class="reading-item">
      <strong>Vert — 1,0 à 1,5 kPa</strong>
      Conditions favorables.
    </div>
    <div class="reading-item">
      <strong>Jaune — 1,5 à 2,5 kPa</strong>
      Début de régulation stomatique.
    </div>
    <div class="reading-item">
      <strong>Orange — 2,5 à 3,5 kPa</strong>
      Contrainte atmosphérique élevée.
    </div>
    <div class="reading-item">
      <strong>Rouge — 3,5 à 4,5 kPa</strong>
      Stress sévère.
    </div>
    <div class="reading-item">
      <strong>Violet foncé — au-dessus de 4,5 kPa</strong>
      Stress extrême.
    </div>
    <div class="reading-item">
      <strong>Durées cumulées sur la période</strong>
      ${hoursAbove15} h au-dessus de 1,5 kPa ; ${hoursAbove25} h au-dessus de 2,5 kPa ;
      ${hoursAbove35} h au-dessus de 3,5 kPa ; ${hoursAbove45} h au-dessus de 4,5 kPa.
    </div>
  `;
}

function renderDeficit() {
  const days = Number(document.getElementById("deficitPeriod").value);
  const result = computeDeficit(pastDays(days), 1, "balance");
  if (!result.length) return;

  const et0 = result.reduce((sum, item) => sum + item.et0, 0);
  const rain = result.reduce((sum, item) => sum + item.rain, 0);
  const finalDeficit = result.at(-1).cumulative;
  const last7 = result.slice(-7);
  const weekChange = last7.reduce((sum, item) => sum + item.balance, 0);

  document.getElementById("et0Total").textContent = `${fmt(et0)} mm`;
  document.getElementById("rainTotal").textContent = `${fmt(rain)} mm`;
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

function renderAll() {
  renderDashboard();
  renderVpd();
  renderDeficit();
}

function initControls() {
  ["vpdPeriod"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      if (!state.hourly.length) return;
      renderVpd();
      renderDashboard();
    });
  });

  ["deficitPeriod"].forEach((id) => {
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
