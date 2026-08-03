const DEFAULT={lat:43.9090,lon:4.0000,name:"Quissac (30)"};
const charts={};

function fmt(v,d=1){return Number(v).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d})}
function shortDate(s){return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit"}).format(new Date(`${s}T12:00:00`))}
function fullDate(d){return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d)}
function vpd(t,rh){const es=.6108*Math.exp((17.27*t)/(t+237.3));return Math.max(0,es*(1-rh/100))}
function destroy(name){if(charts[name])charts[name].destroy()}
function showStatus(text){const el=document.getElementById("status");el.textContent=text;el.style.display="block";setTimeout(()=>el.style.display="none",3500)}

const baseOptions={
 responsive:true,maintainAspectRatio:false,
 plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false}},
 scales:{
  x:{grid:{display:false},ticks:{color:"#111827",font:{size:10}}},
  y:{beginAtZero:true,grid:{color:"#e6e9ed"},ticks:{color:"#111827",font:{size:10}}}
 }
};

async function getWeather(lat,lon){
 const p=new URLSearchParams({
  latitude:lat.toFixed(4),longitude:lon.toFixed(4),
  hourly:["temperature_2m","relative_humidity_2m","precipitation","wind_speed_10m"].join(","),
  daily:["temperature_2m_max","temperature_2m_min","precipitation_sum","et0_fao_evapotranspiration"].join(","),
  timezone:"auto",forecast_days:"8"
 });
 const r=await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
 if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.reason||`Erreur ${r.status}`)}
 return r.json()
}

function prep(data){
 const hourly=data.hourly.time.map((time,i)=>{
  const temp=+data.hourly.temperature_2m[i],rh=+data.hourly.relative_humidity_2m[i];
  return{time,temp,rh,vpd:vpd(temp,rh),rain:+data.hourly.precipitation[i]||0,wind:+data.hourly.wind_speed_10m[i]||0}
 });
 const daily=data.daily.time.slice(0,7).map((date,i)=>({
  date,tmax:+data.daily.temperature_2m_max[i],tmin:+data.daily.temperature_2m_min[i],
  rain:+data.daily.precipitation_sum[i]||0,et0:+data.daily.et0_fao_evapotranspiration[i]||0
 }));
 return{hourly,daily}
}

function dayHours(hourly,date){return hourly.filter(x=>x.time.startsWith(date))}
function score(day,hours){
 const maxV=Math.max(...hours.map(x=>x.vpd),0);
 const over25=hours.filter(x=>x.vpd>2.5).length;
 const vScore=Math.min(100,maxV/4.5*100);
 const dScore=Math.min(100,over25/10*100);
 const hScore=day.tmax<=30?0:Math.min(100,(day.tmax-30)/10*100);
 const eScore=Math.min(100,day.et0/8*100);
 return Math.round(.4*vScore+.25*dScore+.2*hScore+.15*eScore)
}
function scoreColor(v){
 if(v<20)return"#16975c";
 if(v<40)return"#56b84e";
 if(v<60)return"#ffc400";
 if(v<80)return"#ff7a00";
 return"#ef2525"
}
function irrigationLabel(q){
 if(q>=75)return["Très favorable","very-good"];
 if(q>=58)return["Favorable","good"];
 if(q>=38)return["Défavorable","bad"];
 return["Très défavorable","very-bad"]
}
function irrigationScore(x){
 let q=100;
 q-=Math.max(0,x.vpd-1)*25;
 q-=Math.max(0,x.wind-8)*4;
 q-=Math.max(0,x.temp-26)*3;
 if(x.rain>0)q-=60;
 return q
}

function render(data,meta,lat,lon,name){
 const {hourly,daily}=prep(data);
 const labels=daily.map(x=>shortDate(x.date));
 periodStart.textContent=labels[0];periodEnd.textContent=labels.at(-1);
 locationName.textContent=name;altitudeValue.textContent=`${fmt(meta.elevation,0)} m`;
 latitudeValue.textContent=`${fmt(lat,2)} °N`;longitudeValue.textContent=`${fmt(lon,2)} °E`;
 updatedValue.textContent=new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date());

 let ce=0,cp=0,cd=0;const etCum=[],rainCum=[],defCum=[];
 daily.forEach(d=>{ce+=d.et0;cp+=d.rain;cd+=d.et0-d.rain;etCum.push(ce);rainCum.push(cp);defCum.push(cd)});
 et0Total.textContent=`${fmt(ce)} mm`;rainTotal.textContent=`${fmt(cp)} mm`;deficitTotal.textContent=`${cd>=0?"+":""}${fmt(cd)} mm`;

 destroy("deficit");
 charts.deficit=new Chart(deficitChart,{type:"line",data:{labels,datasets:[
  {label:"ET₀ cumulée",data:etCum,borderColor:"#2f80ed",backgroundColor:"transparent",pointRadius:2,tension:.15},
  {label:"Pluie cumulée",data:rainCum,borderColor:"#53ad3b",backgroundColor:"rgba(83,173,59,.18)",fill:true,pointRadius:2,tension:.15},
  {label:"Déficit",data:defCum,borderColor:"#c51624",backgroundColor:"rgba(197,22,36,.15)",fill:{target:{value:0}},pointRadius:2,tension:.15}
 ]},options:{...baseOptions,plugins:{legend:{display:true,position:"bottom",labels:{boxWidth:20,font:{size:10}}}},scales:{...baseOptions.scales,y:{...baseOptions.scales.y,title:{display:true,text:"mm",align:"end"}}}}});

 const futureHourly=hourly.slice(0,168);
 destroy("vpd");
 charts.vpd=new Chart(vpdChart,{type:"line",data:{labels:futureHourly.map(x=>x.time),datasets:[{data:futureHourly.map(x=>x.vpd),borderColor:"#a40012",pointRadius:0,tension:.2}]},options:{...baseOptions,scales:{x:{grid:{display:false},ticks:{callback:(v,i)=>{const s=futureHourly[i].time;return i%24===0?shortDate(s.slice(0,10)):""},maxRotation:0},y:{beginAtZero:true,suggestedMax:6,grid:{color:"#e6e9ed"},title:{display:true,text:"kPa",align:"end"}}}}});

 const thresholds=[1.5,2.5,3.5,4.5];
 const thValues=thresholds.map(t=>futureHourly.filter(x=>x.vpd>t).length);
 destroy("threshold");
 charts.threshold=new Chart(thresholdChart,{type:"bar",data:{labels:["> 1,5 kPa","> 2,5 kPa","> 3,5 kPa","> 4,5 kPa"],datasets:[{data:thValues,backgroundColor:["#ffc400","#ff7a00","#ef2525","#7a1fa2"],borderWidth:0,barPercentage:.48}]},options:{...baseOptions,plugins:{legend:{display:false},datalabels:false},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:"#e6e9ed"},title:{display:true,text:"h",align:"end"}}}}});

 const scores=daily.map(d=>score(d,dayHours(hourly,d.date)));
 destroy("score");
 charts.score=new Chart(scoreChart,{type:"bar",data:{labels,datasets:[{data:scores,backgroundColor:scores.map(scoreColor),barPercentage:.48}]},options:{...baseOptions,scales:{x:{grid:{display:false}},y:{beginAtZero:true,max:100,grid:{color:"#e6e9ed"},title:{display:true,text:"Indice (0-100)",align:"end"}}}}});

 const heat=daily.map(d=>dayHours(hourly,d.date).filter(x=>x.temp>35).length);
 const wet=daily.map(d=>dayHours(hourly,d.date).filter(x=>x.rh>=90||x.rain>0).length);
 const fav=daily.map(d=>dayHours(hourly,d.date).filter(x=>x.vpd>=.8&&x.vpd<=1.8&&x.temp>=20&&x.temp<=30).length);
 const makeBlue=(id,key,values,color)=>{destroy(key);charts[key]=new Chart(id,{type:"bar",data:{labels,datasets:[{data:values,backgroundColor:color,barPercentage:.48}]},options:{...baseOptions,scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:"#e6e9ed"},title:{display:true,text:"h",align:"end"}}}}})};
 makeBlue(heatChart,"heat",heat,"#3e88e8");makeBlue(wetChart,"wet",wet,"#3e88e8");makeBlue(favorableChart,"fav",fav,"#58b748");
 destroy("et0");charts.et0=new Chart(et0Chart,{type:"bar",data:{labels,datasets:[{data:daily.map(d=>d.et0),backgroundColor:"#3e88e8",barPercentage:.48}]},options:{...baseOptions,scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:"#e6e9ed"},title:{display:true,text:"mm",align:"end"}}}}});

 const tomorrow=daily[1]?.date;irrigationDate.textContent=`Demain : ${shortDate(tomorrow)}`;
 const htom=hourly.filter(x=>x.time.startsWith(tomorrow));irrigationBody.innerHTML="";
 for(let s=0;s<24;s+=3){
  const p=htom.filter(x=>+x.time.slice(11,13)>=s&&+x.time.slice(11,13)<s+3);
  const avg=k=>p.reduce((a,x)=>a+x[k],0)/Math.max(1,p.length);
  const q=irrigationScore({vpd:avg("vpd"),wind:avg("wind"),temp:avg("temp"),rain:p.reduce((a,x)=>a+x.rain,0)});
  const [label,cls]=irrigationLabel(q);
  const tr=document.createElement("tr");
  tr.innerHTML=`<td>${String(s).padStart(2,"0")}h – ${String(s+3).padStart(2,"0")}h</td><td class="condition ${cls}">${label}</td>`;
  irrigationBody.appendChild(tr)
 }
}

async function load(lat,lon,name){
 try{
  showStatus("Chargement des données…");
  const data=await getWeather(lat,lon);
  render(data,data,lat,lon,name);
 }catch(e){showStatus(`Impossible de charger : ${e.message}`)}
}

locateBtn.onclick=()=>{
 manualLocation.classList.toggle("hidden");
 if(navigator.geolocation){
  navigator.geolocation.getCurrentPosition(p=>load(p.coords.latitude,p.coords.longitude,"Ma position"),()=>{});
 }
};
loadCoordsBtn.onclick=()=>load(+latInput.value,+lonInput.value,"Position manuelle");
load(DEFAULT.lat,DEFAULT.lon,DEFAULT.name);
