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
  }else if(p.status==="out"){
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
  if(a.status==="sentoff" || b.status==="sentoff") return false;
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

/* NUMERICAL REDUCTION AFTER A SENDING-OFF */
function ensureNumericalState(m){
  if(!Array.isArray(m.numericalPenalties)) m.numericalPenalties=[];
  if(!Number.isFinite(m.pendingReplacements)) m.pendingReplacements=0;
}
function numericalPenaltyDuration(m){
  return m.clockMode==="countdown" ? 120 : 180;
}
function activeNumericalPenalties(m){
  ensureNumericalState(m);
  return m.numericalPenalties.filter(p=>p.active);
}
function startNumericalPenalty(m,player){
  ensureNumericalState(m);
  const penalty={
    id:uid(),
    playerId:player.id,
    playerName:player.name,
    playerNumber:player.number,
    duration:numericalPenaltyDuration(m),
    remaining:numericalPenaltyDuration(m),
    active:true,
    startedPeriod:m.period,
    startedClock:mainClockText(m),
    endedReason:null
  };
  m.numericalPenalties.push(penalty);
  return penalty.id;
}
function finishNumericalPenalty(m,penalty,reason){
  if(!penalty || !penalty.active) return false;
  penalty.active=false;
  penalty.remaining=0;
  penalty.endedReason=reason;
  m.pendingReplacements=(m.pendingReplacements||0)+1;
  return true;
}
function tickNumericalPenalties(m){
  ensureNumericalState(m);
  m.numericalPenalties.filter(p=>p.active).forEach(p=>{
    p.remaining=Math.max(0,p.remaining-1);
    if(p.remaining===0) finishNumericalPenalty(m,p,"time");
  });
}
function releaseOldestNumericalPenalty(m,reason="goal"){
  ensureNumericalState(m);
  const penalty=m.numericalPenalties.find(p=>p.active);
  if(!penalty) return false;
  return finishNumericalPenalty(m,penalty,reason);
}
function removeNumericalPenalty(m,penaltyId){
  ensureNumericalState(m);
  const penalty=m.numericalPenalties.find(p=>p.id===penaltyId);
  if(!penalty) return;
  if(!penalty.active && m.pendingReplacements>0){
    m.pendingReplacements=Math.max(0,m.pendingReplacements-1);
  }
  m.numericalPenalties=m.numericalPenalties.filter(p=>p.id!==penaltyId);
}
function restorePlayerAfterUndoRed(m,event){
  const player=m.team.players.find(p=>p.id===event.playerId);
  if(!player) return;
  if(event.penaltyId) removeNumericalPenalty(m,event.penaltyId);
  player.status=event.previousStatus || "out";
  player.stateSincePlayerClock=event.playerClock;
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
      tickNumericalPenalties(m);
    }

    if(m.timeout.remaining<=0){
      finishTimeout(m);
    }

    updateClockDisplay();
    renderPlayerSections();
    renderTimeSummary();
    renderNumericalPenalty();

    if(Date.now()%5<1000) saveCurrent();
    return;
  }

  if(m.running && !m.awaitingResume && isLivePeriod(m)){
    if(m.clockMode==="countup"){
      m.periodClockSeconds++;
      m.playerClockSeconds++;
      tickNumericalPenalties(m);
    }else{
      if(m.periodClockSeconds>0){
        m.periodClockSeconds--;
        m.playerClockSeconds++;
        tickNumericalPenalties(m);
      }
      if(m.periodClockSeconds<=0){
        m.periodClockSeconds=0;
        m.running=false;
      }
    }

    updateClockDisplay();
    renderPlayerSections();
    renderTimeSummary();
    renderNumericalPenalty();

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
