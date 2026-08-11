const DEFAULT_LOCATION={latitude:43.6077,longitude:4.0122,label:"Ma position"};
const state={hourly:[],daily:[],charts:{},label:"",place:""};

const chartBase={responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:"index"},plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:8,padding:18}},vpdBands:{enabled:false}},scales:{x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:10}},y:{beginAtZero:true,grid:{color:"rgba(101,114,126,.13)"}}}};

const vpdBandsPlugin={id:"vpdBands",beforeDraw(chart,args,options){if(!options||options.enabled!==true||!chart.chartArea)return;const{ctx,chartArea,scales}=chart;const y=scales.y;if(!y)return;const bands=[
{min:0,max:0.8,color:"rgba(72,149,239,.28)"},{min:0.8,max:1.6,color:"rgba(82,183,136,.28)"},{min:1.6,max:2.5,color:"rgba(248,196,62,.32)"},{min:2.5,max:3.5,color:"rgba(244,140,54,.32)"},{min:3.5,max:4.5,color:"rgba(214,69,65,.30)"},{min:4.5,max:Math.max(6,y.max),color:"rgba(83,52,131,.30)"}];ctx.save();bands.forEach(b=>{const top=y.getPixelForValue(Math.min(b.max,y.max));const bottom=y.getPixelForValue(Math.max(b.min,y.min));ctx.fillStyle=b.color;ctx.fillRect(chartArea.left,top,chartArea.right-chartArea.left,bottom-top)});ctx.restore()}};
Chart.register(vpdBandsPlugin);


function fmt(v,d=1){return Number.isFinite(v)?v.toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d}):"—"}
function dateLabel(iso){return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(iso))}
function dayLabel(iso){return new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"2-digit",month:"2-digit"}).format(new Date(`${iso}T12:00:00`))}
function calcVpd(t,rh){const es=.6108*Math.exp((17.27*t)/(t+237.3));return Math.max(0,es*(1-rh/100))}
function vpdLabel(v){if(v<0.8)return"Faible demande atmosphérique";if(v<1.6)return"Conditions favorables";if(v<2.5)return"Début de régulation stomatique";if(v<3.5)return"Contrainte atmosphérique élevée";if(v<4.5)return"Stress sévère";return"Stress extrême"}
function destroy(name){if(state.charts[name])state.charts[name].destroy()}

async function fetchJson(url){const r=await fetch(url);if(!r.ok){let detail="";try{const e=await r.json();detail=e.reason?`: ${e.reason}`:""}catch{}throw new Error(`Erreur Open-Meteo (${r.status})${detail}`)}return r.json()}
async function fetchWeather(lat,lon){
 const p=new URLSearchParams({latitude:lat.toFixed(4),longitude:lon.toFixed(4),hourly:["temperature_2m","relative_humidity_2m","precipitation","wind_speed_10m","shortwave_radiation"].join(","),daily:["precipitation_sum","et0_fao_evapotranspiration","temperature_2m_max","temperature_2m_min"].join(","),timezone:"auto",past_days:"30",forecast_days:"7"});
 const d=await fetchJson(`https://api.open-meteo.com/v1/forecast?${p}`);
 const hourly=d.hourly.time.map((time,i)=>{const temperature=Number(d.hourly.temperature_2m[i]);const humidity=Number(d.hourly.relative_humidity_2m[i]);return{time,temperature,humidity,vpd:calcVpd(temperature,humidity),rain:Number(d.hourly.precipitation[i]||0),wind:Number(d.hourly.wind_speed_10m[i]||0),radiation:Number(d.hourly.shortwave_radiation[i]||0)}});
 const daily=d.daily.time.map((date,i)=>({date,rain:Number(d.daily.precipitation_sum[i]||0),et0:Number(d.daily.et0_fao_evapotranspiration[i]||0),tmax:Number(d.daily.temperature_2m_max[i]),tmin:Number(d.daily.temperature_2m_min[i])}));
 return{hourly,daily,timezone:d.timezone,elevation:d.elevation}
}

async function fetchNearestCity(lat,lon){
 try{
   const data=await fetchJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`);
   const a=data.address||{};
   return a.city||a.town||a.village||a.municipality||a.county||data.name||"";
 }catch(e){
   return "";
 }
}

function currentIndex(){const now=Date.now();let best=0,gap=Infinity;state.hourly.forEach((x,i)=>{const g=Math.abs(new Date(x.time)-now);if(g<gap){gap=g;best=i}});return best}
function futureHours(n){const i=currentIndex();return state.hourly.slice(i,i+n)}
function forecastDays(){const now=new Date();now.setHours(0,0,0,0);return state.daily.filter(d=>new Date(`${d.date}T12:00:00`)>=now).slice(0,7)}
function hourlyForDay(date){return state.hourly.filter(x=>x.time.startsWith(date))}
function pastDays(n){const end=new Date();end.setHours(23,59,59,999);const start=new Date(end);start.setDate(start.getDate()-n+1);return state.daily.filter(d=>{const x=new Date(`${d.date}T12:00:00`);return x>=start&&x<=end})}

function average(values){
 const valid=values.filter(Number.isFinite);
 return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:0;
}
function weatherForecastDays(){
 return forecastDays().map(day=>{
   const h=hourlyForDay(day.date);
   return{
     ...day,
     humidityMean:average(h.map(x=>x.humidity)),
     windMean:average(h.map(x=>x.wind)),
     windMax:h.length?Math.max(...h.map(x=>x.wind)):0
   };
 });
}

function scoreDay(day){
 const h=hourlyForDay(day.date);
 const maxVpd=Math.max(...h.map(x=>x.vpd),0);
 const hours25=h.filter(x=>x.vpd>2.5).length;
 const vpdScore=Math.min(100,maxVpd/4.5*100);
 const durationScore=Math.min(100,hours25/10*100);
 const heatScore=day.tmax<=30?0:Math.min(100,(day.tmax-30)/10*100);
 const et0Score=Math.min(100,day.et0/8*100);
 const score=Math.round(.40*vpdScore+.25*durationScore+.20*heatScore+.15*et0Score);
 return{...day,score,maxVpd,hours25}
}
function scoreLabel(s){if(s<25)return"Faible";if(s<50)return"Modérée";if(s<75)return"Élevée";if(s<90)return"Sévère";return"Extrême"}


function initNav(){
 const links=document.querySelectorAll(".nav-link"),secs=document.querySelectorAll(".page-section"),menu=document.getElementById("mainNav"),btn=document.getElementById("menuButton");
 links.forEach(l=>l.addEventListener("click",()=>{secs.forEach(s=>s.classList.toggle("active",s.id===l.dataset.section));links.forEach(x=>x.classList.toggle("active",x===l));menu.classList.remove("open");window.scrollTo({top:0,behavior:"smooth"})}));
 btn.addEventListener("click",()=>menu.classList.toggle("open"))
}
function initLocation(){
 const form=document.getElementById("manualLocationForm");
 document.getElementById("manualButton").onclick=()=>form.classList.toggle("hidden");
 form.onsubmit=e=>{e.preventDefault();loadLocation(Number(latitudeInput.value),Number(longitudeInput.value),"Position saisie manuellement")};
 document.getElementById("geolocateButton").onclick=()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>loadLocation(p.coords.latitude,p.coords.longitude,"Ma position"),()=>locationMessage.textContent="Localisation impossible. Utilisez la saisie manuelle."):locationMessage.textContent="Géolocalisation indisponible."
}
async function loadLocation(lat,lon,label){
 loadingPanel.classList.remove("hidden");locationMessage.textContent="";
 try{
  const r=await fetchWeather(lat,lon);
  const place=await fetchNearestCity(lat,lon);
  state.hourly=r.hourly;state.daily=r.daily;state.label=label;state.place=place;
  locationTitle.textContent="Ma position";
  locationDetails.textContent=`${place?`Ville la plus proche : ${place} · `:""}Latitude ${fmt(lat,4)} · longitude ${fmt(lon,4)} · altitude ${fmt(r.elevation,0)} m`;
  locationMessage.textContent="Données actualisées.";
  renderAll();
 }
 catch(e){locationMessage.textContent=`Impossible de charger les données : ${e.message}`}
 finally{loadingPanel.classList.add("hidden")}
}

function renderDashboard(){
 const fd=forecastDays().map(scoreDay),today=fd[0],next48=futureHours(48);
 if(!today)return;
 todayScore.textContent=`${today.score}/100`;todayScoreLabel.textContent=scoreLabel(today.score);todayMaxVpd.textContent=`${fmt(today.maxVpd)} kPa`;todayVpdLabel.textContent=vpdLabel(today.maxVpd);
 const weatherDays=weatherForecastDays();
 const tomorrow=weatherDays[1]||weatherDays[0];
 if(tomorrow){
   tomorrowTemperature.textContent=`${fmt(tomorrow.tmin)}–${fmt(tomorrow.tmax)} °C`;
   tomorrowWeatherDetails.textContent=`Pluie ${fmt(tomorrow.rain)} mm · humidité ${fmt(tomorrow.humidityMean,0)} % · vent max ${fmt(tomorrow.windMax)} km/h`;
 }
 const favorable=futureHours(168).filter(x=>x.temperature>=18&&x.temperature<=30&&x.vpd>=0.8&&x.vpd<=1.6&&x.radiation>100).length;
 dashboardFavorableHours.textContent=`${favorable} h`;
 const deficit=computeDeficit(pastDays(30));dashboardDeficit.textContent=`${fmt(deficit.at(-1)?.cumulative||0)} mm`;

 destroy("dashScore");state.charts.dashScore=new Chart(dashboardScoreChart,{type:"bar",data:{labels:fd.map(d=>dayLabel(d.date)),datasets:[{label:"Indice /100",data:fd.map(d=>d.score),backgroundColor:fd.map(d=>d.score<25
?"rgba(72,149,239,.75)"
:d.score<50
?"rgba(82,183,136,.75)"
:d.score<75
?"rgba(248,196,62,.82)"
:d.score<90
?"rgba(244,140,54,.82)"
:"rgba(83,52,131,.82)"),borderRadius:6}]},options:{...chartBase,scales:{x:chartBase.scales.x,y:{beginAtZero:true,max:100}}}});
 destroy("dashVpd");state.charts.dashVpd=new Chart(dashboardVpdChart,{type:"line",data:{labels:next48.map(x=>dateLabel(x.time)),datasets:[{label:"DPV",data:next48.map(x=>x.vpd),borderColor:"#7f1d2d",pointRadius:1.5,tension:.2}]},options:{...chartBase,plugins:{...chartBase.plugins,vpdBands:{enabled:true}},scales:{...chartBase.scales,y:{beginAtZero:true,suggestedMax:5.5,title:{display:true,text:"DPV (kPa)"}}}}})
}

function renderWeather(){
 const days=weatherForecastDays();
 if(!days.length)return;
 weatherCards.innerHTML=days.map(d=>`<article class="weather-card">
   <span class="weather-day">${dayLabel(d.date)}</span>
   <strong>${fmt(d.tmin)}–${fmt(d.tmax)} °C</strong>
   <span class="weather-detail">Pluie : ${fmt(d.rain)} mm</span>
   <span class="weather-detail">Humidité moy. : ${fmt(d.humidityMean,0)} %</span>
   <span class="weather-detail">Vent moy. : ${fmt(d.windMean)} km/h</span>
   <span class="weather-detail">Vent max : ${fmt(d.windMax)} km/h</span>
 </article>`).join("");

 destroy("temperature");
 state.charts.temperature=new Chart(temperatureChart,{
   type:"line",
   data:{labels:days.map(d=>dayLabel(d.date)),datasets:[
     {label:"Tmin",data:days.map(d=>d.tmin),borderColor:"#4895ef",backgroundColor:"#4895ef",tension:.2,pointRadius:3},
     {label:"Tmax",data:days.map(d=>d.tmax),borderColor:"#e1064b",backgroundColor:"#e1064b",tension:.2,pointRadius:3}
   ]},
   options:{...chartBase,scales:{x:chartBase.scales.x,y:{beginAtZero:false,title:{display:true,text:"Température (°C)"},grid:{color:"rgba(101,114,126,.13)"}}}}
 });

 destroy("rainForecast");
 state.charts.rainForecast=new Chart(rainForecastChart,{
   type:"bar",
   data:{labels:days.map(d=>dayLabel(d.date)),datasets:[{label:"Pluie prévue",data:days.map(d=>d.rain),backgroundColor:"rgba(72,149,239,.75)",borderRadius:5}]},
   options:{...chartBase,scales:{x:chartBase.scales.x,y:{beginAtZero:true,title:{display:true,text:"Pluie (mm)"},grid:{color:"rgba(101,114,126,.13)"}}}}
 });

 destroy("humidity");
 state.charts.humidity=new Chart(humidityChart,{
   type:"line",
   data:{labels:days.map(d=>dayLabel(d.date)),datasets:[{label:"Humidité moyenne",data:days.map(d=>d.humidityMean),borderColor:"#52b788",backgroundColor:"#52b788",tension:.2,pointRadius:3}]},
   options:{...chartBase,scales:{x:chartBase.scales.x,y:{beginAtZero:true,max:100,title:{display:true,text:"Humidité relative (%)"},grid:{color:"rgba(101,114,126,.13)"}}}}
 });

 destroy("wind");
 state.charts.wind=new Chart(windChart,{
   type:"line",
   data:{labels:days.map(d=>dayLabel(d.date)),datasets:[
     {label:"Vent moyen",data:days.map(d=>d.windMean),borderColor:"#65727e",backgroundColor:"#65727e",tension:.2,pointRadius:3},
     {label:"Vent maximal",data:days.map(d=>d.windMax),borderColor:"#e1064b",backgroundColor:"#e1064b",tension:.2,pointRadius:3}
   ]},
   options:{...chartBase,scales:{x:chartBase.scales.x,y:{beginAtZero:true,title:{display:true,text:"Vent (km/h)"},grid:{color:"rgba(101,114,126,.13)"}}}}
 });
}

function renderVpd(){
 const hours=Number(vpdPeriod.value),rows=futureHours(hours);if(!rows.length)return;
 destroy("vpd");state.charts.vpd=new Chart(vpdChart,{type:"line",data:{labels:rows.map(x=>dateLabel(x.time)),datasets:[{label:"DPV",data:rows.map(x=>x.vpd),borderColor:"#7f1d2d",pointRadius:1.5,tension:.2}]},options:{...chartBase,plugins:{...chartBase.plugins,vpdBands:{enabled:true}},scales:{...chartBase.scales,y:{beginAtZero:true,suggestedMax:5.5,title:{display:true,text:"DPV (kPa)"}}}}});
 const thresholds=[1.5,2.5,3.5,4.5];
 destroy("threshold");state.charts.threshold=new Chart(thresholdChart,{type:"bar",data:{labels:["> 1,5 kPa — régulation","> 2,5 kPa — contrainte","> 3,5 kPa — stress sévère","> 4,5 kPa — stress extrême"],datasets:[{label:`Heures sur ${hours} h`,data:thresholds.map(t=>rows.filter(x=>x.vpd>t).length),backgroundColor:["rgba(248,196,62,.8)","rgba(244,140,54,.8)","rgba(214,69,65,.8)","rgba(83,52,131,.8)"],borderRadius:5}]},options:{...chartBase,indexAxis:"y",scales:{x:{beginAtZero:true,title:{display:true,text:"Heures"}},y:{grid:{display:false}}}}});
}

function renderScore(){
 const fd=forecastDays().map(scoreDay);
 destroy("score");state.charts.score=new Chart(scoreChart,{type:"bar",data:{labels:fd.map(d=>dayLabel(d.date)),datasets:[{label:"Indice /100",data:fd.map(d=>d.score),backgroundColor:fd.map(d=>d.score<25
?"rgba(72,149,239,.75)"
:d.score<50
?"rgba(82,183,136,.75)"
:d.score<75
?"rgba(248,196,62,.82)"
:d.score<90
?"rgba(244,140,54,.82)"
:"rgba(83,52,131,.82)"),borderRadius:6}]},options:{...chartBase,scales:{x:chartBase.scales.x,y:{beginAtZero:true,max:100}}}});
 scoreCards.innerHTML=fd.map(d=>`<article class="forecast-card"><span>${dayLabel(d.date)}</span><strong>${d.score}/100</strong><span class="forecast-level">${scoreLabel(d.score)}</span><div class="forecast-metrics"><span>DPV max : ${fmt(d.maxVpd)} kPa</span><span>Durée > 2,5 kPa : ${d.hours25} h</span><span>Tmax : ${fmt(d.tmax)} °C</span><span>ET₀ : ${fmt(d.et0)} mm</span></div></article>`).join("")
}

function computeDeficit(days){
 let cumulative=0;
 return days.map(day=>{
   const et0=Number(day.et0)||0;
   const rain=Number(day.rain)||0;
   cumulative+=et0-rain;
   return {...day,et0,rain,cumulative};
 });
}
function renderDeficit(){
 const days=Number(deficitPeriod.value),rows=computeDeficit(pastDays(days));if(!rows.length)return;const et0=rows.reduce((s,d)=>s+d.et0,0),rain=rows.reduce((s,d)=>s+d.rain,0),last=rows.at(-1).cumulative,week=rows.slice(-7).reduce((s,d)=>s+d.et0-d.rain,0);
 et0Total.textContent=`${fmt(et0)} mm`;rainTotal.textContent=`${fmt(rain)} mm`;deficitTotal.textContent=`${fmt(last)} mm`;deficitWeekChange.textContent=`${week>=0?"+":""}${fmt(week)} mm`;
 destroy("deficit");state.charts.deficit=new Chart(deficitChart,{data:{labels:rows.map(d=>dayLabel(d.date)),datasets:[{type:"bar",label:"ET₀",data:rows.map(d=>d.et0),backgroundColor:"rgba(168,101,22,.62)",yAxisID:"daily"},{type:"bar",label:"Pluie",data:rows.map(d=>d.rain),backgroundColor:"rgba(63,111,147,.62)",yAxisID:"daily"},{type:"line",label:"Bilan cumulé",data:rows.map(d=>d.cumulative),borderColor:"#7f1d2d",yAxisID:"cum",tension:.2}]},options:{...chartBase,scales:{x:chartBase.scales.x,daily:{beginAtZero:true,position:"left"},cum:{position:"right",beginAtZero:false,grid:{drawOnChartArea:false}}}}})
}
function renderAll(){renderDashboard();renderWeather();renderDeficit();renderVpd();renderScore()}
document.addEventListener("DOMContentLoaded",()=>{initNav();initLocation();vpdPeriod.onchange=renderVpd;deficitPeriod.onchange=renderDeficit;loadLocation(DEFAULT_LOCATION.latitude,DEFAULT_LOCATION.longitude,DEFAULT_LOCATION.label)})
