/* PLAYER TIME ENGINE */
function ensurePeriodStats(p){
  if(!p.periodStats){
    p.periodStats={"1":{in:0,out:0},"2":{in:0,out:0}};
  }
  if(!p.periodStats["1"]) p.periodStats["1"]={in:0,out:0};
  if(!p.periodStats["2"]) p.periodStats["2"]={in:0,out:0};
}
function currentStint(p,m){
  return Math.max(0,m.playerClockSeconds-p.stateSincePlayerClock);
}
function accumulatedInNow(p,m){
  return p.accumulatedIn+(p.status==="in" && isLivePeriod(m)?currentStint(p,m):0);
}
function accumulatedOutNow(p,m){
  return p.accumulatedOut+(p.status==="out" && isLivePeriod(m)?currentStint(p,m):0);
}
function periodInNow(p,m,period){
  ensurePeriodStats(p);
  const base=p.periodStats[String(period)].in;
  return base + (
    m.period===period && isLivePeriod(m) && p.status==="in"
      ? currentStint(p,m)
      : 0
  );
}
function periodOutNow(p,m,period){
  ensurePeriodStats(p);
  const base=p.periodStats[String(period)].out;
  return base + (
    m.period===period && isLivePeriod(m) && p.status==="out"
      ? currentStint(p,m)
      : 0
  );
}
function isLivePeriod(m){
  return m.phase==="first_half" || m.phase==="second_half";
}
function finalizePlayerState(p,m){
  if(!isLivePeriod(m)){
    p.stateSincePlayerClock=m.playerClockSeconds;
    return;
  }

  ensurePeriodStats(p);
  const stint=currentStint(p,m);
  const ps=p.periodStats[String(m.period)];

  if(p.status==="in"){
    p.accumulatedIn+=stint;
    ps.in+=stint;
  }else{
    p.accumulatedOut+=stint;
    ps.out+=stint;
  }

  p.stateSincePlayerClock=m.playerClockSeconds;
}
function finalizeAllPlayers(m){
  m.team.players.forEach(p=>finalizePlayerState(p,m));
}
function resetStateStartForAll(m){
  m.team.players.forEach(p=>{
    ensurePeriodStats(p);
    p.stateSincePlayerClock=m.playerClockSeconds;
  });
}
function switchTwoPlayers(a,b,m){
  if(a.status===b.status || m.phase==="finished") return false;

  finalizePlayerState(a,m);
  finalizePlayerState(b,m);

  let outPlayer,inPlayer;
  if(a.status==="in"){
    outPlayer=a;inPlayer=b;
  }else{
    outPlayer=b;inPlayer=a;
  }

  outPlayer.status="out";
  outPlayer.substitutionsOut++;
  inPlayer.status="in";
  inPlayer.substitutionsIn++;

  const eventPeriod=m.phase==="halftime" ? "INT" : m.period;
  m.events.push({
    id:uid(),
    kind:"substitution",
    period:eventPeriod,
    clockText:m.phase==="halftime" ? "Intervalo" : mainClockText(m),
    playerClock:m.playerClockSeconds,
    outPlayerId:outPlayer.id,
    inPlayerId:inPlayer.id,
    outPlayer:outPlayer.name,
    inPlayer:inPlayer.name,
    timestamp:new Date().toISOString()
  });
  return true;
}

/* MATCH CLOCK */
function mainClockText(m){
  return formatSeconds(m.periodClockSeconds);
}
function clockModeLabel(m){
  return m.clockMode==="countup" ? "Corrido · ↑" : "Cronometrado · ↓";
}
function canPlayersAccumulate(m){
  return m.running && !m.timeout.active && !m.awaitingResume;
}
function tick(){
  const m=state.currentMatch;
  if(!m) return;

  if(m.timeout.active){
    if(m.timeout.remaining>0) m.timeout.remaining--;

    if(m.clockMode==="countup" && m.timeout.wasRunning){
      m.periodClockSeconds++;
    }

    if(m.timeout.remaining<=0){
      finishTimeout(m);
    }

    updateClockDisplay();
    renderPlayerSections();
    renderTimeSummary();

    if(Date.now()%5<1000) saveCurrent();
    return;
  }

  if(m.running && !m.awaitingResume && isLivePeriod(m)){
    if(m.clockMode==="countup"){
      m.periodClockSeconds++;
      m.playerClockSeconds++;
    }else{
      if(m.periodClockSeconds>0){
        m.periodClockSeconds--;
        m.playerClockSeconds++;
      }
      if(m.periodClockSeconds<=0){
        m.periodClockSeconds=0;
        m.running=false;
      }
    }

    updateClockDisplay();
    renderPlayerSections();
    renderTimeSummary();

    if(m.playerClockSeconds%5===0) saveCurrent();
  }
}
function startTimer(){
  clearInterval(state.timer);
  state.timer=setInterval(tick,1000);
}
function startTimeout(side){
  const m=state.currentMatch;
  if(!m || m.timeout.active || !isLivePeriod(m)) return;

  m.timeout.active=true;
  m.timeout.remaining=60;
  m.timeout.calledBy=side;
  m.timeout.wasRunning=m.running;

  if(m.clockMode==="countdown"){
    m.running=false;
  }

  m.events.push({
    id:uid(),
    kind:"timeout",
    side,
    period:m.period,
    clockText:mainClockText(m),
    playerClock:m.playerClockSeconds,
    timestamp:new Date().toISOString()
  });

  saveCurrent();
  renderMatch();
}
function finishTimeout(m){
  m.timeout.active=false;
  m.timeout.remaining=0;

  if(m.clockMode==="countdown"){
    m.awaitingResume=true;
    m.running=false;
  }else{
    m.running=m.timeout.wasRunning;
    m.awaitingResume=false;
  }

  m.timeout.calledBy=null;
  m.timeout.wasRunning=false;
  saveCurrent();
  renderMatch();
}
