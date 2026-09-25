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
  if(reds && yellows>=2) return "2A/V";
  if(reds && yellows===1) return "A/V";
  if(reds) return "V";
  if(yellows>=2) return "2A";
  if(yellows===1) return "A";
  return "—";
}

function jpgPlayerStatus(p){
  if(p.status==="in") return "Em campo";
  if(p.status==="sentoff") return "Expulso";
  return "Fora";
}

function jpgKeyEvents(m){
  return m.events.filter(e=>{
    if(e.kind==="timeout" || e.kind==="period") return true;
    return e.kind==="teamAction" && (
      e.type==="Golo" ||
      e.type==="Cartão amarelo" ||
      e.type==="Cartão vermelho"
    );
  });
}

function jpgEventDescription(m,e){
  if(e.kind==="timeout"){
    const team=e.side==="tracked"?m.team.name:m.opponent.name;
    return "Timeout · "+team;
  }

  if(e.kind==="period"){
    return e.type||"Período";
  }

  const team=e.side==="tracked"?m.team.name:m.opponent.name;
  const player=e.playerName ? " · #"+e.playerNumber+" "+e.playerName : "";
  const reason=e.type==="Cartão vermelho" && e.reason==="secondYellow"
    ? " (2.º amarelo)"
    : "";

  return (e.type||e.kind)+reason+player+" · "+team;
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

  const width=1800;
  const height=1200;
  const canvas=document.createElement("canvas");
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext("2d");

  const bg="#242424";
  const panel="#303030";
  const panel2="#373737";
  const rowAlt="#343434";
  const line="#4a4a4a";
  const white="#f5f7fa";
  const muted="#aeb7c1";
  const accent="#f97316";
  const blue="#9fc7e8";
  const yellow="#f2c94c";
  const red="#ff6868";
  const green="#9dd6ad";

  ctx.fillStyle=bg;
  ctx.fillRect(0,0,width,height);

  ctx.fillStyle=accent;
  ctx.fillRect(0,0,width,12);

  // Brand + match metadata
  ctx.fillStyle=white;
  ctx.font="700 28px Arial, sans-serif";
  ctx.fillText("FUTSAL TIME TRACKER",55,55);

  ctx.fillStyle=muted;
  ctx.font="17px Arial, sans-serif";
  ctx.fillText(m.date||"Sem data",55,84);
  if(m.competition){
    ctx.fillText(canvasFitText(ctx,m.competition,330),55,110);
  }

  // Score header
  ctx.textAlign="center";
  ctx.fillStyle=white;
  ctx.font="700 34px Arial, sans-serif";
  ctx.fillText(canvasFitText(ctx,m.team.name,430),530,72);
  ctx.fillText(canvasFitText(ctx,m.opponent.name,430),1270,72);

  ctx.font="900 84px Arial, sans-serif";
  ctx.fillText(String(m.team.score),735,108);
  ctx.fillText(String(m.opponent.score),1065,108);

  ctx.fillStyle=muted;
  ctx.font="700 38px Arial, sans-serif";
  ctx.fillText("—",900,99);

  const periodText=m.phase==="finished"
    ? "Jogo terminado"
    : (m.phase==="halftime" ? "Intervalo" : (m.period===1?"1ª Parte":"2ª Parte"));

  ctx.fillStyle=blue;
  ctx.font="700 21px Arial, sans-serif";
  ctx.fillText(
    periodText+" · "+mainClockText(m)+" · "+(m.clockMode==="countup"?"Corrido":"Cronometrado"),
    900,
    146
  );
  ctx.textAlign="left";

  // Statistics panel
  canvasRoundRect(ctx,45,175,1710,170,18,panel,line);

  ctx.fillStyle=white;
  ctx.font="700 22px Arial, sans-serif";
  ctx.fillText("ESTATÍSTICAS",72,211);

  ctx.fillStyle=muted;
  ctx.font="15px Arial, sans-serif";
  ctx.textAlign="right";
  ctx.fillText(
    canvasFitText(ctx,m.team.name,330)+"  |  "+canvasFitText(ctx,m.opponent.name,330),
    1725,
    211
  );
  ctx.textAlign="left";

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

  const statX=72;
  const statGap=276;
  stats.forEach((row,i)=>{
    const x=statX+i*statGap;
    canvasRoundRect(ctx,x,235,245,82,12,panel2);
    ctx.textAlign="center";
    ctx.fillStyle=white;
    ctx.font="700 27px Arial, sans-serif";
    ctx.fillText(String(row[1])+"  ·  "+String(row[2]),x+122.5,269);
    ctx.fillStyle=muted;
    ctx.font="16px Arial, sans-serif";
    ctx.fillText(row[0],x+122.5,296);
  });
  ctx.textAlign="left";

  // Main panels
  const mainY=375;
  const mainH=755;
  const playerX=45;
  const playerW=1190;
  const eventsX=1260;
  const eventsW=495;

  canvasRoundRect(ctx,playerX,mainY,playerW,mainH,18,panel,line);
  canvasRoundRect(ctx,eventsX,mainY,eventsW,mainH,18,panel,line);

  // Players panel title
  ctx.fillStyle=white;
  ctx.font="700 22px Arial, sans-serif";
  ctx.fillText("JOGADORES",75,414);

  ctx.fillStyle=muted;
  ctx.font="15px Arial, sans-serif";
  ctx.textAlign="right";
  ctx.fillText(m.team.players.length+" convocados",1205,414);
  ctx.textAlign="left";

  const players=[...m.team.players].sort((a,b)=>Number(a.number)-Number(b.number));
  const headerY=458;
  const firstRowY=500;
  const availableRowsH=570;
  const rowHeight=Math.max(31,Math.min(45,Math.floor(availableRowsH/Math.max(1,players.length))));

  const cols={
    no:75,
    name:115,
    pos:355,
    status:445,
    p1:570,
    p2:655,
    total:740,
    g:835,
    r:885,
    re:930,
    f:985,
    card:1035
  };

  ctx.fillStyle="#2a2a2a";
  ctx.fillRect(65,432,1150,42);

  ctx.fillStyle=muted;
  ctx.font="700 13px Arial, sans-serif";
  ctx.fillText("#",cols.no,headerY);
  ctx.fillText("JOGADOR",cols.name,headerY);
  ctx.fillText("POS.",cols.pos,headerY);
  ctx.fillText("ESTADO",cols.status,headerY);
  ctx.fillText("1ª P",cols.p1,headerY);
  ctx.fillText("2ª P",cols.p2,headerY);
  ctx.fillText("TOTAL",cols.total,headerY);
  ctx.fillText("G",cols.g,headerY);
  ctx.fillText("R",cols.r,headerY);
  ctx.fillText("RE",cols.re,headerY);
  ctx.fillText("F",cols.f,headerY);
  ctx.fillText("CART.",cols.card,headerY);

  players.forEach((p,i)=>{
    const y=firstRowY+i*rowHeight;

    if(i%2===0){
      ctx.fillStyle=rowAlt;
      ctx.fillRect(65,y-24,1150,rowHeight-2);
    }

    const status=jpgPlayerStatus(p);
    const p1=formatSeconds(periodInNow(p,m,1));
    const p2=formatSeconds(periodInNow(p,m,2));
    const total=formatSeconds(accumulatedInNow(p,m));
    const cards=jpgPlayerCards(m,p.id);

    ctx.fillStyle=white;
    ctx.font="700 16px Arial, sans-serif";
    ctx.fillText(String(p.number),cols.no,y);

    ctx.font="16px Arial, sans-serif";
    ctx.fillText(canvasFitText(ctx,p.name,220),cols.name,y);
    ctx.fillText(canvasFitText(ctx,p.position||"Jogador",75),cols.pos,y);

    ctx.fillStyle=status==="Expulso"?red:(status==="Em campo"?green:muted);
    ctx.font="700 14px Arial, sans-serif";
    ctx.fillText(status,cols.status,y);

    ctx.fillStyle=white;
    ctx.font="700 15px Arial, sans-serif";
    ctx.fillText(p1,cols.p1,y);
    ctx.fillText(p2,cols.p2,y);
    ctx.fillText(total,cols.total,y);

    ctx.fillText(String(jpgEventCount(m,"Golo",p.id)),cols.g,y);
    ctx.fillText(String(jpgEventCount(m,"Remate",p.id)),cols.r,y);
    ctx.fillText(String(jpgEventCount(m,"Remate enquadrado",p.id)),cols.re,y);
    ctx.fillText(String(jpgEventCount(m,"Falta",p.id)),cols.f,y);

    ctx.fillStyle=cards==="—"?muted:(cards==="A"?yellow:red);
    ctx.fillText(cards,cols.card,y);
  });

  // Events panel
  ctx.fillStyle=white;
  ctx.font="700 22px Arial, sans-serif";
  ctx.fillText("EVENTOS PRINCIPAIS",1290,414);

  const keyEvents=jpgKeyEvents(m);
  const shown=keyEvents.slice(-14).reverse();

  if(!shown.length){
    ctx.fillStyle=muted;
    ctx.font="16px Arial, sans-serif";
    ctx.fillText("Ainda não existem eventos principais.",1290,460);
  }else{
    let ey=462;
    shown.forEach((e,i)=>{
      if(i>0){
        ctx.strokeStyle=line;
        ctx.lineWidth=1;
        ctx.beginPath();
        ctx.moveTo(1290,ey-21);
        ctx.lineTo(1720,ey-21);
        ctx.stroke();
      }

      const period=e.period==="INT"?"INT":((e.period||m.period)+"P");
      const time=(e.clockText||"").trim();
      const when=(period+" "+time).trim();

      ctx.fillStyle=blue;
      ctx.font="700 13px Arial, sans-serif";
      ctx.fillText(when,1290,ey);

      let desc=jpgEventDescription(m,e);
      ctx.fillStyle=white;
      ctx.font="15px Arial, sans-serif";
      ctx.fillText(canvasFitText(ctx,desc,335),1375,ey);

      ey+=44;
    });
  }

  // Events summary at bottom
  const individualGoals=m.events.filter(e=>
    e.kind==="teamAction" &&
    e.side==="tracked" &&
    e.type==="Golo" &&
    e.playerName
  );

  ctx.fillStyle=muted;
  ctx.font="700 14px Arial, sans-serif";
  ctx.fillText("GOLOS DA EQUIPA",1290,1040);

  if(individualGoals.length){
    const scorers={};
    individualGoals.forEach(e=>{
      const key="#"+e.playerNumber+" "+e.playerName;
      scorers[key]=(scorers[key]||0)+1;
    });
    const scorerText=Object.entries(scorers)
      .map(([name,count])=>count>1?name+" ("+count+")":name)
      .join(" · ");

    ctx.fillStyle=white;
    ctx.font="15px Arial, sans-serif";
    ctx.fillText(canvasFitText(ctx,scorerText,430),1290,1068);
  }else{
    ctx.fillStyle=muted;
    ctx.font="15px Arial, sans-serif";
    ctx.fillText("Sem golos individuais registados.",1290,1068);
  }

  // Footer
  ctx.fillStyle=muted;
  ctx.font="13px Arial, sans-serif";
  ctx.fillText(
    "G = golos · R = remates · RE = remates enquadrados · F = faltas · A = amarelo · V = vermelho",
    60,
    1170
  );

  ctx.textAlign="right";
  ctx.fillText("Gerado pelo Futsal Time Tracker",1740,1170);
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
