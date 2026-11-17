const shieldPreviewSetting = new URLSearchParams(window.location.search).get("shield-preview");
const shieldCrackPreviewMode = shieldPreviewSetting === "cracks";
const shieldPreviewMode = shieldPreviewSetting === "1" || shieldCrackPreviewMode || window.location.hash === "#shield-preview";
if (!shieldPreviewMode) GameLoop.bootstrapDay();
let gs=GameState.get();
if (shieldPreviewMode) {
  gs=createShieldPreviewState(gs,shieldCrackPreviewMode?60:0);
  const notice=document.getElementById('shield-preview-notice');
  if(notice) notice.hidden=false;
}

let hitCount=0;
let broken=false;

initializeHomeGate(gs);
if(shieldCrackPreviewMode){
  hitCount=3;
  updateHpBar(gs);
  tintShield(60);
  spawnCrack({x:100,y:104},60,hitCount);
}

function hitShield(evt){
  if(shouldIgnoreShieldDragClick(evt)) return;
  if(broken) return;
  if(Shield.isTodayAlreadyDone(gs)) return;
  hitCount++;

  let hitResult;
  const applyShieldHit=state=>{
    hitResult=Shield.applyHit(state,hitCount);
    if(hitResult.broken) hitResult.nightOwlAchievement=Achievements.checkNightOwl(state);
  };
  if(shieldPreviewMode) applyShieldHit(gs);
  else gs=GameState.set(applyShieldHit);

  const impact=getShieldImpact(evt,hitCount);
  updateHpBar(gs);
  shakeShieldOnly(6+hitCount*2,impact);
  shakeScreen(Math.min(hitCount,6));
  fireImpactRing();
  spawnImpactBloom(impact);
  spawnSparks(4+Math.min(hitCount,6)*2,impact);
  vibrate(hitResult.broken?[0,40,30,40,30,80]:30);

  const damagePct=100-Shield.getHpPercent(gs);
  spawnCrack(impact,damagePct,hitCount);
  tintShield(damagePct);

  if(hitResult.broken){
    broken=true;

    showBrokenScreenShell();
    flashScreen();
    shakeScreen(6);
    vibrate([0,50,40,50,40,120]);
    const reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!reducedMotion) setTimeout(()=>{ spawnShards(26); spawnSparks(10); },80);
    setTimeout(()=>showBrokenResultScreen(),260);
  }
}

if(typeof window!=="undefined") window.hitShield=hitShield;
