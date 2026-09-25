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
    "número",
    "jogador",
    "posição",
    "tempo campo 1ª parte",
    "tempo fora 1ª parte",
    "tempo campo 2ª parte",
    "tempo fora 2ª parte",
    "tempo campo total",
    "tempo fora total",
    "estado atual",
    "tempo estado atual",
    "entradas",
    "saídas"
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

  const csv="\uFEFF"+rows.map(r=>r.map(csvEscape).join(";")).join("\r\n");
  download(
    `tempos_por_parte_${safeFileName(m.team.name)}_${m.date||"jogo"}.csv`,
    csv,
    "text/csv;charset=utf-8"
  );
});
document.getElementById("exportEventsBtn").addEventListener("click",()=>{
  const m=state.currentMatch;
  if(!m) return;

  const rows=[["período","relógio jogo","tempo jogadores","tipo","equipa","número jogador","jogador","detalhe"]];

  m.events.forEach(e=>{
    if(e.kind==="substitution"){
      rows.push([
        e.period,e.clockText,formatSeconds(e.playerClock),
        "Substituição",m.team.name,"","",
        `Sai ${e.outPlayer}; Entra ${e.inPlayer}`
      ]);
    }else if(e.kind==="timeout"){
      rows.push([
        e.period,e.clockText,formatSeconds(e.playerClock),
        "Timeout",e.side==="tracked"?m.team.name:m.opponent.name,"","","60 segundos"
      ]);
    }else{
      rows.push([
        e.period,e.clockText||"",formatSeconds(e.playerClock||0),
        e.type||e.kind,
        e.side==="tracked"?m.team.name:(e.side==="opponent"?m.opponent.name:""),
        e.playerNumber??"",
        e.playerName??"",
        ""
      ]);
    }
  });

  const csv="\uFEFF"+rows.map(r=>r.map(csvEscape).join(";")).join("\r\n");
  download(`eventos_${m.date||"jogo"}.csv`,csv,"text/csv;charset=utf-8");
});
function jpgEventCount(m,type,playerId=null){
  return m.events.filter(e=>
    e.kind==="teamAction" &&
    e.side==="tracked" &&
    e.type===type &&
    (playerId===null || e.playerId===playerId)
  ).length;
}

function jpgTeamEventCount(m,side,type){
  return m.events.filter(e=>
    e.kind==="teamAction" &&
    e.side===side &&
    e.type===type
  ).length;
}

function jpgPlayerCards(m,playerId){
  const yellows=jpgEventCount(m,"Cartão amarelo",playerId);
  const reds=jpgEventCount(m,"Cartão vermelho",playerId);
  if(reds) return "2A/V";
  if(yellows>=2) return "2A/V";
  if(yellows===1) return "A";
  return "—";
}

function canvasRoundRect(ctx,x,y,w,h,r,fill,stroke=null){
  const radius=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+radius,y);
  ctx.arcTo(x+w,y,x+w,y+h,radius);
  ctx.arcTo(x+w,y+h,x,y+h,radius);
  ctx.arcTo(x,y+h,x,y,radius);
  ctx.arcTo(x,y,x+w,y,radius);
  ctx.closePath();
  if(fill){
    ctx.fillStyle=fill;
    ctx.fill();
  }
  if(stroke){
    ctx.strokeStyle=stroke;
    ctx.lineWidth=1;
    ctx.stroke();
  }
}

function canvasFitText(ctx,text,maxWidth){
  const value=String(text??"");
  if(ctx.measureText(value).width<=maxWidth) return value;
  let out=value;
  while(out.length>1 && ctx.measureText(out+"…").width>maxWidth){
    out=out.slice(0,-1);
  }
  return out+"…";
}

function downloadCanvasJpeg(canvas,fileName){
  canvas.toBlob(blob=>{
    if(!blob) return alert("Não foi possível gerar a imagem JPG.");
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  },"image/jpeg",0.94);
}

function exportMatchJpg(){
  const m=state.currentMatch;
  if(!m) return;

  const width=1600;
  const height=1000;
  const canvas=document.createElement("canvas");
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext("2d");

  const bg="#242424";
  const panel="#303030";
  const panel2="#373737";
  const line="#4a4a4a";
  const white="#f5f7fa";
  const muted="#aeb7c1";
  const accent="#f97316";
  const blue="#9fc7e8";

  ctx.fillStyle=bg;
  ctx.fillRect(0,0,width,height);

  // Header
  ctx.fillStyle=accent;
  ctx.fillRect(0,0,width,12);

  ctx.fillStyle=white;
  ctx.font="700 28px Arial, sans-serif";
  ctx.fillText("FUTSAL TIME TRACKER",60,58);

  ctx.fillStyle=muted;
  ctx.font="20px Arial, sans-serif";
  const meta=[m.competition,m.date].filter(Boolean).join(" · ");
  ctx.fillText(meta || "Resumo do jogo",60,92);

  // Score
  ctx.textAlign="center";
  ctx.fillStyle=white;
  ctx.font="700 34px Arial, sans-serif";
  ctx.fillText(canvasFitText(ctx,m.team.name,470),455,82);
  ctx.fillText(canvasFitText(ctx,m.opponent.name,470),1145,82);

  ctx.font="900 82px Arial, sans-serif";
  ctx.fillText(String(m.team.score),650,108);
  ctx.fillStyle=muted;
  ctx.font="700 38px Arial, sans-serif";
  ctx.fillText("—",800,100);
  ctx.fillStyle=white;
  ctx.font="900 82px Arial, sans-serif";
  ctx.fillText(String(m.opponent.score),950,108);

  ctx.fillStyle=blue;
  ctx.font="700 22px Arial, sans-serif";
  const periodText=m.phase==="finished"
    ? "Jogo terminado"
    : (m.period===1?"1ª Parte":"2ª Parte");
  ctx.fillText(periodText+" · "+mainClockText(m)+" · "+(m.clockMode==="countup"?"Corrido":"Cronometrado"),800,145);
  ctx.textAlign="left";

  // Team statistics
  const statY=178;
  canvasRoundRect(ctx,50,statY,1500,160,18,panel,line);

  ctx.fillStyle=white;
  ctx.font="700 22px Arial, sans-serif";
  ctx.fillText("ESTATÍSTICAS",80,215);

  const stats=[
    ["Remates",jpgTeamEventCount(m,"tracked","Remate"),jpgTeamEventCount(m,"opponent","Remate")],
    ["Enquadrados",jpgTeamEventCount(m,"tracked","Remate enquadrado"),jpgTeamEventCount(m,"opponent","Remate enquadrado")],
    ["Faltas",jpgTeamEventCount(m,"tracked","Falta"),jpgTeamEventCount(m,"opponent","Falta")],
    ["Amarelos",jpgTeamEventCount(m,"tracked","Cartão amarelo"),jpgTeamEventCount(m,"opponent","Cartão amarelo")],
    ["Vermelhos",jpgTeamEventCount(m,"tracked","Cartão vermelho"),jpgTeamEventCount(m,"opponent","Cartão vermelho")],
    ["Timeouts",
      m.events.filter(e=>e.kind==="timeout"&&e.side==="tracked").length,
      m.events.filter(e=>e.kind==="timeout"&&e.side==="opponent").length]
  ];

  const statStartX=80;
  const statGap=238;
  stats.forEach((row,i)=>{
    const x=statStartX+i*statGap;
    ctx.fillStyle=panel2;
    canvasRoundRect(ctx,x,235,210,78,12,panel2);
    ctx.textAlign="center";
    ctx.fillStyle=white;
    ctx.font="700 26px Arial, sans-serif";
    ctx.fillText(String(row[1])+"  ·  "+String(row[2]),x+105,267);
    ctx.fillStyle=muted;
    ctx.font="16px Arial, sans-serif";
    ctx.fillText(row[0],x+105,294);
  });
  ctx.textAlign="left";

  // Players table
  const tableY=365;
  const tableH=565;
  canvasRoundRect(ctx,50,tableY,1500,tableH,18,panel,line);

  ctx.fillStyle=white;
  ctx.font="700 22px Arial, sans-serif";
  ctx.fillText("JOGADORES",80,404);

  const players=[...m.team.players].sort((a,b)=>Number(a.number)-Number(b.number));
  const columns=players.length>10?2:1;
  const perColumn=Math.ceil(players.length/columns);
  const colWidth=columns===2?720:1440;
  const rowHeight=Math.min(46,Math.floor(480/Math.max(1,perColumn)));
  const startY=450;

  for(let col=0;col<columns;col++){
    const x=80+col*(colWidth+20);
    const slice=players.slice(col*perColumn,(col+1)*perColumn);

    ctx.fillStyle=muted;
    ctx.font="700 14px Arial, sans-serif";
    ctx.fillText("#",x,startY-14);
    ctx.fillText("JOGADOR",x+45,startY-14);
    ctx.fillText("TEMPO",x+330,startY-14);
    ctx.fillText("G",x+430,startY-14);
    ctx.fillText("R",x+475,startY-14);
    ctx.fillText("RE",x+520,startY-14);
    ctx.fillText("F",x+575,startY-14);
    ctx.fillText("CART.",x+620,startY-14);

    slice.forEach((p,rowIndex)=>{
      const y=startY+rowIndex*rowHeight;
      const isOdd=rowIndex%2===0;
      if(isOdd){
        ctx.fillStyle="#343434";
        ctx.fillRect(x-8,y-26,colWidth-12,rowHeight-2);
      }

      ctx.fillStyle=white;
      ctx.font="700 17px Arial, sans-serif";
      ctx.fillText(String(p.number),x,y);

      ctx.font="17px Arial, sans-serif";
      ctx.fillText(canvasFitText(ctx,p.name,255),x+45,y);

      ctx.font="700 17px Arial, sans-serif";
      ctx.fillText(formatSeconds(accumulatedInNow(p,m)),x+330,y);
      ctx.fillText(String(jpgEventCount(m,"Golo",p.id)),x+430,y);
      ctx.fillText(String(jpgEventCount(m,"Remate",p.id)),x+475,y);
      ctx.fillText(String(jpgEventCount(m,"Remate enquadrado",p.id)),x+520,y);
      ctx.fillText(String(jpgEventCount(m,"Falta",p.id)),x+575,y);

      const cards=jpgPlayerCards(m,p.id);
      ctx.fillStyle=cards==="—"?muted:(cards==="A"?"#f2c94c":"#ff6868");
      ctx.fillText(cards,x+620,y);
    });
  }

  ctx.fillStyle=muted;
  ctx.font="14px Arial, sans-serif";
  ctx.fillText("G = golos · R = remates · RE = remates enquadrados · F = faltas · A = amarelo · V = vermelho",80,960);

  ctx.textAlign="right";
  ctx.fillText("Gerado pelo Futsal Time Tracker",1520,960);
  ctx.textAlign="left";

  const name="resumo_"+safeFileName(m.team.name)+"_"+(m.date||"jogo")+".jpg";
  downloadCanvasJpeg(canvas,name);
}

document.getElementById("exportJpgBtn").addEventListener("click",exportMatchJpg);

document.getElementById("clearMatchBtn").addEventListener("click",()=>{
  if(!state.currentMatch) return;
  if(!confirm("Limpar o jogo ativo? Guarda primeiro se quiseres manter os dados.")) return;
  state.currentMatch=null;
  state.selectedPlayerId=null;
  saveCurrent();
  renderMatch();
});
