/* EVENTS */
const PLAYER_EVENTS = new Set(["Golo","Falta","Cartão amarelo","Cartão vermelho"]);
const SELECTED_PLAYER_EVENTS = new Set(["Remate","Remate enquadrado"]);
let pendingPlayerEvent=null;

function getPlayerYellowCount(m,playerId){
  return m.events.filter(e=>
    e.kind==="teamAction" &&
    e.side==="tracked" &&
    e.type==="Cartão amarelo" &&
    e.playerId===playerId
  ).length;
}
function playerHasRed(m,playerId){
  return m.events.some(e=>
    e.kind==="teamAction" &&
    e.side==="tracked" &&
    e.type==="Cartão vermelho" &&
    e.playerId===playerId
  );
}
function playerDiscipline(m,playerId){
  return {
    yellows:getPlayerYellowCount(m,playerId),
    red:playerHasRed(m,playerId)
  };
}

function pushTeamAction(side,type,player=null,extra={}){
  const m=state.currentMatch;
  if(!m) return null;

  const event={
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
    timestamp:new Date().toISOString(),
    ...extra
  };
  m.events.push(event);
  return event;
}

function sendOffTrackedPlayer(player,reason,actionGroupId){
  const m=state.currentMatch;
  if(!m || !player || player.status==="sentoff") return null;

  const previousStatus=player.status;
  finalizePlayerState(player,m);

  let penaltyId=null;
  if(previousStatus==="in"){
    penaltyId=startNumericalPenalty(m,player);
  }

  player.status="sentoff";
  player.stateSincePlayerClock=m.playerClockSeconds;

  return pushTeamAction("tracked","Cartão vermelho",player,{
    reason,
    actionGroupId,
    previousStatus,
    penaltyId
  });
}

function maybeReleaseForOpponentGoal(){
  const m=state.currentMatch;
  if(!m || !activeNumericalPenalties(m).length) return;

  const ok=confirm(
    "A nossa equipa está em inferioridade numérica.\n\n" +
    "Este golo sofrido termina uma penalização e permite a entrada de um suplente?"
  );
  if(ok){
    releaseOldestNumericalPenalty(m,"goal");
  }
}

function recordSelectedPlayerAction(type){
  const m=state.currentMatch;
  if(!m) return;

  if(!state.selectedPlayerId){
    recordTeamAction("tracked",type,null);
    return;
  }

  const player=m.team.players.find(p=>p.id===state.selectedPlayerId);

  if(!player || player.status!=="in"){
    alert("Para associar o remate, seleciona primeiro um jogador que esteja em campo.");
    return;
  }

  state.selectedPlayerId=null;
  recordTeamAction("tracked",type,player);
}

function recordTeamAction(side,type,player=null){
  const m=state.currentMatch;
  if(!m) return;

  if(type==="Golo"){
    if(side==="tracked") m.team.score++;
    else m.opponent.score++;
  }

  pushTeamAction(side,type,player);

  if(side==="opponent" && type==="Golo"){
    maybeReleaseForOpponentGoal();
  }

  saveCurrent();
  closePlayerEventModal();
  renderMatch();
}

function handleTrackedPlayerEvent(type,player){
  const m=state.currentMatch;
  if(!m || !player || player.status==="sentoff") return;

  if(type==="Cartão vermelho"){
    const ok=confirm(
      `Confirmar expulsão de #${player.number} ${player.name}?\n\n` +
      (player.status==="in"
        ? `A equipa ficará em inferioridade durante ${m.clockMode==="countdown"?"2":"3"} minutos ou até sofrer um golo.`
        : "O jogador fica expulso e não poderá entrar em campo.")
    );
    if(!ok) return;

    const group=uid();
    sendOffTrackedPlayer(player,"direct",group);
    saveCurrent();
    closePlayerEventModal();
    renderMatch();
    return;
  }

  if(type==="Cartão amarelo"){
    const yellows=getPlayerYellowCount(m,player.id);

    if(yellows>=1){
      const ok=confirm(
        `Este é o 2.º amarelo de #${player.number} ${player.name}.\n\n` +
        "O jogador será expulso. Confirmar?"
      );
      if(!ok) return;

      const group=uid();
      pushTeamAction("tracked","Cartão amarelo",player,{actionGroupId:group});
      sendOffTrackedPlayer(player,"secondYellow",group);
      saveCurrent();
      closePlayerEventModal();
      renderMatch();
      return;
    }

    pushTeamAction("tracked","Cartão amarelo",player);
    saveCurrent();
    closePlayerEventModal();
    renderMatch();
    return;
  }

  recordTeamAction("tracked",type,player);
}

function openPlayerEventModal(type){
  const m=state.currentMatch;
  if(!m) return;

  pendingPlayerEvent={side:"tracked",type};

  const modal=document.getElementById("playerEventModal");
  const title=document.getElementById("playerEventTitle");
  const options=document.getElementById("playerEventOptions");

  const titles={
    "Golo":"Quem marcou o golo?",
    "Falta":"Quem fez a falta?",
    "Cartão amarelo":"Quem recebeu o amarelo?",
    "Cartão vermelho":"Quem recebeu o vermelho?"
  };
  title.textContent=titles[type] || type;
  options.innerHTML="";

  const courtOnly=type==="Golo" || type==="Falta";
  const available=(courtOnly
    ? m.team.players.filter(p=>p.status==="in")
    : m.team.players.filter(p=>p.status!=="sentoff")
  );

  const sorted=[...available].sort((a,b)=>{
    if(a.status!==b.status) return a.status==="in" ? -1 : 1;
    return Number(a.number)-Number(b.number);
  });

  sorted.forEach(p=>{
    const discipline=playerDiscipline(m,p.id);
    const cardText=
      (discipline.yellows ? ` · 🟨${discipline.yellows>1?"×"+discipline.yellows:""}` : "") +
      (discipline.red ? " · 🟥" : "");

    const btn=document.createElement("button");
    btn.className="event-player-option "+(p.status==="in"?"is-court":"is-bench");
    btn.innerHTML=
      `<strong>#${p.number} — ${esc(p.name)}</strong>`+
      `<span>${p.status==="in"?"Em campo":"Suplente"}${cardText}</span>`;
    btn.addEventListener("click",()=>handleTrackedPlayerEvent(type,p));
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

    if(side==="tracked" && SELECTED_PLAYER_EVENTS.has(type)){
      recordSelectedPlayerAction(type);
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

  if(e.kind==="teamAction" && e.type==="Cartão vermelho" && e.penaltyId){
    const penalty=m.numericalPenalties?.find(p=>p.id===e.penaltyId);
    if(penalty && !penalty.active){
      return alert("Esta expulsão já terminou a penalização. Não pode ser desfeita automaticamente.");
    }
  }

  const group=e.actionGroupId || null;
  const undoEvents=[];
  if(group){
    while(m.events.length && m.events[m.events.length-1].actionGroupId===group){
      undoEvents.push(m.events.pop());
    }
  }else{
    undoEvents.push(m.events.pop());
  }

  undoEvents.forEach(event=>{
    if(event.kind==="teamAction" && event.type==="Golo"){
      if(event.side==="tracked") m.team.score=Math.max(0,m.team.score-1);
      else m.opponent.score=Math.max(0,m.opponent.score-1);
    }

    if(event.kind==="teamAction" && event.type==="Cartão vermelho" && event.side==="tracked"){
      restorePlayerAfterUndoRed(m,event);
    }

    if(event.kind==="substitution"){
      const pin=m.team.players.find(p=>p.id===event.inPlayerId);
      const pout=m.team.players.find(p=>p.id===event.outPlayerId);
      if(pin && pout && pin.status==="in" && pout.status==="out"){
        finalizePlayerState(pin,m);
        finalizePlayerState(pout,m);
        pin.status="out";
        pout.status="in";
        pin.substitutionsOut++;
        pout.substitutionsIn++;
      }
    }
  });

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

    if(e.kind==="redReplacement"){
      return `
        <div class="event">
          <div class="event-time">${e.period}P ${e.clockText}</div>
          <div><strong>Reposição após expulsão</strong><div class="small muted">Entra #${e.playerNumber} ${esc(e.playerName)}</div></div>
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

    const reason=e.type==="Cartão vermelho" && e.reason==="secondYellow"
      ? " · 2.º amarelo"
      : "";

    return `
      <div class="event">
        <div class="event-time">${e.period}P ${e.clockText}</div>
        <div><strong>${esc(e.type)}${reason}</strong><div class="small muted">${playerText}</div></div>
      </div>`;
  }).join("");
}
