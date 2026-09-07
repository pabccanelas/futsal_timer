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
      <button data-team="${t.id}">Editar</button>`;
    box.appendChild(row);
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

  if(!team){
    document.getElementById("editingTeamTitle").textContent="Seleciona uma equipa";
    area.classList.add("hidden");
    del.classList.add("hidden");
    return;
  }

  document.getElementById("editingTeamTitle").textContent=team.name;
  area.classList.remove("hidden");
  del.classList.remove("hidden");

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
    events:[],
    createdAt:new Date().toISOString()
  };

  state.selectedPlayerId=null;
  saveCurrent();
  setView("matchView");
});
