/* RENDER MATCH */
function renderMatch(){
  const m=state.currentMatch;
  document.getElementById("noMatchNotice").classList.toggle("hidden",!!m);
  document.getElementById("matchArea").classList.toggle("hidden",!m);
  if(!m) return;

  document.getElementById("trackedTeamName").textContent=m.team.name;
  document.getElementById("opponentName").textContent=m.opponent.name;
  document.getElementById("trackedScore").textContent=m.team.score;
  document.getElementById("opponentScore").textContent=m.opponent.score;
  document.getElementById("ourActionsTitle").textContent=m.team.name;
  document.getElementById("oppActionsTitle").textContent=m.opponent.name;
  document.getElementById("modeBadge").textContent=clockModeLabel(m);

  updateClockDisplay();
  renderPlayerSections();
  renderTimeSummary();
  renderEvents();
}
function phaseLabel(m){
  if(m.phase==="first_half") return "1ª Parte";
  if(m.phase==="halftime") return "Intervalo";
  if(m.phase==="second_half") return "2ª Parte";
  if(m.phase==="finished") return "Jogo terminado";
  return `${m.period===1?"1ª":"2ª"} Parte`;
}
function updateClockDisplay(){
  const m=state.currentMatch;
  if(!m) return;

  document.getElementById("clock").textContent=mainClockText(m);

  let meta=`${phaseLabel(m)} · ${clockModeLabel(m)}`;
  if(m.timeout.active) meta+=" · jogadores congelados";
  if(m.awaitingResume) meta+=" · à espera de retomar";
  document.getElementById("clockMeta").textContent=meta;

  const toggle=document.getElementById("toggleClockBtn");
  const resume=document.getElementById("resumeBtn");
  const periodControl=document.getElementById("periodControlBtn");
  const finishBtn=document.getElementById("finishMatchBtn");

  const live=isLivePeriod(m);
  const finished=m.phase==="finished";

  toggle.classList.toggle("hidden",m.awaitingResume || !live || finished);
  resume.classList.toggle("hidden",!m.awaitingResume || !live || finished);

  toggle.textContent=m.running?"Pausar":"Iniciar";
  toggle.disabled=m.timeout.active || !live || finished;

  if(m.phase==="first_half"){
    periodControl.textContent="Terminar 1ª parte";
    periodControl.classList.remove("good");
    periodControl.disabled=m.timeout.active;
    periodControl.classList.remove("hidden");
  }else if(m.phase==="halftime"){
    periodControl.textContent="Iniciar 2ª parte";
    periodControl.classList.add("good");
    periodControl.disabled=false;
    periodControl.classList.remove("hidden");
  }else{
    periodControl.classList.add("hidden");
  }

  finishBtn.classList.toggle("hidden",finished);

  const strip=document.getElementById("timeoutStrip");
  if(m.timeout.active){
    const who=m.timeout.calledBy==="tracked"?m.team.name:m.opponent.name;
    strip.innerHTML=`
      <div class="timeout-live">
        Timeout · ${esc(who)}
        <span class="timeout-clock">${formatSeconds(m.timeout.remaining)}</span>
      </div>`;
  }else if(m.awaitingResume){
    strip.innerHTML=`<div class="timeout-live">Timeout terminado · jogo parado</div>`;
  }else if(m.phase==="halftime"){
    strip.innerHTML=`<div class="timeout-live">1ª parte terminada · intervalo</div>`;
  }else if(m.phase==="finished"){
    strip.innerHTML=`<div class="timeout-live">Jogo terminado</div>`;
  }else{
    strip.innerHTML="";
  }

  document.querySelectorAll("[data-timeout-side]").forEach(btn=>{
    btn.disabled=m.timeout.active || m.awaitingResume || !live || finished;
  });

  document.querySelectorAll("[data-side][data-event]").forEach(btn=>{
    btn.disabled=!live || finished;
  });
}

function playerCardHtml(p,m){
  return `
    <div>
      <div class="player-name">#${p.number} — ${esc(p.name)}</div>
      <div class="player-pos">${esc(p.position)} · ${p.status==="in"?"EM CAMPO":"FORA"}</div>
    </div>
    <div class="metric-current">
      <div class="metric-label">${p.status==="in"?"Em campo há":"Fora há"}</div>
      <div class="metric-value">${formatSeconds(isLivePeriod(m)?currentStint(p,m):0)}</div>
    </div>
    <div>
      <div class="metric-label">Acum. campo</div>
      <div class="metric-value">${formatSeconds(accumulatedInNow(p,m))}</div>
    </div>
    <div>
      <div class="metric-label">Acum. fora</div>
      <div class="metric-value">${formatSeconds(accumulatedOutNow(p,m))}</div>
    </div>`;
}
function renderPlayerSections(){
  const m=state.currentMatch;
  const court=document.getElementById("courtPlayers");
  const bench=document.getElementById("benchPlayers");
  court.innerHTML="";bench.innerHTML="";

  const sorted=[...m.team.players].sort((a,b)=>a.number-b.number);

  sorted.filter(p=>p.status==="in").forEach(p=>{
    const btn=document.createElement("button");
    btn.className="player-card in"+(state.selectedPlayerId===p.id?" selected":"");
    btn.innerHTML=playerCardHtml(p,m);
    btn.addEventListener("click",()=>selectPlayerForSub(p.id));
    court.appendChild(btn);
  });

  sorted.filter(p=>p.status==="out").forEach(p=>{
    const btn=document.createElement("button");
    btn.className="player-card out"+(state.selectedPlayerId===p.id?" selected":"");
    btn.innerHTML=playerCardHtml(p,m);
    btn.addEventListener("click",()=>selectPlayerForSub(p.id));
    bench.appendChild(btn);
  });

  document.getElementById("courtCount").textContent=
    `${m.team.players.filter(p=>p.status==="in").length} jogadores`;
}
function selectPlayerForSub(id){
  const m=state.currentMatch;
  if(!m || m.phase==="finished") return;
  const clicked=m.team.players.find(p=>p.id===id);
  if(!clicked) return;

  if(!state.selectedPlayerId){
    state.selectedPlayerId=id;
    renderPlayerSections();
    return;
  }
  if(state.selectedPlayerId===id){
    state.selectedPlayerId=null;
    renderPlayerSections();
    return;
  }

  const first=m.team.players.find(p=>p.id===state.selectedPlayerId);
  if(!first){
    state.selectedPlayerId=id;
    renderPlayerSections();
    return;
  }

  if(first.status===clicked.status){
    state.selectedPlayerId=id;
    renderPlayerSections();
    return;
  }

  switchTwoPlayers(first,clicked,m);
  state.selectedPlayerId=null;
  saveCurrent();
  renderMatch();
}
function renderTimeSummary(){
  const m=state.currentMatch;
  const body=document.getElementById("timeSummaryBody");
  body.innerHTML=[...m.team.players]
    .sort((a,b)=>a.number-b.number)
    .map(p=>`
      <tr>
        <td>${p.number}</td>
        <td>${esc(p.name)}</td>
        <td class="${p.status==="in"?"status-in":"status-out"}">${p.status==="in"?"Em campo":"Fora"}</td>
        <td>${formatSeconds(currentStint(p,m))}</td>
        <td><strong>${formatSeconds(accumulatedInNow(p,m))}</strong></td>
        <td>${formatSeconds(accumulatedOutNow(p,m))}</td>
      </tr>
    `).join("");
}

/* CLOCK / PERIOD / GAME CONTROLS */
document.getElementById("toggleClockBtn").addEventListener("click",()=>{
  const m=state.currentMatch;
  if(!m || m.awaitingResume || m.timeout.active || !isLivePeriod(m) || m.phase==="finished") return;

  if(m.clockMode==="countup" && m.running){
    const ok=confirm("Pausar o relógio corrido?\n\nOs tempos dos jogadores também deixam de acumular até voltares a iniciar.");
    if(!ok) return;
  }

  m.running=!m.running;
  saveCurrent();
  updateClockDisplay();
});

document.getElementById("resumeBtn").addEventListener("click",()=>{
  const m=state.currentMatch;
  if(!m || !m.awaitingResume || m.timeout.active || !isLivePeriod(m)) return;
  m.awaitingResume=false;
  m.running=true;
  saveCurrent();
  renderMatch();
});

function endFirstHalf(){
  const m=state.currentMatch;
  if(!m || m.phase!=="first_half") return;
  if(m.timeout.active) return alert("Termina primeiro o timeout.");

  const ok=confirm(
    "Terminar a 1ª parte?\n\n" +
    "Os tempos da 1ª parte ficam fechados e o jogo entra em intervalo."
  );
  if(!ok) return;

  m.running=false;
  m.awaitingResume=false;
  finalizeAllPlayers(m);
  m.phase="halftime";

  m.events.push({
    id:uid(),
    kind:"period",
    type:"Fim 1ª Parte",
    period:1,
    clockText:mainClockText(m),
    playerClock:m.playerClockSeconds,
    timestamp:new Date().toISOString()
  });

  saveCurrent();
  renderMatch();
}

function startSecondHalf(){
  const m=state.currentMatch;
  if(!m || m.phase!=="halftime") return;

  const ok=confirm(
    "Iniciar a preparação da 2ª parte?\n\n" +
    "O relógio da 2ª parte será reiniciado. Depois carrega em Iniciar para começar a contar."
  );
  if(!ok) return;

  m.period=2;
  m.phase="second_half";
  m.running=false;
  m.awaitingResume=false;
  m.periodClockSeconds=m.clockMode==="countdown" ? m.periodMinutes*60 : 0;
  resetStateStartForAll(m);

  m.events.push({
    id:uid(),
    kind:"period",
    type:"Início 2ª Parte",
    period:2,
    clockText:mainClockText(m),
    playerClock:m.playerClockSeconds,
    timestamp:new Date().toISOString()
  });

  saveCurrent();
  renderMatch();
}

document.getElementById("periodControlBtn").addEventListener("click",()=>{
  const m=state.currentMatch;
  if(!m) return;
  if(m.phase==="first_half") endFirstHalf();
  else if(m.phase==="halftime") startSecondHalf();
});

function saveMatchToHistory(silent=false){
  const m=state.currentMatch;
  if(!m) return;

  const history=JSON.parse(localStorage.getItem(STORAGE.history)||"[]");
  const snap=snapshotMatch();
  const idx=history.findIndex(x=>x.id===snap.id);
  if(idx>=0) history[idx]=snap;
  else history.push(snap);

  localStorage.setItem(STORAGE.history,JSON.stringify(history));
  if(!silent) alert("Jogo guardado.");
}

document.getElementById("finishMatchBtn").addEventListener("click",()=>{
  const m=state.currentMatch;
  if(!m || m.phase==="finished") return;

  const ok=confirm(
    "Terminar o jogo?\n\n" +
    "Os tempos deixam de contar e o jogo será guardado no histórico."
  );
  if(!ok) return;

  if(m.timeout.active){
    m.timeout.active=false;
    m.timeout.remaining=0;
    m.timeout.calledBy=null;
    m.timeout.wasRunning=false;
  }

  m.running=false;
  m.awaitingResume=false;

  if(isLivePeriod(m)){
    finalizeAllPlayers(m);
  }

  m.phase="finished";
  m.finishedAt=new Date().toISOString();

  m.events.push({
    id:uid(),
    kind:"period",
    type:"Fim de Jogo",
    period:m.period,
    clockText:mainClockText(m),
    playerClock:m.playerClockSeconds,
    timestamp:new Date().toISOString()
  });

  saveCurrent();
  saveMatchToHistory(true);
  renderMatch();
});
