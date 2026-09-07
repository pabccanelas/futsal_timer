/* EVENTS */
document.querySelectorAll("[data-side][data-event]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const m=state.currentMatch;
    if(!m) return;

    const side=btn.dataset.side;
    const type=btn.dataset.event;

    if(type==="Golo"){
      if(side==="tracked") m.team.score++;
      else m.opponent.score++;
    }

    m.events.push({
      id:uid(),
      kind:"teamAction",
      side,type,
      period:m.period,
      clockText:mainClockText(m),
      playerClock:m.playerClockSeconds,
      timestamp:new Date().toISOString()
    });

    saveCurrent();renderMatch();
  });
});
document.querySelectorAll("[data-timeout-side]").forEach(btn=>{
  btn.addEventListener("click",()=>startTimeout(btn.dataset.timeoutSide));
});

document.getElementById("undoEventBtn").addEventListener("click",()=>{
  const m=state.currentMatch;
  if(!m || !m.events.length) return;
  const e=m.events[m.events.length-1];

  if(e.kind==="timeout" && m.timeout.active){
    return alert("Não é possível desfazer um timeout enquanto está a decorrer.");
  }

  m.events.pop();

  if(e.kind==="teamAction" && e.type==="Golo"){
    if(e.side==="tracked") m.team.score=Math.max(0,m.team.score-1);
    else m.opponent.score=Math.max(0,m.opponent.score-1);
  }

  if(e.kind==="substitution"){
    const pin=m.team.players.find(p=>p.id===e.inPlayerId);
    const pout=m.team.players.find(p=>p.id===e.outPlayerId);
    if(pin && pout && pin.status==="in" && pout.status==="out"){
      finalizePlayerState(pin,m);
      finalizePlayerState(pout,m);
      pin.status="out";
      pout.status="in";
      pin.substitutionsOut++;
      pout.substitutionsIn++;
    }
  }

  saveCurrent();renderMatch();
});
function renderEvents(){
  const m=state.currentMatch;
  const log=document.getElementById("eventLog");

  if(!m.events.length){
    log.innerHTML=`<div class="notice">Ainda não existem eventos.</div>`;
    return;
  }

  log.innerHTML=[...m.events].reverse().map(e=>{
    if(e.kind==="substitution"){
      return `
        <div class="event">
          <div class="event-time">${e.period==="INT"?"INT":e.period+"P"} ${e.clockText}</div>
          <div><strong>Substituição</strong><div class="small muted">Sai ${esc(e.outPlayer)} · Entra ${esc(e.inPlayer)}</div></div>
        </div>`;
    }
    if(e.kind==="timeout"){
      const sideName=e.side==="tracked"?m.team.name:m.opponent.name;
      return `
        <div class="event">
          <div class="event-time">${e.period==="INT"?"INT":e.period+"P"} ${e.clockText}</div>
          <div><strong>Timeout</strong><div class="small muted">${esc(sideName)}</div></div>
        </div>`;
    }
    if(e.kind==="period"){
      return `
        <div class="event">
          <div class="event-time">${e.period}P ${e.clockText||""}</div>
          <div><strong>${esc(e.type)}</strong></div>
        </div>`;
    }
    const sideName=e.side==="tracked"?m.team.name:m.opponent.name;
    return `
      <div class="event">
        <div class="event-time">${e.period}P ${e.clockText}</div>
        <div><strong>${esc(e.type)}</strong><div class="small muted">${esc(sideName)}</div></div>
      </div>`;
  }).join("");
}
