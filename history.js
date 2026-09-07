/* HISTORY */
function renderHistory(){
  const history=JSON.parse(localStorage.getItem(STORAGE.history)||"[]");
  const box=document.getElementById("historyList");

  if(!history.length){
    box.innerHTML=`<div class="notice">Sem jogos guardados.</div>`;
    return;
  }

  box.innerHTML=[...history].reverse().map(m=>`
    <div class="row space" style="padding:11px 0;border-bottom:1px solid var(--line)">
      <div>
        <strong>${esc(m.team.name)} ${m.team.score} - ${m.opponent.score} ${esc(m.opponent.name)}</strong>
        <div class="small muted">
          ${esc(m.date||"")} · ${m.clockMode==="countup"?"Corrido":"Cronometrado"} ·
          ${formatSeconds(m.playerClockSeconds)} de tempo efetivo
        </div>
      </div>
      <button class="danger" data-delete-history="${m.id}">Eliminar</button>
    </div>
  `).join("");

  box.querySelectorAll("[data-delete-history]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const updated=history.filter(m=>m.id!==btn.dataset.deleteHistory);
      localStorage.setItem(STORAGE.history,JSON.stringify(updated));
      renderHistory();
    });
  });
}

load();
renderTeams();
renderTeamEditor();
renderSetup();
renderMatch();
startTimer();
