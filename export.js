/* SAVE / EXPORT */
function snapshotMatch(){
  const m=JSON.parse(JSON.stringify(state.currentMatch));
  m.team.players=m.team.players.map(p=>{
    const original=state.currentMatch.team.players.find(x=>x.id===p.id);
    ensurePeriodStats(original);

    p.finalAccumulatedIn=accumulatedInNow(original,state.currentMatch);
    p.finalAccumulatedOut=accumulatedOutNow(original,state.currentMatch);
    p.currentStint=isLivePeriod(state.currentMatch)?currentStint(original,state.currentMatch):0;

    p.period1In=periodInNow(original,state.currentMatch,1);
    p.period1Out=periodOutNow(original,state.currentMatch,1);
    p.period2In=periodInNow(original,state.currentMatch,2);
    p.period2Out=periodOutNow(original,state.currentMatch,2);
    return p;
  });
  return m;
}
document.getElementById("saveMatchBtn").addEventListener("click",()=>{
  saveMatchToHistory(false);
});
document.getElementById("exportTimesBtn").addEventListener("click",()=>{
  const m=state.currentMatch;
  if(!m) return;

  const rows=[[
    "numero",
    "jogador",
    "posicao",
    "tempo_campo_1_parte",
    "tempo_fora_1_parte",
    "tempo_campo_2_parte",
    "tempo_fora_2_parte",
    "tempo_campo_total",
    "tempo_fora_total",
    "estado_atual",
    "tempo_estado_atual",
    "entradas",
    "saidas"
  ]];

  [...m.team.players].sort((a,b)=>a.number-b.number).forEach(p=>{
    ensurePeriodStats(p);
    rows.push([
      p.number,
      p.name,
      p.position,
      formatSeconds(periodInNow(p,m,1)),
      formatSeconds(periodOutNow(p,m,1)),
      formatSeconds(periodInNow(p,m,2)),
      formatSeconds(periodOutNow(p,m,2)),
      formatSeconds(accumulatedInNow(p,m)),
      formatSeconds(accumulatedOutNow(p,m)),
      p.status,
      formatSeconds(isLivePeriod(m)?currentStint(p,m):0),
      p.substitutionsIn,
      p.substitutionsOut
    ]);
  });

  const csv=rows.map(r=>r.map(csvEscape).join(";")).join("\n");
  download(
    `tempos_por_parte_${safeFileName(m.team.name)}_${m.date||"jogo"}.csv`,
    csv,
    "text/csv;charset=utf-8"
  );
});
document.getElementById("exportEventsBtn").addEventListener("click",()=>{
  const m=state.currentMatch;
  if(!m) return;

  const rows=[["periodo","relogio_jogo","tempo_jogadores","tipo","equipa","detalhe"]];

  m.events.forEach(e=>{
    if(e.kind==="substitution"){
      rows.push([
        e.period,e.clockText,formatSeconds(e.playerClock),
        "Substituição",m.team.name,
        `Sai ${e.outPlayer}; Entra ${e.inPlayer}`
      ]);
    }else if(e.kind==="timeout"){
      rows.push([
        e.period,e.clockText,formatSeconds(e.playerClock),
        "Timeout",e.side==="tracked"?m.team.name:m.opponent.name,"60 segundos"
      ]);
    }else{
      rows.push([
        e.period,e.clockText||"",formatSeconds(e.playerClock||0),
        e.type||e.kind,
        e.side==="tracked"?m.team.name:(e.side==="opponent"?m.opponent.name:""),
        ""
      ]);
    }
  });

  const csv=rows.map(r=>r.map(csvEscape).join(";")).join("\n");
  download(`eventos_${m.date||"jogo"}.csv`,csv,"text/csv;charset=utf-8");
});
document.getElementById("clearMatchBtn").addEventListener("click",()=>{
  if(!state.currentMatch) return;
  if(!confirm("Limpar o jogo ativo? Guarda primeiro se quiseres manter os dados.")) return;
  state.currentMatch=null;
  state.selectedPlayerId=null;
  saveCurrent();
  renderMatch();
});
