const STORAGE={
  teams:"futsal_time_teams_v5",
  current:"futsal_time_current_v5",
  history:"futsal_time_history_v5"
};

const state={
  teams:[],
  editingTeamId:null,
  currentMatch:null,
  selectedPlayerId:null,
  timer:null
};

function uid(){
  return Date.now().toString(36)+Math.random().toString(36).slice(2,8);
}
function esc(s){
  return String(s??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function formatSeconds(seconds){
  const s=Math.max(0,Math.floor(seconds||0));
  const m=Math.floor(s/60);
  const sec=s%60;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function csvEscape(v){ return `"${String(v??"").replaceAll('"','""')}"`; }
function download(name,content,type){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function safeFileName(s){
  return String(s||"equipa")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9_-]+/g,"_");
}

function load(){
  const savedTeams =
    localStorage.getItem(STORAGE.teams) ||
    localStorage.getItem("futsal_time_teams_v3") ||
    localStorage.getItem("futsal_time_teams_v2");

  const savedCurrent =
    localStorage.getItem(STORAGE.current) ||
    localStorage.getItem("futsal_time_current_v3") ||
    localStorage.getItem("futsal_time_current_v2");

  state.teams=JSON.parse(savedTeams||"[]");
  state.currentMatch=JSON.parse(savedCurrent||"null");

  if(!localStorage.getItem(STORAGE.teams) && savedTeams){ saveTeams(); }
  if(!localStorage.getItem(STORAGE.current) && savedCurrent && state.currentMatch){ saveCurrent(); }

  if(!state.teams.length){
    state.teams=[{
      id:uid(),
      name:"Filipa de Lencastre",
      players:[
        {id:uid(),number:1,name:"GR 1",position:"GR"},
        {id:uid(),number:2,name:"Jogador 2",position:"Jogador"},
        {id:uid(),number:3,name:"Jogador 3",position:"Jogador"},
        {id:uid(),number:4,name:"Jogador 4",position:"Jogador"},
        {id:uid(),number:5,name:"Jogador 5",position:"Jogador"},
        {id:uid(),number:6,name:"Jogador 6",position:"Jogador"},
        {id:uid(),number:7,name:"Jogador 7",position:"Jogador"},
        {id:uid(),number:8,name:"Jogador 8",position:"Jogador"},
        {id:uid(),number:9,name:"Jogador 9",position:"Jogador"},
        {id:uid(),number:10,name:"Jogador 10",position:"Jogador"},
        {id:uid(),number:12,name:"GR 12",position:"GR"}
      ]
    }];
    saveTeams();
  }

  if(state.currentMatch){
    if(!state.currentMatch.phase){
      state.currentMatch.phase=state.currentMatch.period===2?"second_half":"first_half";
    }
    state.currentMatch.team.players.forEach(p=>{
      ensurePeriodStats(p);
    });
    state.currentMatch.running=false;
    if(state.currentMatch.timeout?.active){
      state.currentMatch.timeout.active=false;
      state.currentMatch.timeout.remaining=0;
      state.currentMatch.awaitingResume=state.currentMatch.clockMode==="countdown";
    }
    saveCurrent();
  }
}
function saveTeams(){ localStorage.setItem(STORAGE.teams,JSON.stringify(state.teams)); }
function saveCurrent(){
  if(state.currentMatch) localStorage.setItem(STORAGE.current,JSON.stringify(state.currentMatch));
  else localStorage.removeItem(STORAGE.current);
}

function setView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  if(id==="setupView") renderSetup();
  if(id==="matchView") renderMatch();
  if(id==="historyView") renderHistory();
}
document.querySelectorAll(".nav-btn").forEach(b=>{
  b.addEventListener("click",()=>setView(b.dataset.view));
});
