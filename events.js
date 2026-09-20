/* EVENTS */
const PLAYER_EVENTS = new Set(["Golo","Falta","Cartão amarelo","Cartão vermelho"]);
let pendingPlayerEvent=null;

function recordTeamAction(side,type,player=null){
  const m=state.currentMatch;
  if(!m) return;

  if(type==="Golo"){
    if(side==="tracked") m.team.score++;
    else m.opponent.score++;
  }

  m.events.push({
    id:uid(),
    kind:"teamAction",
    side,
    type,
    playerId:player?.id || null,
    playerName:player?.name || null,
    playerNumber:player?.number ?? null,
    period:m.period,
    clockText:mainClockText(m),
    playerClock:m.playerClockSeconds,
    timestamp:new Date().toISOString()
  });

  saveCurrent();
  closePlayerEventModal();
  renderMatch();
}

function openPlayerEventModal(type){
  const m=state.currentMatch;
  if(!m) return;

  pendingPlayerEvent={side:"tracked",type};

  const modal=document.getElementById("playerEventModal");
  const title=document.getElementById("playerEventTitle");
  const options=document.getElementById("playerEventOptions");

  title.textContent=type;
  options.innerHTML="";

  const sorted=[...m.team.players].sort((a,b)=>{
    if(a.status!==b.status) return a.status==="in" ? -1 : 1;
    return Number(a.number)-Number(b.number);
  });

  sorted.forEach(p=>{
    const btn=document.createElement("button");
    btn.className="event-player-option "+(p.status==="in"?"is-court":"is-bench");
    btn.innerHTML=
      `<strong>#${p.number} — ${esc(p.name)}</strong>`+
      `<span>${p.status==="in"?"Em campo":"Suplente"}</span>`;
    btn.addEventListener("click",()=>recordTeamAction("tracked",type,p));
    options.appendChild(btn);
  });

  modal.classList.remove("hidden");
}

function closePlayerEventModal(){
  pendingPlayerEvent=null;
  document.getElementById("playerEventModal")?.classList.add("hidden");
}

document.getElementById("cancelPlayerEventBtn").addEventListener("click",closePlayerEventModal);
document.getElementById("playerEventModal").addEventListener("click",(e)=>{
  if(e.target.id==="playerEventModal") closePlayerEventModal();
});

document.querySelectorAll("[data-side][data-event]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const m=state.currentMatch;
    if(!m) return;

    const side=btn.dataset.side;
    const type=btn.dataset.event;

    if(side==="tracked" && PLAYER_EVENTS.has(type)){
      openPlayerEventModal(type);
      return;
    }

    recordTeamAction(side,type,null);
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

  saveCurrent();
  renderMatch();
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
    const playerText=e.playerName
      ? `#${e.playerNumber} ${esc(e.playerName)} · ${esc(sideName)}`
      : esc(sideName);

    return `
      <div class="event">
        <div class="event-time">${e.period}P ${e.clockText}</div>
        <div><strong>${esc(e.type)}</strong><div class="small muted">${playerText}</div></div>
      </div>`;
  }).join("");
}
