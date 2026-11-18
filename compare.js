(()=>{
const archive=window.SWEEP_ARCHIVE,source=window.SWEEP_DATA,items=window.SWEEP_ITEMS;
if(!archive||!source||!items)return;
const $=id=>document.getElementById(id),num=x=>Number(x)||0,fmt=(x,d=0)=>Number.isFinite(x)?x.toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const operators=Object.entries(archive.operators).filter(([id,o])=>o.visible!==false&&o.stats?.atk>0&&!o.isGolden),enemies=Object.entries(archive.enemies).filter(([id,e])=>e.stats?.maxHp>0),equip=Object.entries(items).filter(([id,e])=>e.itemType==='EQUIP'&&e.kind!=='consume_on_equip'&&e.kind!=='consume_on_equip_or_delayed');
const finalBosses=source.bosses||{},enemyCategory=e=>finalBosses[e.key]?'final':e.rank==='BOSS'?'leader':e.rank==='ELITE'?'elite':'normal';
const morphId='chess_item_6_03_e_a',transferBonds=[...new Set(Object.values(items).map(x=>x.giveBondId).filter(Boolean))];
const transferItems=(bondId,tier)=>Object.values(items).filter(x=>x.giveBondId===bondId&&Number(x.isGolden)+1===tier);
function transferItem(build){const t=build.transfer||{};if(!t.enabled)return null;const options=transferItems(t.bondId,t.tier||1);return options.find(x=>x.id===t.itemId)||options[0]||null}
function equippedItems(build){const ids=build.transfer?.enabled?[morphId,transferItem(build)?.id]:build.items.slice(0,2);return ids.map(id=>items[id]).filter(Boolean)}
function defaultBuilds(op){const bonds=op?.bonds?.filter((id,i,all)=>source.bonds[id]&&all.indexOf(id)===i)||[];return [
 {isGolden:false,bonds:[],items:['','']},
 {isGolden:false,bonds:bonds.map(id=>({id,tier:1,layers:50})),items:['','']},
 {isGolden:true,bonds:bonds.map(id=>({id,tier:2,layers:100})),items:['','']}
]}
let builds=[];
const buildTitle=i=>`方案${['一','二','三','四','五','六','七','八','九','十'][i]||i+1}`;
function operatorForBuild(build,base){return build?.isGolden&&archive.operators[base?.goldenId]?archive.operators[base.goldenId]:base}
function skillForOperator(op){return op?.skills?.[num($('cmp-skill').value)]||op?.skill}
function selectedBoss(){return finalBosses[$('cmp-enemy').value]||null}
function targetHp(enemy){const override=num($('cmp-hp-override').value);if(override>0)return override;const mode=$('cmp-mode').value,round=$('cmp-round').value,boss=finalBosses[enemy.key],scale=source.modes[mode]?.enemyScale[round];if(boss?.bloodByMode?.[mode]){return boss.bloodByMode[mode]}return enemy.stats.maxHp*(scale?.hp||1)}
function member(id,op,equips=[]){return !!(source.bonds[id]?.members?.includes(op.baseId||op.chessId?.replace(/_b$/,'_a'))||(equips.some(x=>x.canGiveBond)&&equips.some(x=>x.giveBondId===id)))}
function damage(a,type,def,res,penD=0,penR=0){if(type==='true')return a;if(type==='phys')return Math.max(a*.05,a-def*(1-penD));return Math.max(a*.05,a*(1-Math.min(100,res*(1-penR))/100))}
function targetDef(enemy){return Math.max(0,enemy.stats.def+num($('cmp-extra-def').value))}
// 只由普攻/技能的原始命中生成层数；盟约和装备附加伤害不会再次触发附加伤害。
function iberiaCycleDamage(period,interval,skillEvents,iberia,dotHit){const warm=5,endCycles=10,end=period*endCycles,events=[];for(let t=interval;t<=end+1e-7;t+=interval)events.push(t);for(let c=0;c<=endCycles;c++)for(const ev of skillEvents){const t=c*period+ev.time;if(t<=end+1e-7)events.push(t)}events.sort((a,b)=>a-b);let index=0,total=0,stacks=[];for(let t=1;t<=Math.floor(end);t++){while(index<events.length&&events[index]<=t+1e-7){const start=events[index++],expires=start+iberia.duration;if(stacks.length<10)stacks.push({start,expires});else{let oldest=0;for(let j=1;j<stacks.length;j++)if(stacks[j].expires<stacks[oldest].expires)oldest=j;stacks[oldest]={start,expires}}}stacks=stacks.filter(x=>x.expires>=t);if(t>warm*period)total+=stacks.filter(x=>x.start<t).length*dotHit}return total/(endCycles-warm)}
function evaluate(build,op,skill,enemy){const notes=[],seenBonds=new Set(),active=build.bonds.filter(x=>{if(!x.id||x.tier<=0||seenBonds.has(x.id))return false;seenBonds.add(x.id);return true}),equips=equippedItems(build);let atkPct=0,aspd=0,activeSpeedScale=1,spRate=op.stats.spRecovery||1,spScale=1,spMin=1,damageScale=1,defPen=0,resPen=0,refund=0,extraArts=0,extraTrue=0,iberia=null,arcane=0,arcaneResCap=0,drumSp=0;
  if(build.transfer?.enabled&&!transferItem(build))notes.push('所选盟约没有这一阶转职道具，转职未生效');
  for(const b of active){const x=source.bonds[b.id],bb=x?.bb||{},n=b.layers,t=['swiftShip','skillfulShip'].includes(b.id)?(b.layers>=40?2:1):b.tier,m=member(b.id,op,equips);if(!x)continue;let used=false;
    switch(b.id){
      case 'preciShip':if(m||(t>=2&&op.position==='RANGED')){atkPct+=bb.base_atk+bb.atk_per_stack*n;if(t>=2){defPen=Math.max(defPen,bb.power_def_penetrate||.3);resPen=Math.max(resPen,bb.power_magic_resist_penetrate||.3)}used=true}break;
      case 'lethaniaShip':if(m){atkPct+=bb.atk_base+bb.atk_per_stack*n;used=true;if(t>=2)notes.push('莱塔尼亚乐部的攻速取决于场上召唤物，未计入')}break;
      case 'yanShip':case 'ursusShip':if(m){atkPct+=(bb.atk_base||0)+(bb.atk_per_stack||0)*n;used=true}break;
      case 'soloShip':if(m){atkPct+=bb.atk||.6;used=true}break;
      case 'suntShip':if(op.isGolden){atkPct+=bb.power_atk||.3;if(t>=2)spScale*=bb.sp_ratio||.7;used=true}break;
      case 'siracusaShip':if(m){aspd+=bb.base_attack_speed+bb.attack_speed_per_stack*n;used=true;notes.push(`叙拉古攻速仅持续 ${fmt(bb.base_duration+bb.duration_per_stack*n,1)} 秒；循环稳态按持续生效的上界比较`);if(t>=2)notes.push('叙拉古随机异常真伤未计入')}break;
      case 'skillfulShip':if(m||b.skillfulNearby){aspd+=bb.base_attack_speed+bb.attack_speed_per_stack*n;used=true;if(!m)notes.push(`灵巧按已勾选的邻近覆盖计算；当前范围为周围${n>=40?8:4}格`)}break;
      case 'raidShip':if(n>=50){aspd+=bb.power_attack_speed||50;used=true}break;
      case 'swiftShip':{const p=Math.min(1,(bb.base_prob||0)+(bb.prob_per_stack||0)*n);if(m){refund+=p*(bb.normal_sp||12);used=true}if(n>=40){refund+=p*(bb.power_sp||15);used=true}if(used)notes.push(`迅捷${n>=40?'已达到40层强化门槛；':''}按期望技力返还估算，单次触发有随机性`);break}
      case 'iberiaShip':if(m){iberia={scale:(bb.dot_atk_scale_base||0)+(bb.dot_atk_scale_per_stack||0)*n,mult:t>=2?2:1,duration:bb.dot_duration||10};used=true;notes.push(`伊比利亚：每个原始命中添加一层，单层每秒 ${fmt(iberia.scale*iberia.mult*100,1)}% 攻击力法伤，最多10层，持续${iberia.duration}秒；二阶为一阶的2倍`);if(t>=2)notes.push('二阶另有20%概率向周围其他敌人弹射300%攻击力法伤；单目标比较未计入')}break;
      case 'arcaneShip':if(m){arcane=(bb.atk_base||0)+(bb.atk_per_stack||0)*n;used=true}if(t>=2){arcaneResCap=Math.abs(Math.max(bb.magic_res_max_min||-100,(bb.magic_res_max_base||-30)+(bb.magic_res_max_per_stack||0)*n));used=true}break;
      case 'kjeragShip':if(m){damageScale*=bb.base_damage_scale||1.25;used=true;if(t>=2)notes.push('谢拉格寒冷/冻结条件的额外增伤未计入')}break;
      case 'emptyShip':if(m){damageScale*=op.isGolden?bb.damage_scale_extra:bb.damage_scale_normal;used=true}break;
      case 'victoriaShip':if(m&&equips.length){damageScale*=(bb.base_damage_scale||1)+(bb.damage_scale_per_stack||0)*n;if(t>=2)atkPct+=equips.reduce((a,e)=>a+(e.isGolden?.8:.4),0);used=true}break;
    }
    if(!used)notes.push(`${x.name}未作用于此干员，或效果需要站位、人数及触发条件，未计入`);
  }
  for(const garrisonId of op.garrisonIds||[]){const g=source.garrisons?.[garrisonId];if(!g)continue;const ids=(g.bbStr?.bond_id||'').split(','),layers=active.reduce((sum,b)=>sum+(ids.includes(b.id)?Math.max(0,num(b.layers)):0),0),stacks=Math.floor(layers/(g.bb?.divide_num||Infinity));if(!stacks)continue;atkPct+=(g.bb.atk||0)*stacks;aspd+=(g.bb.attack_speed||0)*stacks;spRate+=(g.bb.sp_recovery_per_sec||0)*stacks;notes.push(`卫戍技能：${ids.map(id=>source.bonds[id]?.name||id).join('＋')}合计 ${layers} 层，每 ${g.bb.divide_num} 层获得一次加成，共 ${stacks} 次`)}
  for(const e of equips){const p=e.params||{},id=e.id;let used=false;
    if(id.startsWith('chess_item_5_08_')){atkPct+=(p.atk||0)*Math.min(p.max_layer||8,active.length);used=true}
    else if(id.startsWith('chess_item_3_03_')){notes.push('炎国短刀的逐次开技能叠攻需要指定既有层数，未计入');used=true}
    else if(p.atk&&e.kind!=='consume_on_equip'){atkPct+=p.atk;used=true}
    if(id.startsWith('chess_item_2_10_')||id.startsWith('chess_item_6_07_')||id.startsWith('chess_item_6_08_')){notes.push(`${e.name}的逐次攻速叠层未计入`);used=true}
    else if(p.attack_speed&&id.startsWith('chess_item_4_11_')){activeSpeedScale*=1+p.attack_speed;used=true}
    else if(p.attack_speed){aspd+=p.attack_speed;used=true}
    if(p.sp_recovery_per_sec){spRate+=p.sp_recovery_per_sec;used=true}
    if(p.sp_cost_scale){spScale*=p.sp_cost_scale;spMin=Math.max(spMin,p.sp_cost_min||1);used=true;notes.push('可靠怀表的攻速惩罚用于持续技能攻击；脱手伤害不随攻速改变')}
    if(id.startsWith('chess_item_3_14_')){extraArts+=p.atk_scale*(p.double_damage?2:1);used=true}
    if(id==='chess_item_6_12_e_a'){extraTrue+=p.atk_scale||0;used=true}
    if(id.startsWith('chess_item_4_09_')){drumSp+=(p.sp||0)*Math.max(0,num(build.drumTriggers));used=true;if(num(build.drumTriggers)>0)notes.push(`莱塔尼亚小鼓按每周期 ${num(build.drumTriggers)} 次有效击倒计算`)}
    if(!used&&/攻击|伤害|技力|技能/.test(e.desc||''))notes.push(`${e.name}存在触发条件，未计入：${e.desc}`);
  }
  const A=op.stats.atk*(1+atkPct),speed=Math.max(20,Math.min(600,op.stats.aspd+aspd)),interval=op.stats.bat*100/speed,cost=Math.max(spMin,Math.ceil((skill.spCost||1)*spScale)),effectiveCost=Math.max(1,cost-refund-drumSp),def=targetDef(enemy),res=Math.max(0,enemy.stats.res+num($('cmp-extra-res').value));
  let arcaneResStacks=0;
  const hit=(a,type=op.dmgType)=>{const currentRes=res-Math.min(arcaneResStacks,arcaneResCap);let v=damage(a,type,def,currentRes,defPen,resPen)*damageScale;if(arcane)v+=damage(A*arcane,'arts',def,currentRes,0,resPen)*damageScale;if(extraArts)v+=damage(A*extraArts,'arts',def,currentRes,0,resPen)*damageScale;if(extraTrue)v+=A*extraTrue;if(arcaneResCap)arcaneResStacks++;return v};
  const repeatedHits=(count,a,type=op.dmgType)=>{let total=0;for(let i=0;i<Math.ceil(count);i++)total+=hit(a,type)*Math.min(1,count-i);return total};
  const alchemist=op.subProfessionName==='炼金师'&&skill.bb?.projectile_delay_time>0;let skillDamage=0,normalDamage=0,bonusDamage=0,period=1,model='',fieldSpRate=spRate,primarySkillEvents=[];
  if(alchemist){const bb=skill.bb,field=bb.projectile_delay_time,heavy=(enemy.stats.massLevel||0)>=(bb.value||Infinity),ground=!enemy.isFlyEnemy;const events=[];if(ground){for(let t=1;t<=field;t++){events.push({time:t,base:bb.atk_scale||0});if(heavy&&bb.heavy_atk_scale)events.push({time:t,base:bb.heavy_atk_scale})}}else notes.push('炼金单元作用于地面；该空中目标不受此技能伤害');
    for(const ev of events)skillDamage+=hit(A*ev.base,'arts');primarySkillEvents=events;
    fieldSpRate=spRate+(op.module?.active?0.1:0);const recoverDuring=field*fieldSpRate;period=effectiveCost<=recoverDuring?effectiveCost/fieldSpRate:field+(effectiveCost-recoverDuring)/spRate;period=Math.max(1,period);normalDamage=repeatedHits(period/interval,A);model=`脱手技能：${field} 秒持续伤害＋本体全程普攻；${heavy?'目标满足重量附加伤害':'目标不满足重量附加伤害'}。回转：${fmt(Math.min(period,field),1)}秒×${fmt(fieldSpRate,2)}技力/秒＋${fmt(Math.max(0,period-field),1)}秒×${fmt(spRate,2)}技力/秒≈${fmt(effectiveCost,1)}技力`;
  }else if(skill.skillType==='PASSIVE'){period=interval;normalDamage=hit(A);model='被动技能：按普通攻击循环'}
  else if(skill.duration>0){const d=skill.duration,skillAtk=A+op.stats.atk*(skill.bb?.atk||0),scale=skill.bb?.atk_scale||skill.bb?.['attack@atk_scale']||skill.bb?.['attack@max_atk_scale']||1,hits=Number(skill.desc?.match(/(\d+)连发/)?.[1]||1),activeSpeed=Math.max(20,Math.min(600,(speed+(skill.bb?.attack_speed||0))*activeSpeedScale)),skillInterval=Math.max(.1,(op.stats.bat+(skill.bb?.base_attack_time||0))*100/activeSpeed);skillDamage=repeatedHits(Math.floor(d/skillInterval)*hits,skillAtk*scale);const cooldown=effectiveCost/spRate;normalDamage=repeatedHits(cooldown/interval,A);period=d+cooldown;model='持续技能：技能攻击＋回转期间普攻';if(/随机/.test(skill.desc||''))notes.push('随机目标技能按全部命中所选敌人估算');if(/召唤|地块|每秒/.test(skill.desc||''))notes.push('持续技能中的召唤、地块或额外每秒伤害未完整建模')}
  else {const scale=skill.bb?.atk_scale||skill.bb?.['attack@atk_scale']||1,skillAtk=A+op.stats.atk*(skill.bb?.atk||0),cycleAttacks=Math.max(1,Math.ceil(effectiveCost/(spRate*interval)));period=cycleAttacks*interval;skillDamage=hit(skillAtk*scale);normalDamage=repeatedHits(cycleAttacks-1,A);model='瞬发技能：普攻间穿插一次强化攻击';if(skill.bb?.projectile_delay_time||/每秒|持续\d+秒/.test(skill.desc||''))notes.push('该持续/脱手技能暂按瞬发攻击近似，结果不宜用于精确排名')}
  if(alchemist&&iberia){const dotHit=damage(A*iberia.scale*iberia.mult,'arts',def,res,0,resPen)*damageScale;bonusDamage=iberiaCycleDamage(period,interval,primarySkillEvents,iberia,dotHit);notes.push('伊比利亚按循环稳态的原始命中叠层近似；其伤害与奥术、装备追加伤害互不触发')}
  else if(iberia)notes.push('伊比利亚持续伤害在当前通用技能模型中未计入');
  if(arcaneResCap)notes.push(`奥术二阶：仅计此干员的原始命中，每次使目标法抗降低 1；首循环共 ${arcaneResStacks} 次，最多降低 ${fmt(arcaneResCap,1)}。结果按首循环从零层估算，后续循环会继承已降低的法抗`);
  return {dps:(skillDamage+normalDamage+bonusDamage)/period,skillDamage,normalDamage,bonusDamage,period,atk:A,aspd:speed,spRate,fieldSpRate,cost,settledDef:def*(1-defPen),settledRes:(res-Math.min(arcaneResStacks,arcaneResCap))*(1-resPen),model,notes:[...new Set(notes)]};
}
function selectedOperator(){return archive.operators[$('cmp-operator').value]}
function selectedSkill(){return skillForOperator(selectedOperator())}
function selectedEnemy(){return archive.enemies[$('cmp-enemy').value]}
function operatorChanged(){builds=defaultBuilds(selectedOperator());fillSkills();renderBuilds()}
function fillOperators(preferred){const filter=$('cmp-bond-filter').value,visible=operators.filter(([id,o])=>!filter||o.bonds?.includes(filter)),old=preferred||$('cmp-operator').value,previous=$('cmp-operator').value;$('cmp-operator').innerHTML=visible.map(([id,o])=>`<option value="${id}">${escape(o.name)}</option>`).join('');$('cmp-operator').value=visible.some(([id])=>id===old)?old:visible[0]?.[0];if(previous!==$('cmp-operator').value)operatorChanged();else{fillSkills();renderResults()}}
function fillSkills(){const op=selectedOperator();$('cmp-skill').innerHTML=(op?.skills||[op?.skill]).filter(Boolean).map((s,i)=>`<option value="${i}">${escape(s.name)}</option>`).join('');$('cmp-skill').value=Math.max(0,(op?.skills||[]).findIndex(x=>x.isDefault))}
function fillEnemies(preferred){const category=$('cmp-enemy-category').value,term=$('cmp-enemy-search').value.trim().toLocaleLowerCase(),old=preferred||$('cmp-enemy').value,visible=enemies.filter(([id,e])=>enemyCategory(e)===category&&(!term||e.name.toLocaleLowerCase().includes(term)||id.toLocaleLowerCase().includes(term)));$('cmp-enemy').innerHTML=visible.map(([id,e])=>`<option value="${id}">${escape(e.name)}${category==='final'?` · 第 ${finalBosses[id].templates?.[$('cmp-mode').value]?.round||'?'} 回合`:''}</option>`).join('');$('cmp-enemy').value=visible.some(([id])=>id===old)?old:visible[0]?.[0]||'';syncBossRound();if(!visible.length){$('cmp-summary').textContent='没有符合条件的敌人';$('cmp-profiles').innerHTML='';$('cmp-method').innerHTML='';builds.forEach((_,i)=>{const box=$('cmp-output-'+i);if(box)box.innerHTML='请调整敌人搜索条件'});return}renderResults()}
function syncBossRound(){const boss=selectedBoss(),round=boss?.templates?.[$('cmp-mode').value]?.round;if(round&&source.modes[$('cmp-mode').value]?.enemyScale[round])$('cmp-round').value=String(round)}
function renderBuilds(){
  const bondOptions=(build,index)=>'<option value="">选择盟约</option>'+Object.entries(source.bonds).filter(([id])=>!build.bonds.some((x,j)=>j!==index&&x.id===id)).map(([id,b])=>`<option value="${id}">${escape(b.name)}</option>`).join('');
  const itemOptions='<option value="">无装备</option>'+equip.map(([id,e])=>`<option value="${id}">${escape(e.name)} · ${e.isGolden?'进阶':'普通'}</option>`).join('');
  const transferBondOptions=transferBonds.map(id=>`<option value="${id}">${escape(source.bonds[id]?.name||id)}</option>`).join('');
  $('cmp-builds').innerHTML=builds.map((b,i)=>{
    const t=b.transfer||{enabled:false,bondId:'preciShip',tier:1,itemId:''};
    const donorOptions=transferItems(t.bondId,t.tier).map(x=>`<option value="${x.id}">${escape(x.name)} · ${x.isGolden?'二阶':'一阶'}</option>`).join('');
    const gear=equippedItems(b),drum=gear.some(x=>x.id.startsWith('chess_item_4_09_'));
    return `<div class="compare-build" data-build="${i}"><div class="compare-build-head"><h3>${buildTitle(i)}</h3><div class="compare-build-actions"><button type="button" data-copy-build="${i}" aria-label="复制${buildTitle(i)}到右侧" title="向右复制一个方案">向右复制 →</button><button type="button" data-remove-build="${i}" ${builds.length<=1?'disabled':''}>移除</button></div></div><label class="compare-form-label">干员形态<select data-form><option value="initial">初始</option><option value="golden">精锐</option></select></label>
      <div class="compare-build-bonds">${b.bonds.map((x,j)=>`<div class="compare-bond"><select data-bond="${j}" data-part="id">${bondOptions(b,j)}</select>${(source.bonds[x.id]?.thresholds?.length||1)>1?`<select data-bond="${j}" data-part="tier"><option value="1">一阶</option><option value="2">二阶</option></select>`:`<span class="auto-tier">${['swiftShip','skillfulShip'].includes(x.id)?(x.layers>=40?'40层强化':'普通效果'):'单阶'}</span>`}<input data-bond="${j}" data-part="layers" type="number" min="0" max="999" value="${x.layers}" aria-label="盟约层数"><button type="button" data-remove-bond="${j}">×</button></div>${x.id==='skillfulShip'?`<label class="check compare-nearby"><input type="checkbox" data-nearby="${j}" ${x.skillfulNearby?'checked':''}>此干员在灵巧干员周围${x.layers>=40?'8':'4'}格内</label>`:''}`).join('')}</div>
      <button class="cmp-add-bond" type="button">＋ 盟约</button>
      <div class="compare-transfer"><label class="check"><input type="checkbox" data-transfer-enabled ${t.enabled?'checked':''}>转职</label>${t.enabled?`<div class="compare-transfer-grid"><label>目标盟约<select data-transfer-bond>${transferBondOptions}</select></label><label>道具阶数<select data-transfer-tier><option value="1">一阶</option><option value="2">二阶</option></select></label><label class="wide">对应道具<select data-transfer-item>${donorOptions}</select></label></div><p class="hint">自动占用全部两格：变形同构体＋所选盟约道具。道具阶数不改变盟约激活阶数。</p>`:''}</div>
      <div class="compare-build-items">${b.items.slice(0,t.enabled?0:2).map((id,j)=>`<label>装备 ${j+1}<select data-item="${j}">${itemOptions}</select></label>`).join('')}</div>
      ${drum?`<label class="compare-trigger">莱塔尼亚小鼓 · 每循环有效击倒次数<input type="number" data-drum-triggers min="0" step="1" value="${num(b.drumTriggers)}"></label>`:''}
      <div class="compare-build-output" id="cmp-output-${i}"></div></div>`;
  }).join('');
  $('cmp-builds').querySelectorAll('.compare-build').forEach((box,i)=>{
    const b=builds[i],t=b.transfer||{enabled:false,bondId:'preciShip',tier:1,itemId:''};
    box.querySelectorAll('[data-bond]').forEach(el=>el.value=b.bonds[num(el.dataset.bond)][el.dataset.part]);
    box.querySelectorAll('[data-item]').forEach(el=>el.value=b.items[num(el.dataset.item)]);
    const form=box.querySelector('[data-form]');form.value=b.isGolden?'golden':'initial';form.addEventListener('change',()=>{b.isGolden=form.value==='golden';renderResults()});
    box.querySelectorAll('[data-bond]').forEach(el=>el.addEventListener('input',()=>{const x=b.bonds[num(el.dataset.bond)];x[el.dataset.part]=el.dataset.part==='id'?el.value:num(el.value);if(el.dataset.part==='id'){x.tier=1;x.skillfulNearby=false;renderBuilds()}else if(el.dataset.part==='layers'&&['swiftShip','skillfulShip'].includes(x.id))renderBuilds();else renderResults()}));
    box.querySelectorAll('[data-nearby]').forEach(el=>el.addEventListener('change',()=>{b.bonds[num(el.dataset.nearby)].skillfulNearby=el.checked;renderResults()}));
    box.querySelectorAll('[data-item]').forEach(el=>el.addEventListener('change',()=>{b.items[num(el.dataset.item)]=el.value;renderBuilds()}));
    box.querySelector('[data-transfer-enabled]').addEventListener('change',el=>{b.transfer={...t,enabled:el.target.checked};renderBuilds()});
    if(t.enabled){const bond=box.querySelector('[data-transfer-bond]'),tier=box.querySelector('[data-transfer-tier]'),item=box.querySelector('[data-transfer-item]');bond.value=t.bondId;tier.value=t.tier;item.value=transferItem(b)?.id||'';bond.addEventListener('change',()=>{b.transfer={...t,bondId:bond.value,itemId:''};renderBuilds()});tier.addEventListener('change',()=>{b.transfer={...t,tier:num(tier.value),itemId:''};renderBuilds()});item.addEventListener('change',()=>{b.transfer={...t,itemId:item.value};renderResults()})}
    box.querySelector('[data-drum-triggers]')?.addEventListener('input',el=>{b.drumTriggers=Math.max(0,num(el.target.value));renderResults()});
    box.querySelector('.cmp-add-bond').addEventListener('click',()=>{const id=Object.keys(source.bonds).find(id=>!b.bonds.some(x=>x.id===id));if(id)b.bonds.push({id,tier:1,layers:0});renderBuilds()});
    box.querySelectorAll('[data-remove-bond]').forEach(el=>el.addEventListener('click',()=>{b.bonds.splice(num(el.dataset.removeBond),1);renderBuilds()}));
    box.querySelector('[data-copy-build]').addEventListener('click',()=>{builds.splice(i+1,0,JSON.parse(JSON.stringify(b)));renderBuilds()});
    box.querySelector('[data-remove-build]').addEventListener('click',()=>{builds.splice(i,1);renderBuilds()});
  });
  renderResults();
}
function renderDetails(base,enemy,results,forms,skills){
  const round=$('cmp-round').value,mode=$('cmp-mode').value,scale=source.modes[mode]?.enemyScale[round],boss=selectedBoss(),hp=targetHp(enemy),uniqueForms=[...new Map(forms.map((op,i)=>[op.chessId,[op,skills[i]]])).values()];
  const profile=(op,skill)=>{const data={编号:op.chessId,形态:op.isGolden?'精锐':'初始',职业:op.profession,分支:op.subProfessionName,盟约:op.bonds?.map(id=>source.bonds[id]?.name||id),属性:op.stats,特性:op.trait,天赋:op.talents,卫戍技能:(op.garrisonIds||[]).map(id=>source.garrisons?.[id]).filter(Boolean),当前技能:skill,模组:op.module};return `<div class="archive-profile"><div class="archive-head">${escape(op.name)} · ${op.isGolden?'精锐':'初始'}<small>${escape(op.chessId)}</small></div><div class="archive-stats"><div><small>基础攻击</small><strong>${fmt(op.stats.atk)}</strong></div><div><small>攻击间隔</small><strong>${fmt(op.stats.bat,2)} 秒</strong></div><div><small>技力回复</small><strong>${fmt(op.stats.spRecovery||1,2)}/秒</strong></div></div><div class="archive-desc"><strong>${escape(skill?.name||'技能')} · ${fmt(skill?.level||0)} 级</strong><p>${escape(skill?.desc||'暂无描述')}</p></div><details><summary>完整干员档案、天赋与卫戍技能</summary><pre>${escape(JSON.stringify(data,null,2))}</pre></details></div>`};
  const enemyData={编号:enemy.key,等级:enemy.level,类别:enemy.rank,属性:enemy.stats,能力:enemy.abilities,天赋:enemy.talents,技能:enemy.skills,标签:enemy.tags,赛季修正:enemy.seasonOverride,关底Boss档案:boss||undefined};
  const hpText=num($('cmp-hp-override').value)>0?`使用手动输入的实际生命值 ${fmt(hp)}`:boss?`共享生命池 ${fmt(boss.bloodByMode?.[mode]||0)}；档案出场回合 ${boss.templates?.[mode]?.round||'—'}`:`生命 ${fmt(enemy.stats.maxHp)} × ${fmt(scale?.hp||1,3)}；攻击倍率 × ${fmt(scale?.atk||1,3)}`;
  $('cmp-profiles').innerHTML=uniqueForms.map(([op,skill])=>profile(op,skill)).join('')+`<div class="archive-profile"><div class="archive-head">${escape(enemy.name)} · ${escape({normal:'普通',elite:'精锐',leader:'领袖',final:'关底 Boss'}[enemyCategory(enemy)])}<small>${escape(enemy.key)}</small></div><div class="archive-stats"><div><small>计算生命</small><strong>${fmt(hp)}</strong></div><div><small>基础防御</small><strong>${fmt(enemy.stats.def)}</strong></div><div><small>基础法抗</small><strong>${fmt(enemy.stats.res)}</strong></div></div><div class="archive-desc"><strong>${boss?'最终战血量':'回合变化'}</strong><p>${hpText}。防御与法抗按档案和手动修正结算。</p></div><details><summary>完整敌人档案${boss?'与关底 Boss 档案':''}</summary><pre>${escape(JSON.stringify(enemyData,null,2))}</pre></details></div>`;
  $('cmp-method').innerHTML=`<details class="calculation-method"><summary>展开每组方案的计算过程</summary><p>物理伤害＝max(攻击力 × 5%，攻击力 − 结算防御)；法术伤害＝max(攻击力 × 5%，攻击力 × (1 − 结算法抗/100))。攻击间隔＝基础间隔 ÷ (攻速/100)。</p>${results.map((x,i)=>`<div class="calculation-row"><h3>${buildTitle(i)} · ${forms[i].isGolden?'精锐':'初始'} · ${escape(skills[i].name)} ${fmt(skills[i].level)} 级</h3><p>技能 ${fmt(x.skillDamage,1)} ＋ 普攻 ${fmt(x.normalDamage,1)} ＋ 持续伤害 ${fmt(x.bonusDamage,1)} ＝ ${fmt(x.skillDamage+x.normalDamage+x.bonusDamage,1)}；÷ ${fmt(x.period,2)} 秒＝${fmt(x.dps,2)} DPS。</p><p>生命 ${fmt(hp,1)} ÷ ${fmt(x.dps,2)} DPS＝${x.dps>0?`${fmt(hp/x.dps,2)} 秒`:'无法击杀'}。攻击 ${fmt(x.atk,1)}；攻速 ${fmt(x.aspd,1)}；技力回复 ${fmt(x.spRate,2)}/秒；技能消耗 ${fmt(x.cost)}。</p><p>${escape(x.model)}</p>${x.notes.length?`<ul>${x.notes.map(n=>`<li>${escape(n)}</li>`).join('')}</ul>`:''}</div>`).join('')}<p>普通敌人的逐回合生命倍率属于沿用上一季层数安排的推算，当前赛季未实测确认；可用实际生命值覆盖。击杀时间按循环平均输出估算，不模拟首次开技能、目标移动、索敌变化或提前死亡的溢出伤害；关底 Boss 的多阶段、无敌、伤害减免和队友输出未计入。</p></details>`;
}
function renderResults(){
  const base=selectedOperator(),enemy=selectedEnemy();if(!base||!enemy||!$('cmp-output-0'))return;
  const forms=builds.map(b=>operatorForBuild(b,base)),skills=forms.map(skillForOperator);if(skills.some(s=>!s))return;
  const results=builds.map((b,i)=>evaluate(b,forms[i],skills[i],enemy)),baseline=results[0]?.dps||0,best=Math.max(...results.map(x=>x.dps)),hp=targetHp(enemy),boss=selectedBoss(),scale=source.modes[$('cmp-mode').value]?.enemyScale[$('cmp-round').value];
  $('cmp-summary').textContent=`${base.name} · ${skills[0].name} → ${enemy.name}｜${source.modes[$('cmp-mode').value]?.name}第 ${$('cmp-round').value} 回合｜${num($('cmp-hp-override').value)>0?'实际生命值':boss?'关底 Boss 共享生命池':`推算生命 ${fmt(enemy.stats.maxHp)} × ${fmt(scale?.hp||1,3)}`} ${fmt(hp)}｜防御 ${fmt(targetDef(enemy))} / 法抗 ${fmt(enemy.stats.res+num($('cmp-extra-res').value))}`;
  renderDetails(base,enemy,results,forms,skills);
  results.forEach((x,i)=>{const gain=baseline>0?(x.dps/baseline-1)*100:0,relative=best>0?Math.max(2,x.dps/best*100):2;$('cmp-output-'+i).innerHTML=`<div class="compare-metric"><div><small>循环 DPS</small><strong>${fmt(x.dps,1)}</strong></div><span class="${gain>=0?'positive':'negative'}">${i===0?'基准':`${gain>=0?'+':''}${fmt(gain,1)}%`}</span></div><div class="compare-bar"><i style="width:${relative}%"></i></div><div class="compare-kill"><small>预计击杀时间</small><strong>${x.dps>0?`${fmt(hp/x.dps,1)} 秒`:'无法击杀'}</strong></div><div class="compare-facts"><span>形态 ${forms[i].isGolden?'精锐':'初始'}</span><span>技能 ${escape(skills[i].name)} ${fmt(skills[i].level)} 级</span><span>单次技能 ${fmt(x.skillDamage)}</span><span>普攻伤害 ${fmt(x.normalDamage)}</span><span>伊比利亚持续伤害 ${fmt(x.bonusDamage)}</span><span>循环 ${fmt(x.period,1)} 秒</span><span>攻击 ${fmt(x.atk)}</span><span>攻速 ${fmt(x.aspd)}</span><span>结算防御 / 法抗 ${fmt(x.settledDef)} / ${fmt(x.settledRes,1)}</span><span>技力回复 ${fmt(x.spRate,2)}/秒${x.fieldSpRate!==x.spRate?` · 单元在场 ${fmt(x.fieldSpRate,2)}/秒`:``}</span></div><p class="compare-model">${escape(x.model)}；技能消耗 ${fmt(x.cost)} 技力</p>${x.notes.length?`<details><summary>${x.notes.length} 项条件或近似</summary><ul>${x.notes.map(n=>`<li>${escape(n)}</li>`).join('')}</ul></details>`:''}`});
}
function init(){
  operators.sort((a,b)=>a[1].name.localeCompare(b[1].name,'zh'));
  enemies.sort((a,b)=>a[1].name.localeCompare(b[1].name,'zh'));
  $('cmp-bond-filter').innerHTML='<option value="">全部盟约</option>'+Object.entries(source.bonds).filter(([id])=>operators.some(([,o])=>o.bonds?.includes(id))).map(([id,b])=>`<option value="${id}">${escape(b.name)}</option>`).join('');
  $('cmp-bond-filter').addEventListener('change',()=>fillOperators());
  $('cmp-operator').addEventListener('change',operatorChanged);
  $('cmp-skill').addEventListener('change',renderResults);
  $('cmp-enemy-category').addEventListener('change',()=>{$('cmp-enemy-search').value='';fillEnemies()});
  $('cmp-enemy-search').addEventListener('input',()=>fillEnemies());
  $('cmp-enemy').addEventListener('change',()=>{syncBossRound();renderResults()});
  $('cmp-mode').addEventListener('change',()=>{fillRounds();fillEnemies($('cmp-enemy').value)});
  $('cmp-round').addEventListener('change',renderResults);
  $('cmp-hp-override').addEventListener('input',renderResults);
  $('cmp-extra-def').addEventListener('input',renderResults);
  $('cmp-extra-res').addEventListener('input',renderResults);
  $('cmp-add-build').addEventListener('click',()=>{builds.push({isGolden:false,bonds:[],items:['','']});renderBuilds()});
  fillRounds();fillEnemies();fillOperators('chess_char_3_05_a');
  $('data-status').textContent=`本地已收录 ${operators.length} 名干员 · ${enemies.length} 种敌人 · ${Object.keys(finalBosses).length} 份关底 Boss 档案 · ${Object.keys(source.bonds).length} 种盟约`;
}
function fillRounds(){const mode=source.modes[$('cmp-mode').value],previous=$('cmp-round').value;$('cmp-round').innerHTML=Object.keys(mode.enemyScale).map(n=>`<option value="${n}">第 ${n} 回合</option>`).join('');$('cmp-round').value=mode.enemyScale[previous]?previous:'13';syncBossRound();renderResults()}
init();
})();
