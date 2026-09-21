/* TEAM MANAGEMENT */
function renderTeams(){
  const box=document.getElementById("teamsList");
  box.innerHTML="";
  state.teams.forEach(t=>{
    const row=document.createElement("div");
    row.className="row space";
    row.style.padding="9px 0";
    row.style.borderBottom="1px solid var(--line)";
    row.innerHTML=`
      <div>
        <strong>${esc(t.name)}</strong>
        <div class="small muted">${t.players.length} jogadores</div>
      </div>
      <div class="row team-list-actions">
        <button data-share-team="${t.id}">Partilhar</button>
        <button data-team="${t.id}">Editar</button>
      </div>`;
    box.appendChild(row);
  });
  box.querySelectorAll("[data-share-team]").forEach(btn=>{
    btn.addEventListener("click",()=>openShareTeam(btn.dataset.shareTeam));
  });
  box.querySelectorAll("[data-team]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      state.editingTeamId=btn.dataset.team;
      renderTeamEditor();
    });
  });
}
function renderTeamEditor(){
  const team=state.teams.find(t=>t.id===state.editingTeamId);
  const area=document.getElementById("playerEditorArea");
  const del=document.getElementById("deleteTeamBtn");
  const share=document.getElementById("shareTeamBtn");

  if(!team){
    document.getElementById("editingTeamTitle").textContent="Seleciona uma equipa";
    area.classList.add("hidden");
    del.classList.add("hidden");
    share.classList.add("hidden");
    return;
  }

  document.getElementById("editingTeamTitle").textContent=team.name;
  document.getElementById("editingTeamNameInput").value=team.name;
  area.classList.remove("hidden");
  del.classList.remove("hidden");
  share.classList.remove("hidden");

  const body=document.getElementById("playersTableBody");
  body.innerHTML="";
  [...team.players].sort((a,b)=>a.number-b.number).forEach(p=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${p.number}</td>
      <td>${esc(p.name)}</td>
      <td>${esc(p.position)}</td>
      <td><button class="danger" data-remove="${p.id}">Remover</button></td>`;
    body.appendChild(tr);
  });

  body.querySelectorAll("[data-remove]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      team.players=team.players.filter(p=>p.id!==btn.dataset.remove);
      saveTeams();renderTeams();renderTeamEditor();
    });
  });
}
document.getElementById("createTeamBtn").addEventListener("click",()=>{
  const input=document.getElementById("teamNameInput");
  const name=input.value.trim();
  if(!name) return alert("Indica o nome da equipa.");
  const t={id:uid(),name,players:[]};
  state.teams.push(t);
  state.editingTeamId=t.id;
  input.value="";
  saveTeams();renderTeams();renderTeamEditor();
});
document.getElementById("saveTeamNameBtn").addEventListener("click",()=>{
  const team=state.teams.find(t=>t.id===state.editingTeamId);
  if(!team) return;

  const input=document.getElementById("editingTeamNameInput");
  const newName=input.value.trim();

  if(!newName) return alert("Indica o nome da equipa.");

  const duplicate=state.teams.some(t=>
    t.id!==team.id &&
    t.name.trim().toLocaleLowerCase("pt-PT")===newName.toLocaleLowerCase("pt-PT")
  );
  if(duplicate) return alert("Já existe uma equipa com esse nome.");

  team.name=newName;

  if(state.currentMatch?.team?.id===team.id){
    state.currentMatch.team.name=newName;
    saveCurrent();
  }

  saveTeams();
  renderTeams();
  renderTeamEditor();
  renderSetup();

  if(state.currentMatch?.team?.id===team.id){
    renderMatch();
  }
});

document.getElementById("editingTeamNameInput").addEventListener("keydown",(e)=>{
  if(e.key==="Enter"){
    e.preventDefault();
    document.getElementById("saveTeamNameBtn").click();
  }
});

document.getElementById("deleteTeamBtn").addEventListener("click",()=>{
  const team=state.teams.find(t=>t.id===state.editingTeamId);
  if(!team) return;
  if(!confirm(`Eliminar ${team.name}?`)) return;
  state.teams=state.teams.filter(t=>t.id!==team.id);
  state.editingTeamId=null;
  saveTeams();renderTeams();renderTeamEditor();
});
document.getElementById("addPlayerBtn").addEventListener("click",()=>{
  const team=state.teams.find(t=>t.id===state.editingTeamId);
  if(!team) return;
  const number=Number(document.getElementById("playerNumber").value);
  const name=document.getElementById("playerName").value.trim();
  const position=document.getElementById("playerPosition").value;
  if(!number || !name) return alert("Preenche número e nome.");
  if(team.players.some(p=>Number(p.number)===number)) return alert("Esse número já existe.");
  team.players.push({id:uid(),number,name,position});
  document.getElementById("playerNumber").value="";
  document.getElementById("playerName").value="";
  saveTeams();renderTeams();renderTeamEditor();
});


/* TEAM SHARING / IMPORT */
let sharedTeamUrl="";
let sharedTeamId=null;
let pendingImportedTeam=null;

function compactSharedTeam(team){
  return {
    v:1,
    n:String(team.name||"Equipa").slice(0,100),
    p:[...team.players]
      .sort((a,b)=>Number(a.number)-Number(b.number))
      .map(p=>[
        Number(p.number),
        String(p.name||"").slice(0,100),
        p.position==="GR"?"GR":"Jogador"
      ])
  };
}

function bytesToBase64Url(bytes){
  let binary="";
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  }
  return btoa(binary)
    .replaceAll("+","-")
    .replaceAll("/","_")
    .replace(/=+$/,"");
}

function base64UrlToBytes(value){
  const base64=value.replaceAll("-","+").replaceAll("_","/");
  const padded=base64+"=".repeat((4-base64.length%4)%4);
  const binary=atob(padded);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}

function encodeSharedTeam(team){
  const json=JSON.stringify(compactSharedTeam(team));
  return bytesToBase64Url(new TextEncoder().encode(json));
}

function decodeSharedTeam(token){
  try{
    const json=new TextDecoder().decode(base64UrlToBytes(token));
    const data=JSON.parse(json);

    if(data?.v!==1 || typeof data.n!=="string" || !Array.isArray(data.p)) return null;
    if(!data.n.trim() || data.n.length>100 || data.p.length<1 || data.p.length>50) return null;

    const players=data.p.map(row=>{
      if(!Array.isArray(row) || row.length<3) throw new Error("invalid player");
      const number=Number(row[0]);
      const name=String(row[1]||"").trim();
      const position=row[2]==="GR"?"GR":"Jogador";

      if(!Number.isInteger(number) || number<1 || number>99 || !name || name.length>100){
        throw new Error("invalid player");
      }
      return {id:uid(),number,name,position};
    });

    const numbers=new Set(players.map(p=>p.number));
    if(numbers.size!==players.length) return null;

    return {id:uid(),name:data.n.trim(),players};
  }catch{
    return null;
  }
}

function shareUrlForTeam(team){
  const url=new URL(window.location.href);
  url.search="";
  url.hash="team="+encodeSharedTeam(team);
  return url.toString();
}

function tokenFromSharedValue(value){
  const raw=String(value||"").trim();
  if(!raw) return "";

  if(raw.startsWith("#team=")) return raw.slice(6);
  if(raw.startsWith("team=")) return raw.slice(5);

  try{
    const url=new URL(raw,window.location.href);
    if((url.hash||"").startsWith("#team=")) return url.hash.slice(6);
  }catch{}

  return raw;
}

function teamSummaryHtml(team){
  const gr=team.players.filter(p=>p.position==="GR").length;
  return "<strong>"+esc(team.name)+"</strong>"+
    "<div class=\"small muted\">"+team.players.length+" jogadores · "+gr+" GR</div>";
}

function openShareTeam(teamId){
  const team=state.teams.find(t=>t.id===teamId);
  if(!team) return;

  sharedTeamId=team.id;
  sharedTeamUrl=shareUrlForTeam(team);

  document.getElementById("shareTeamTitle").textContent="Partilhar "+team.name;
  document.getElementById("shareTeamSummary").innerHTML=teamSummaryHtml(team);
  document.getElementById("shareTeamFeedback").textContent="";

  const qrBox=document.getElementById("shareTeamQr");
  qrBox.innerHTML="";

  try{
    new QRCode(qrBox,{
      text:sharedTeamUrl,
      width:240,
      height:240,
      colorDark:"#111827",
      colorLight:"#ffffff",
      correctLevel:QRCode.CorrectLevel.L
    });
  }catch{
    qrBox.innerHTML="<div class=\"notice\">Não foi possível gerar o QR. Usa Partilhar ou Copiar link.</div>";
  }

  document.getElementById("shareTeamModal").classList.remove("hidden");
}

function closeShareTeam(){
  document.getElementById("shareTeamModal").classList.add("hidden");
}

async function copySharedTeamLink(){
  if(!sharedTeamUrl) return;
  const feedback=document.getElementById("shareTeamFeedback");

  try{
    await navigator.clipboard.writeText(sharedTeamUrl);
    feedback.textContent="Link copiado.";
  }catch{
    const ta=document.createElement("textarea");
    ta.value=sharedTeamUrl;
    ta.style.position="fixed";
    ta.style.opacity="0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    feedback.textContent="Link copiado.";
  }
}

async function nativeShareTeam(){
  if(!sharedTeamUrl) return;
  const team=state.teams.find(t=>t.id===sharedTeamId);
  const title=team ? "Equipa "+team.name : "Equipa de futsal";

  if(navigator.share){
    try{
      await navigator.share({
        title,
        text:"Abre este link para importar a equipa no Futsal Time Tracker.",
        url:sharedTeamUrl
      });
      return;
    }catch(error){
      if(error?.name==="AbortError") return;
    }
  }

  await copySharedTeamLink();
  document.getElementById("shareTeamFeedback").textContent=
    "Partilha nativa indisponível. Link copiado.";
}

function openImportTeamModal(team=null){
  pendingImportedTeam=team;

  const modal=document.getElementById("importTeamModal");
  const input=document.getElementById("teamImportInput");
  const summary=document.getElementById("importTeamSummary");
  const confirmBtn=document.getElementById("importTeamConfirmBtn");
  const error=document.getElementById("importTeamError");

  error.textContent="";

  if(team){
    summary.innerHTML=teamSummaryHtml(team);
    summary.classList.remove("hidden");
    input.value="";
    document.getElementById("manualImportArea").classList.add("hidden");
    confirmBtn.disabled=false;
  }else{
    summary.innerHTML="";
    summary.classList.add("hidden");
    document.getElementById("manualImportArea").classList.remove("hidden");
    confirmBtn.disabled=true;
  }

  modal.classList.remove("hidden");
}

function clearIncomingHash(){
  if(window.location.hash.startsWith("#team=")){
    history.replaceState(null,"",window.location.pathname+window.location.search);
  }
}

function closeImportTeamModal(clearHash=false){
  document.getElementById("importTeamModal").classList.add("hidden");
  pendingImportedTeam=null;
  document.getElementById("teamImportInput").value="";
  document.getElementById("importTeamError").textContent="";
  if(clearHash) clearIncomingHash();
}

function previewImportedValue(value){
  const token=tokenFromSharedValue(value);
  const team=decodeSharedTeam(token);
  const summary=document.getElementById("importTeamSummary");
  const confirmBtn=document.getElementById("importTeamConfirmBtn");
  const error=document.getElementById("importTeamError");

  pendingImportedTeam=team;

  if(!team){
    summary.classList.add("hidden");
    summary.innerHTML="";
    confirmBtn.disabled=true;
    error.textContent=value.trim() ? "Este link não parece ser uma equipa válida." : "";
    return;
  }

  error.textContent="";
  summary.innerHTML=teamSummaryHtml(team);
  summary.classList.remove("hidden");
  confirmBtn.disabled=false;
}

function importPendingTeam(){
  if(!pendingImportedTeam) return;

  const imported=pendingImportedTeam;
  const existingIndex=state.teams.findIndex(
    t=>t.name.trim().toLocaleLowerCase("pt-PT")===
      imported.name.trim().toLocaleLowerCase("pt-PT")
  );

  if(existingIndex>=0){
    const replace=confirm(
      "Já existe uma equipa chamada “"+imported.name+"”.\n\n"+
      "OK = substituir a equipa existente\nCancelar = guardar como cópia"
    );

    if(replace){
      imported.id=state.teams[existingIndex].id;
      state.teams[existingIndex]=imported;
    }else{
      imported.name=imported.name+" (cópia)";
      state.teams.push(imported);
    }
  }else{
    state.teams.push(imported);
  }

  state.editingTeamId=imported.id;
  saveTeams();
  renderTeams();
  renderTeamEditor();
  renderSetup();
  setView("teamsView");
  closeImportTeamModal(true);
  alert("Equipa “"+imported.name+"” importada com sucesso.");
}

function handleIncomingTeamShare(){
  if(!window.location.hash.startsWith("#team=")) return false;

  const token=window.location.hash.slice(6);
  const team=decodeSharedTeam(token);

  if(!team){
    alert("O link de equipa não é válido ou está incompleto.");
    clearIncomingHash();
    return false;
  }

  setView("teamsView");
  openImportTeamModal(team);
  return true;
}

document.getElementById("shareTeamBtn").addEventListener("click",()=>{
  if(state.editingTeamId) openShareTeam(state.editingTeamId);
});
document.getElementById("openImportTeamBtn").addEventListener("click",()=>openImportTeamModal());
document.getElementById("closeShareTeamBtn").addEventListener("click",closeShareTeam);
document.getElementById("copyShareTeamLinkBtn").addEventListener("click",copySharedTeamLink);
document.getElementById("nativeShareTeamBtn").addEventListener("click",nativeShareTeam);
document.getElementById("closeImportTeamBtn").addEventListener("click",()=>closeImportTeamModal(true));
document.getElementById("clearImportTeamBtn").addEventListener("click",()=>{
  document.getElementById("teamImportInput").value="";
  previewImportedValue("");
});
document.getElementById("teamImportInput").addEventListener("input",e=>previewImportedValue(e.target.value));
document.getElementById("importTeamConfirmBtn").addEventListener("click",importPendingTeam);

document.getElementById("shareTeamModal").addEventListener("click",e=>{
  if(e.target.id==="shareTeamModal") closeShareTeam();
});
document.getElementById("importTeamModal").addEventListener("click",e=>{
  if(e.target.id==="importTeamModal") closeImportTeamModal(true);
});
window.addEventListener("hashchange",handleIncomingTeamShare);

/* SETUP */
function renderSetup(){
  const sel=document.getElementById("trackedTeamSelect");
  const old=sel.value;
  sel.innerHTML=state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("");
  if(old && state.teams.some(t=>t.id===old)) sel.value=old;

  if(!document.getElementById("matchDateInput").value){
    document.getElementById("matchDateInput").value=new Date().toISOString().slice(0,10);
  }
  renderRosterSetup();
}
function renderRosterSetup(){
  const team=state.teams.find(t=>t.id===document.getElementById("trackedTeamSelect").value);
  const roster=document.getElementById("rosterChecks");
  const starters=document.getElementById("starterChecks");
  roster.innerHTML="";starters.innerHTML="";
  if(!team) return;

  [...team.players].sort((a,b)=>a.number-b.number).forEach((p,index)=>{
    const r=document.createElement("label");
    r.innerHTML=`<input type="checkbox" checked value="${p.id}"><span>#${p.number} — ${esc(p.name)} ${p.position==="GR"?"(GR)":""}</span>`;
    roster.appendChild(r);

    const s=document.createElement("label");
    s.innerHTML=`<input type="checkbox" ${index<5?"checked":""} value="${p.id}"><span>#${p.number} — ${esc(p.name)} ${p.position==="GR"?"(GR)":""}</span>`;
    starters.appendChild(s);
  });
}
document.getElementById("trackedTeamSelect").addEventListener("change",renderRosterSetup);

document.getElementById("createMatchBtn").addEventListener("click",()=>{
  const team=state.teams.find(t=>t.id===document.getElementById("trackedTeamSelect").value);
  if(!team) return alert("Seleciona uma equipa.");

  const rosterIds=[...document.querySelectorAll("#rosterChecks input:checked")].map(x=>x.value);
  const starterIds=[...document.querySelectorAll("#starterChecks input:checked")].map(x=>x.value);

  if(starterIds.length!==5) return alert("Seleciona exatamente 5 jogadores para o cinco inicial.");
  if(starterIds.some(id=>!rosterIds.includes(id))) return alert("Todos os titulares têm de estar nos convocados.");

  const players=team.players
    .filter(p=>rosterIds.includes(p.id))
    .map(p=>({
      ...p,
      status:starterIds.includes(p.id)?"in":"out",
      stateSincePlayerClock:0,
      accumulatedIn:0,
      accumulatedOut:0,
      periodStats:{
        "1":{in:0,out:0},
        "2":{in:0,out:0}
      },
      substitutionsIn:starterIds.includes(p.id)?1:0,
      substitutionsOut:0
    }));

  const clockMode=document.getElementById("clockModeSelect").value;
  const periodMinutes=Math.max(1,Number(document.getElementById("periodMinutesInput").value)||20);

  state.currentMatch={
    id:uid(),
    team:{id:team.id,name:team.name,players,score:0},
    opponent:{name:document.getElementById("opponentNameInput").value.trim()||"Adversário",score:0},
    competition:document.getElementById("competitionInput").value.trim(),
    date:document.getElementById("matchDateInput").value,
    clockMode,
    periodMinutes,
    period:1,
    phase:"first_half",
    periodClockSeconds:clockMode==="countdown" ? periodMinutes*60 : 0,
    playerClockSeconds:0,
    running:false,
    awaitingResume:false,
    timeout:{active:false,remaining:0,calledBy:null,wasRunning:false},
    numericalPenalties:[],
    pendingReplacements:0,
    events:[],
    createdAt:new Date().toISOString()
  };

  state.selectedPlayerId=null;
  saveCurrent();
  setView("matchView");
});
