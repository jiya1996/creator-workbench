// 保留已采集原站的测评与报告界面，数据访问由本机适配器提供。
export async function mountOriginalFounder({ view = 'home' } = {}) {
  const root=document.getElementById('role-app'),status=document.getElementById('role-status'),dialog=document.getElementById('role-dialog');
  if (!root || !status || !dialog) return
  const api=(url,body,method)=>window.WxgcMember.request('/api/member/founder-role'+url,body===undefined?{}:{method:method||'POST',body});
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const btn=(text,action,primary=false)=>{const b=el('button',text,primary?'role-primary':'');b.type='button';b.addEventListener('click',()=>runAction(action));return b;};
  const list=items=>{const ul=el('ul',undefined,'role-list');items.forEach(s=>ul.append(el('li',s)));return ul;};
  const card=(title,items)=>{const c=el('section',undefined,'role-card');c.append(el('h3',title),list(items));return c;};
  const link=(title,href)=>{const a=el('a',title,'role-link');a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;};
  let state,run,index=0,busy=false,estimate;
  function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
  async function runAction(action){if(busy)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);try{await action();}catch(error){message(error.message||'暂时没有保存成功，请重试。',true);}finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  function setScreen(){root.replaceChildren();window.scrollTo({top:0,behavior:'instant'});}
  async function load(){
    const share=new URLSearchParams(location.search).get('share');
    if(share!==null){
      const data=await api(`/shared/${encodeURIComponent(share||'-')}`);state={axes:data.preview?Object.fromEntries(data.preview.dimensions.map(d=>[d.key,d.label||d.name])):data.axes,sharedPreview:data.preview};run=data.run;await report({shared:true,ownerName:data.ownerName,summaryOnly:data.summaryOnly});return;
    }
    state=await api('');state.growth=await api('/growth').catch(()=>({enabled:false}));if(root.isConnected)home();
  }
  function home(){
    setScreen();message('答题草稿保存在当前浏览器中，已采集的原站报告可单独查看。');
    const hero=el('section',undefined,'role-card role-hero');hero.append(el('span','看清长板，也给自己留出余地','role-eyebrow'),el('h2','你在自己的公司里，最适合坐哪把椅子？'),el('p','一个人很难同时做好战略、产品、销售、内容和运营。用5～8分钟，看清你更愿意亲自抓什么，哪些工作可以交给团队和AI。'));
    const grid=el('div',undefined,'role-grid role-section');grid.append(card('了解自己',['50个日常场景，没有好坏答案。','以平时的你作答，不必选理想中的自己。']),card('看清分工',['找到主经营角色和第二把椅子。','拿到团队、AI分工与30天尝试建议。']));hero.append(grid);
    const label=el('label',undefined,'role-check'),check=el('input');check.type='checkbox';check.checked=true;label.append(check,el('span','完成后，将经营角色加入我的商业数字分身，让AI结合我的工作偏好提供建议。之后可随时关闭或删除。'));hero.append(label);
    const actions=el('div',undefined,'role-actions');actions.append(btn(state.draft?'继续上次测评':state.latest?'重新测评':'看看我的经营角色',async()=>{run=(await api('/start',{shareContext:check.checked})).run;index=Math.max(0,run.config.questions.findIndex(q=>!run.answers[q.id]));if(Object.keys(run.answers).length===50)index=49;question();},true));
    if(state.latest)actions.append(btn('查看我的角色报告',async()=>{run=state.latest;await report();}));hero.append(actions,el('p','本测评帮助你理解工作与经营偏好，不属于心理疾病诊断、医学评估或专业心理咨询。','role-small'),el('p','题目基于IPIP公开题库，由本站翻译。结果反映本次自评，不代表经过常模校准的能力测量。','role-small'));root.append(hero);
  }
  function question(){
    setScreen();const q=run.config.questions[index],box=el('section',undefined,'role-card role-question');const head=el('div',undefined,'role-question-head');head.append(el('span',`已保存 ${Object.keys(run.answers).length} / 50 题`),el('span',`${index+1} / 50`));const progress=el('progress',undefined,'role-progress');progress.max=50;progress.value=Object.keys(run.answers).length;progress.setAttribute('aria-label','答题完成进度');
    const title=el('h2',q.text);title.tabIndex=-1;const options=el('div',undefined,'role-options');options.setAttribute('aria-label','选择与你平时最接近的一项');
    ['非常不像我','比较不像我','说不清','比较像我','非常像我'].forEach((text,i)=>{const b=btn(text,async()=>{message('正在保存…');const saved=await api(`/${run.id}/answer`,{questionId:q.id,value:i+1,revision:run.revision});run=saved.run;message('已保存，刷新后也能继续。');if(index<49)index++;question();});b.prepend(el('span',undefined,'role-option-dot'));b.setAttribute('aria-pressed',String(run.answers[q.id]===i+1));options.append(b);});
    const actions=el('div',undefined,'role-actions');actions.append(btn(index?'上一题':'返回介绍',()=>{if(index){index--;question();}else{state.draft=run;home();}}));if(run.answers[q.id]&&index<49)actions.append(btn('下一题',()=>{index++;question();}));if(index===49)actions.append(btn('查看我的经营角色',async()=>{run=(await api(`/${run.id}/complete`,{})).run;state.latest=run;state.draft=null;state.contextEnabled=run.shareContext;await report();},true));box.append(head,progress,title,options,actions,el('p','选择后自动保存。没有合适的答案时，选最接近平时的一项。','role-small'));root.append(box);title.focus({preventScroll:true});
  }
  function section(title,node){const s=el('section',undefined,'role-section');s.append(el('h2',title),node);root.append(s);}
  function radar(scores,onSelect,axisNames=state.axes){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 400 340');svg.classList.add('role-radar');svg.setAttribute('role','group');svg.setAttribute('aria-label','你的五项特点，点击名称查看说明');
    const axes=Object.keys(axisNames),point=(i,r)=>[200+Math.sin(i*2*Math.PI/5)*r,166-Math.cos(i*2*Math.PI/5)*r];
    [25,50,75,100].forEach(v=>{const p=document.createElementNS(ns,'polygon');p.setAttribute('points',axes.map((_,i)=>point(i,v*1.15).join(',')).join(' '));svg.append(p);});
    const shape=document.createElementNS(ns,'polygon');shape.classList.add('role-shape');shape.setAttribute('points',axes.map((a,i)=>point(i,scores[a]*1.15).join(',')).join(' '));svg.append(shape);
    axes.forEach((a,i)=>{
      const group=document.createElementNS(ns,'g'),[x,y]=point(i,146);group.classList.add('role-radar-axis');group.dataset.traitAxis=a;group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-pressed','false');group.setAttribute('aria-label',`${axisNames[a]}，${Math.round(scores[a])}分，点击查看对应项`);
      const hit=document.createElementNS(ns,'rect');hit.setAttribute('x',x-60);hit.setAttribute('y',y-24);hit.setAttribute('width','120');hit.setAttribute('height','44');hit.setAttribute('rx','8');hit.classList.add('role-radar-hit');
      const t=document.createElementNS(ns,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('text-anchor','middle');t.textContent=axisNames[a];
      group.append(hit,t);group.addEventListener('click',()=>onSelect(a));group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(a);}});svg.append(group);
      const dot=document.createElementNS(ns,'circle'),[dx,dy]=point(i,scores[a]*1.15);dot.setAttribute('cx',dx);dot.setAttribute('cy',dy);dot.setAttribute('r','4');dot.classList.add('role-radar-dot');dot.dataset.traitPoint=a;dot.setAttribute('aria-hidden','true');svg.append(dot);
    });return svg;
  }
  function traitCard(scores,axisNames=state.axes,descriptions=null){
    const traits=el('div',undefined,'role-card role-grid'),numbers=el('div');
    const uses=descriptions||{O:'有新点子就记下来，先挑一个客户问过的问题，讲清楚你会怎么做。',C:'今天先写三句提纲，读一遍，再改掉一句绕口的话。',E:'先写三句，再请朋友按提纲问你；听听哪种方式讲得更清楚。',A:'先问客户想解决什么，再说你能帮什么、哪些事不包含。',ES:'晚上统一看一次评论，把一个值得回答的问题留给下一条内容。'};
    const hint=el('p','点一下名称，就能看到这一项的说明。','role-small role-trait-hint');hint.setAttribute('role','status');hint.setAttribute('aria-live','polite');
    function select(key){
      traits.querySelectorAll('[data-trait-axis],[data-trait-row]').forEach(item=>{const active=(item.dataset.traitAxis||item.dataset.traitRow)===key;item.classList.toggle('is-selected',active);item.setAttribute('aria-pressed',String(active));});
      traits.querySelectorAll('[data-trait-point]').forEach(item=>{const active=item.dataset.traitPoint===key;item.classList.toggle('is-selected',active);item.setAttribute('r',active?'7':'4');});
      hint.textContent=`「${axisNames[key]}」本次自评 ${Math.round(scores[key])} / 100。${uses[key]}`;
    }
    traits.append(radar(scores,select,axisNames));
    Object.entries(axisNames).forEach(([key,name])=>{const row=el('button',undefined,'role-score-row');row.type='button';row.dataset.traitRow=key;row.setAttribute('aria-pressed','false');row.addEventListener('click',()=>select(key));row.append(el('span',name),el('strong',`${Math.round(scores[key])} / 100`));const bar=el('progress');bar.max=100;bar.value=scores[key];bar.setAttribute('aria-label',name);row.append(bar,el('small',uses[key],'role-trait-use'));numbers.append(row);});
    numbers.append(hint,el('p','分数只表示这次答题的倾向，高分不等于更好。','role-small'));traits.append(numbers);return traits;
  }
  async function report(options={}){
    if(!options.shared&&state.growth?.enabled&&window.WxgcFounderGrowth){
      setScreen();message('正在读取你的成长报告…');
      return window.WxgcFounderGrowth.render({root,run,message,renderTraits:traitCard,footer:appendFooter,legacy:()=>legacyReport(options)}).catch(error=>{message(error.message||'暂未读取完整报告，原报告仍可查看。',true);root.append(btn('查看原版报告',()=>legacyReport(options)));});
    }
    return legacyReport(options);
  }
  async function legacyReport({shared=false,ownerName='',summaryOnly=false}={}){
    root.classList.remove('role-growth');
    if(shared&&summaryOnly&&state.sharedPreview){
      setScreen();const preview=state.sharedPreview;message(`${ownerName}分享的经营类型与协作建议 · 仅供会员查看`);
      if(window.WxgcFounderGrowth?.renderShared){await window.WxgcFounderGrowth.renderShared({root,preview,renderTraits:traitCard,ownerName});return;}
      const hero=el('section',undefined,'role-card role-hero');hero.append(el('h2',preview.identity?.primary?.title||preview.portraitTitle),el('p',preview.identity?.primary?.intro||preview.oneLiner),link('查看我的经营优势测评','/creator-workbench/member/founder-role.html'));root.append(hero,traitCard(preview.radar));return;
    }
    setScreen();const result=run.result,r=run.report,roles=run.config.roles,p=roles.find(x=>x.id===result.primaryRole),s=roles.find(x=>x.id===result.secondaryRole);
    message(run.aiStatus==='completed'?'内容创业建议已保存。商业定位有变化时，可主动更新建议。':run.aiStatus==='generating'?'正在整理内容创业建议，稍后刷新查看；已保存的报告可正常阅读。':run.aiStatus==='failed'?'本次解读暂未完成，已保存的报告已为你保留。':'基础报告依据本次答题生成。生成内容创业建议时，将结合已保存的商业定位；尚未填写的业务信息会转成具体的验证步骤。');
    if(shared)message(`${ownerName}分享的经营优势报告 · 仅供会员查看`);
    const hero=el('section',undefined,'role-card role-hero');hero.append(el('span','经营优势 × 内容创业 · 01','role-eyebrow'),el('h2','你的内容创业，从哪里开始'),el('p',r.summary,'role-summary'));
    const grid=el('div',undefined,'role-grid');for(const [role,label] of [[p,'主经营角色'],[s,'你的第二把椅子']]){const c=el('article',undefined,'role-card role-chair');c.append(el('small',label),el('h3',role.name),el('p',role.tagline),el('small',`风格参照：${role.reference}`));grid.append(c);}hero.append(grid);
    if(result.closeRoles)hero.append(el('p','前两个角色倾向分很接近，可以结合真实任务观察，不必强行给自己定型。','role-small'));
    hero.append(el('p','角色是工作偏好的商业解释，不是职位安排或能力排名。名人案例仅帮助理解工作风格，不代表对相关人物进行了人格测评。','role-small'));
    const actions=el('div',undefined,'role-actions');
    if(shared){actions.append(link('查看我的经营优势测评','/creator-workbench/member/founder-role.html'));hero.querySelector('.role-eyebrow').textContent=`${ownerName}的经营优势报告`;}
    else actions.append(btn(run.aiStatus==='completed'?'更新内容创业建议':'生成内容创业建议',confirmAi,true),btn('返回测评首页',home));
    hero.append(actions);root.append(hero);
    section('02 五项偏好，怎样用在做内容上',traitCard(result.scores));
    if(shared&&summaryOnly)return;
    section('03 从你的工作偏好，找到具体做法',card('判断依据与本周动作',r.strengths));section('04 哪些做法容易让你白忙',card('对照实际情况，减少返工',r.highDrainTasks));section('05 做个人生意，哪些事要自己定',card('服务谁、讲什么、承诺什么',r.founderOwnedTasks));
    const content=el('div',undefined,'role-grid');content.append(card('先做这两种内容',r.content.best),card('有了素材，再补这些表达',r.content.support));content.append(card('先别急着投入这些做法',r.content.avoid));section('06 你的内容，具体怎样写',content);section('07 有人来咨询，怎样接着聊',card(r.selling.style,r.selling.steps));
    const team=el('div',undefined,'role-grid');r.team.forEach(t=>{const c=card(roles.find(x=>x.id===t.roleId)?.name||'补位角色',[t.reason,t.method]);team.append(c);});section('08 一个人先怎样做，有伙伴怎样分工',team);
    const ai=el('div',undefined,'role-grid');ai.append(card('交给智能员工整理和起草',r.ai.delegate),card('请它比较和检查，你来决定',r.ai.assist),card('这些事实与承诺，要本人确认',r.ai.retain));section('09 智能员工怎样帮你，交付什么',ai);let employeesReady;if(!shared){const tools=el('div',undefined,'role-tools');root.lastElementChild.append(tools);employeesReady=loadEmployees(tools);}
    const plan=el('div',undefined,'role-card');r.actions.forEach(a=>{plan.append(el('h3',a.period),el('p',a.text));});section('接下来4周，每周做完一件事',plan);
    if(shared)return;
    appendFooter();
    await employeesReady;
  }
  function appendFooter(){
    const footer=el('section',undefined,'role-card');
    footer.append(el('h3','让智能员工更了解你的做事方式'));
    const consent=el('label',undefined,'role-check'),check=el('input');
    check.type='checkbox';check.checked=state.contextEnabled;
    let contextSave=null;
    check.addEventListener('change',()=>{
      check.disabled=true;
      positioningLink.textContent=check.checked?'去关联商业定位':'去解绑商业定位';
      contextSave=(async()=>{
        try {
          await api('/context',{enabled:check.checked},'PUT');state.contextEnabled=check.checked;
          message(check.checked?'已关联到商业定位，智能员工可以参考你的测评特点。':'已解除关联，报告仍为你保留。');
          return true;
        } catch(e) {check.checked=!check.checked;positioningLink.textContent=check.checked?'去关联商业定位':'去解绑商业定位';message(e.message,true);return false;}
        finally {check.disabled=false;}
      })();
    });
    consent.append(check,el('span','让商业定位和智能员工参考我的测评特点'));
    footer.append(consent,el('p','勾选后，支持读取商业定位的智能员工会参考这些特点；取消后停止使用，报告仍保留。','role-small'));
    const foot=el('div',undefined,'role-actions role-footer-actions'),positioningLink=link(check.checked?'去关联商业定位':'去解绑商业定位','/creator-workbench/member/portrait.html#positioning-role-context');
    positioningLink.addEventListener('click',async event=>{
      if(!check.disabled||!contextSave)return;
      event.preventDefault();
      const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
      if(await contextSave){if(tab&&!tab.closed)tab.location.replace(positioningLink.href);else message('关联设置已保存，请再次点击按钮，在新窗口查看商业定位。');}else if(tab&&!tab.closed)tab.close();
    });
    foot.append(positioningLink,btn('删除我的测评数据',async()=>{if(!(await window.WxgcMember.confirm('删除你的全部经营角色测评、报告和AI共享信息？商业定位等其他数据不会删除。')))return;await api('',{},'DELETE');await load();}));
    const shareBox=el('div',undefined,'role-share-box'),shareNotice=el('p',undefined,'role-small');shareNotice.setAttribute('role','status');shareNotice.setAttribute('aria-live','polite');
    const shareButton=btn('',async()=>{
      try{const data=await api('/sharing',{enabled:!state.sharing?.enabled},'PUT');state.sharing=data.sharing;renderSharing();shareNotice.textContent=data.sharing.enabled?'已开启分享，复制链接后可发给其他会员。':'已关闭分享，原链接已失效。';window.WxgcMember.showToast?.(shareNotice.textContent);}
      catch(error){shareNotice.textContent=error.message||'分享设置暂未保存，请重试。';throw error;}
    });
    shareButton.dataset.roleShareToggle='';foot.append(shareButton);
    function renderSharing(){
      const enabled=!!state.sharing?.enabled;shareButton.textContent=enabled?'关闭分享给会员':'分享给会员';shareButton.setAttribute('aria-pressed',String(enabled));shareBox.hidden=!enabled;shareBox.replaceChildren();
      if(!enabled)return;
      const label=el('label','会员专属分享链接'),input=el('input');input.type='url';input.readOnly=true;input.value=new URL(state.sharing.href,location.origin).href;input.setAttribute('aria-label','会员专属分享链接');input.addEventListener('click',()=>input.select());label.append(input);
      const row=el('div',undefined,'role-share-row'),copy=btn('复制分享链接',async()=>{
        try{await navigator.clipboard.writeText(input.value);shareNotice.textContent='分享链接已复制';window.WxgcMember.showToast?.('分享链接已复制');}
        catch{input.focus();input.select();shareNotice.textContent='未能自动复制，请复制已选中的链接。';}
      });row.append(label,copy);shareBox.append(row,el('p','仅已登录会员可查看你的经营类型、特点、人物参考和协作建议。不分享业务资料、客户信息、任务记录、逐题答案或使用次数。关闭后原链接失效。','role-small'));
    }
    renderSharing();footer.append(foot,shareBox,shareNotice);root.append(footer);
  }
  async function loadEmployees(container){try{const data=await api('/employees');if(!container.isConnected)return;if(!data.items.length){container.append(el('p','暂未找到可直接使用的相关AI员工，可联系运营官确认权限。','role-small'));return;}container.append(el('p','可以从这些已开通的AI员工开始：','role-small'));data.items.forEach(item=>{const a=link(item.title,item.href);a.target='_blank';a.rel='noopener noreferrer';container.append(a);});}catch{container.append(el('p','AI员工暂未加载，请稍后重试。','role-small'));}}
  // 生成失败时把「配置模型账号」入口留在这里：会员不用猜下一步去哪。
  function modelSettings(){if(root.querySelector('[data-model-settings]'))return;const a=link('配置或查看我的模型账号','/creator-workbench/member/settings.html#settings-ai-api');a.dataset.modelSettings='';root.firstElementChild.append(a);}
  async function confirmAi(){
    try{estimate=await api(`/${run.id}/estimate`,{});}catch(e){message(e.message,true);modelSettings();return;}
    const box=document.getElementById('role-dialog-body');box.replaceChildren(el('p',`模型：${estimate.model.provider||''} ${estimate.model.modelId}（${estimate.model.source==='shared'?'授权账号':'自己的账号'}）`),el('p',estimate.costText),el('p',estimate.notice,'role-small'));dialog.showModal();
  }
  document.getElementById('role-cancel').onclick=()=>dialog.close();
  document.getElementById('role-confirm').onclick=()=>{dialog.close();runAction(async()=>{message('AI正在结合你的回答与业务背景生成解读，通常需要一两分钟。基础报告已保存。');try{run=(await api(`/${run.id}/generate`,{token:estimate.token})).run;state.latest=run;await report();}catch(e){state=await api('');run=state.latest;await report();message(e.message,true);modelSettings();}});};
  try {
    await load();
    if (!root.isConnected || new URLSearchParams(location.search).has('share')) return;
    if (view === 'report' || view === 'legacy') {
      if (!state.latest) throw new Error('当前没有已保存的经营角色报告。');
      run = state.latest;
      if (view === 'legacy') await legacyReport();
      else await report();
    } else if (view === 'questions') {
      // 本机适配器提供草稿，打开题目时保留既有回答。
      if (!state.draft) throw new Error('当前没有可继续的测评草稿。');
      run = state.draft;
      index = Math.max(0, run.config.questions.findIndex(question => !run.answers[question.id]));
      if (run.config.questions.every(question => run.answers[question.id])) index = run.config.questions.length - 1;
      question();
    }
  } catch (error) {
    message(error.message || '测评暂时无法读取，请稍后重试。', true);
    root.append(btn('重新加载', load));
  } finally {
    document.dispatchEvent(new Event('replica:founder-ready'));
  }
}
