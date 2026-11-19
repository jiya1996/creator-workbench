// 原站成长报告的交互保持独立，由本机适配器实现数据请求。
export function mountOriginalFounderGrowth() {
  const request=(path,body,method='POST')=>window.WxgcMember.request('/api/member/founder-role/growth'+path,body===undefined?{}:{method,body});
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const stack=items=>{const ul=el('ul',null,'role-list');(items||[]).forEach(item=>ul.append(el('li',typeof item==='string'?item:item.text)));return ul;};
  const link=(text,url)=>{const a=el('a',text,'role-link');a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
  // Letters identify sibling sections; day and topic numbers keep their meaning.
  const markHeading=(box,letter)=>{const heading=box.matches('h2,h3,h4,summary')?box:box.querySelector(':scope > h2, :scope > h3, :scope > summary');if(heading){heading.prepend(el('span',letter,'growth-section-letter'),document.createTextNode(' '));heading.classList.add('growth-marked-heading');}return box;};
  const traitHeadings={
    business_consultant:['找原因','理思路','提建议'],
    chief_expert:['钻问题','重积累','凭专业赢信任'],
    brand_owner:['有自己的表达','说清立场','让人记住'],
    business_partner:['主动了解人','发现互助机会','促成合作'],
    sales_director:['听需求','解疑问','推下一步'],
    product_manager:['找难点','看变化','按反馈改进'],
    general_manager:['看全局','分轻重','让事情相互配合'],
    operations_director:['拆步骤','盯进度','持续做好']
  };
  function identityCard(p){
    const box=el('section',null,'role-card role-hero growth-hero'),primary=p.identity?.primary,secondary=p.identity?.secondary;
    box.append(el('span','我的优势类型','role-eyebrow'),el('h2',primary?.title||p.portraitTitle),el('p',primary?.motto||p.oneLiner,'growth-type-motto'));
    if(primary){
      const tags=el('div',null,'growth-type-tags');tags.append(el('span','角色参考 · '+primary.roleName));if(secondary)tags.append(el('span','辅助倾向 · '+secondary.title));box.append(tags,el('p',primary.intro,'role-summary'));
      const traits=el('div',null,'growth-type-traits');primary.traits.forEach((text,i)=>{const item=el('div'),heading=traitHeadings[primary.roleId]?.[i];item.append(el('span',`做事方式 ${String(i+1).padStart(2,'0')}${heading?'：'+heading:''}`,'growth-type-number'),el('p',text));traits.append(item);});box.append(traits);
      const self=el('blockquote',null,'growth-type-self');self.append(el('small','一句话认识我'),el('p',primary.self));box.append(self);
      if(secondary)box.append(el('p','你的另一面：'+secondary.motto+'。','growth-secondary'));
      if(secondary&&p.identity.closeRoles)box.append(el('p','这两种倾向比较接近，可以放在一起理解自己的特点。','role-small'));
      box.append(el('p','值得留意：'+primary.watch,'role-small'));
      const gallery=el('details',null,'growth-type-gallery');gallery.append(el('summary','看看全部八种类型'));
      const grid=el('div',null,'growth-type-grid');for(const type of p.identity.types){const item=el('article');if(type.roleId===primary.roleId)item.className='is-current';item.append(el('h3',type.title+(type.roleId===primary.roleId?' · 你的主要类型':'')),el('p',type.motto),el('small',type.roleName));grid.append(item);}gallery.append(grid);box.append(gallery);
      box.append(el('p','这是你本次答题更接近的做事类型，可以帮助理解自己，不必用它限制自己的选择。','role-small'));
    }
    return box;
  }
  function cooperationCard(p){
    const box=el('section',null,'role-card growth-cooperation'),c=p.cooperation;if(!c)return box;
    box.append(el('h2','怎样与我合作更顺畅'),el('p','下面是根据本次答题整理的配合建议，开始合作时可以一起确认。','role-small'));
    const grid=el('div',null,'growth-preview-points');for(const [i,[title,text]]of [['可以请我先做什么',c.contribution],['怎样沟通更顺畅',c.communication],['怎样安排进度',c.pacing],['什么搭档能补位',c.partner]].entries()){const item=el('section',null,'role-card');item.append(markHeading(el('h3',title),String.fromCharCode(97+i)),el('p',text));grid.append(item);}box.append(grid);return box;
  }
  // 五件事：标题按学员原话，正文一句一句说清楚，不放说明性文字
  function classicCard(p){
    const box=el('details',null,'role-card growth-classic-fold');box.open=true;
    box.append(el('summary','先看清这五件事'));
    const c=p.classic;
    if(!c){box.append(el('p','做完测评，这里会显示你的五件事。','role-small'));return box;}
    // 五块跟其他模块一样带 A–E 序号，方便在长报告里指着说「第 B 块」
    box.append(markHeading(el('h3','你最适合坐哪把椅子'),'A'));
    const chairs=el('div',null,'growth-preview-points growth-chair-cards');
    for(const chair of c.chairs){const item=el('section',null,'role-card');item.append(el('small',chair.label),el('h4',chair.roleName),el('p',chair.motto),el('small','风格参照：'+chair.reference));chairs.append(item);}
    box.append(chairs);
    box.append(markHeading(el('h3','你的天然经营优势'),'B'),stack(c.strengths));
    box.append(markHeading(el('h3','最容易消耗你的事'),'C'),stack(c.highDrain));
    box.append(markHeading(el('h3','你最应该亲自抓什么'),'D'),stack(c.owned));
    box.append(markHeading(el('h3','谁最值得站在你旁边'),'E'));
    const team=el('div',null,'growth-preview-points');
    for(const member of c.team){const item=el('section',null,'role-card');item.append(el('h4',member.name),el('p',member.reason),el('p',member.method,'role-small'));team.append(item);}
    box.append(team);
    if(c.note)box.append(el('p',c.note,'role-small'));
    return box;
  }
  function explorationCard(p){
    const box=el('section',null,'role-card growth-exploration'),e=p.exploration;if(!e)return box;
    box.append(el('h2','还没有产品，也可以用好这些特点'),el('p','从生活、学习或兴趣中开始，不需要先创业、接客户或拍视频。','role-small'),el('h3','回想这些时刻，哪些像你？'),stack(e.situations),el('h3','可以先探索的方向'),el('p',e.direction),el('h3','这周做一次小尝试'),el('p',e.try),el('p','做完会留下：'+e.artifact,'growth-exploration-result'));
    // 这块是「做完小尝试之后怎么判断」，属于正文第 4 步：跟上面三个小节同一套 h3。
    // 原来是小字折叠（13px 灰字 + 圆点），会员会当成附注跳过，而这三条正是决定要不要继续的依据。
    const check=el('section',null,'growth-exploration-check');check.append(el('h3','怎么判断这件事适不适合我？'),el('p','做完之后按这三个问题看一遍。能说出具体的事，就说明可以继续。','role-small'));
    const checklist=el('ol',null,'growth-check-list');['做的时候愿不愿意继续，哪一步最投入？','别人具体用上了什么，哪一步还需要帮助？','下一次愿不愿意再做，最想改哪一处？'].forEach(q=>checklist.append(el('li',q)));check.append(checklist);box.append(check);return box;
  }
  function personalityCard(p){
    const box=el('section',null,'role-card growth-personality');
    box.append(el('h2','我的性格：长处、困扰与调整方法'),el('p','同一个特点，在不同场景里可能帮上忙，也可能带来困扰。下面结合本次答题，说明怎样发挥长处、调整容易卡住的地方。','role-small'));
    const insights=p.personalityInsights||[];
    const strongest=insights.slice().sort((a,b)=>Math.abs(p.radar[b.key]-50)-Math.abs(p.radar[a.key]-50));
    for(const [i,item]of insights.entries()){
      const detail=el('details',null,'growth-personality-dimension');detail.open=item.key!=='ES'&&item.key===strongest[0]?.key;
      detail.append(markHeading(el('summary',item.name+' · '+item.style),String.fromCharCode(65+i)));
      const grid=el('div',null,'growth-personality-points');
      for(const [label,text]of [['可以发挥的长处',item.strength],['容易遇到的困扰',item.watch],['把特点用得更合适',item.adjust],['个体创业时，留意这一点',item.startup]]){const entry=el('section');entry.append(el('h4',label),el('p',text));grid.append(entry);}detail.append(grid);box.append(detail);
    }
    const partners=el('section',null,'growth-personality-partners');partners.append(el('h3','找搭档：补上需要的帮助，也发挥你的长处','growth-partner-heading'),el('p','可以先从下面两处考虑。已有搭档时，先商量怎样分工，不必为了类型不同就换人。','role-small'));
    for(const [i,item]of strongest.slice(0,2).entries()){
      const entry=el('article');entry.append(markHeading(el('h4','围绕你的'+item.name),String.fromCharCode(97+i)),el('p','可以寻找：'+item.partner+'。'),el('p','一起做事：'+item.workTogether));partners.append(entry);
    }
    const agreement=el('details',null,'growth-partner-agreement'),agreements=el('ol',null,'role-list growth-partner-agreements');agreement.open=true;agreements.type='a';['各自举一件做起来顺手的事，按真实经验分工，不只按类型分工。','写清谁负责、完成什么、哪天交付，以及哪些决定需要两个人确认。','每周用一次简短沟通检查进度；需要帮助时，明确说出要对方做什么。','有分歧时，先说事实和影响，再讨论可选办法；完成一次合作后调整分工。'].forEach(text=>agreements.append(el('li',text)));agreement.append(el('summary','和现有搭档，先约定这四件事','growth-partner-heading'),agreements);partners.append(agreement);box.append(partners);
    return box;
  }
  const date=value=>value?new Date(value).toLocaleDateString('zh-CN'):'';
  const labels={never:'从未正式发布',paused:'以前发过，但近期停更',sometimes:'偶尔发布，不太稳定',weekly:'基本每周持续发布',none:'还没有',some:'有过少量咨询',steady:'已有持续咨询',uncertain:'来源不确定',unknown:'暂不回答'};
  let generationKey=null;
  window.WxgcFounderGrowth={
    renderShared({root,preview,renderTraits,ownerName}){
      root.classList.add('role-growth');root.replaceChildren(identityCard(preview));
      root.firstElementChild.querySelector('.role-eyebrow').textContent=ownerName+'的优势类型';
      // 访客最想看「你是谁、该干什么」：五块直接摊开，不折叠
      const classics=classicCard(preview);classics.hidden=!preview.classic;
      root.append(classics,cooperationCard(preview));
      const chart=el('details',null,'role-card growth-traits-detail');chart.append(el('summary','查看五项特点'),renderTraits(preview.radar,Object.fromEntries(preview.dimensions.map(d=>[d.key,d.label||d.name])),preview.traitSummaries));root.append(chart);
      const next=el('div',null,'role-actions');next.append(link('查看我的经营优势测评','/creator-workbench/member/founder-role.html'));root.append(next);
    },
    async render(ctx){
      const {root,run,message,renderTraits,footer,legacy}=ctx;
      let data=await request('');if(!root.isConnected)return;if(!data.enabled){await legacy();return;}
      root.classList.add('role-growth');root.replaceChildren();message('认识自己的优势类型，找到适合的尝试方向与合作方式。');
      let selected=data.version?.runId===run.id?data.version:null,progress=selected?data.progress:[],reviews=selected?data.reviews:[];
      let lifeOpened=false; // 生活探索默认展开一次，会员收起后重绘不再弹开
      const notice=el('p','', 'growth-notice');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
      // 表单按钮的反馈要贴着按钮（放页面上方会员根本注意不到），所以单独一条放在按钮下面
      const formNotice=el('p','', 'growth-notice growth-notice-local');formNotice.setAttribute('role','status');formNotice.setAttribute('aria-live','polite');
      const action=(text,fn,primary=false)=>{
        const b=el('button',text,primary?'role-primary':'');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){notice.textContent=e.message||'暂未保存，请重试。';notice.dataset.error='true';window.WxgcMember.showToast?.(notice.textContent);}finally{b.disabled=false;}});return b;
      };
      const card=(title,paragraphs,cls='')=>{const c=el('section',null,'role-card '+cls);if(title)c.append(el('h3',title));for(const p of paragraphs||[])c.append(el('p',p));return c;};
      const fold=(title,...children)=>{const d=el('details',null,'role-card growth-fold');d.append(el('summary',title),...children);return d;};
      const section=(id,title)=>{const s=el('section',null,'role-section growth-section');s.id=id;s.append(el('h2',title));root.append(s);return s;};
      // 依据只给人话：纯枚举值、维度代号、JSON 一律不展示（服务器会先转中文，这里只是兜底）。
      const scrollToEl=(target,offset=88)=>{if(!target)return;window.scrollTo({top:Math.max(target.getBoundingClientRect().top+window.scrollY-offset,0),behavior:'smooth'});};
      const readableLine=text=>{const s=String(text||'').trim();if(!s)return '';if(/^[a-z_]{2,20}$/.test(s))return '';if(/^[A-Z]{1,2}\s*本次自评/.test(s))return '';if(/^[{\[]/.test(s)&&/"(?:drafts|markedPublished|recent|source)"/.test(s))return '';return s;};
      const statement=(value)=>{
        const box=el('div',null,'growth-statement');box.append(el('p',typeof value==='string'?value:value.text));
        if(value.evidenceRefs?.length){const d=el('details',null,'growth-evidence');d.append(el('summary','这条建议参考了什么'));const evidence=selected?.report?.evidence||[];value.evidenceRefs.forEach(ref=>{const source=evidence.find(e=>e.id===(typeof ref==='string'?ref:ref.sourceId));const line=readableLine(typeof ref==='string'?source?.text:ref.quote);if(line)d.append(el('p',line));});if(!d.querySelector('p'))d.append(el('p','这条建议来自本次答题和已确认的业务资料。'));box.append(d);}return box;
      };
      // 报告分三块：基础分析（认识自己）→ 商业规划（结合业务的做法）→ 行动计划（7天与90天）
      // ⚠️ 三块只是分组容器，不改任何取数；没有生成报告时第三块整块隐藏。
      const part=(id,index,title,note)=>{const s=el('section',null,'growth-part');s.id='growth-part-'+id;const head=el('header',null,'growth-part-head');head.append(el('p',index,'growth-part-kicker'),el('h2',title),el('p',note,'growth-part-note'));const body=el('div',null,'growth-part-body');s.append(head,body);return{section:s,body};};
      const traitsTop=el('div',null,'growth-traits-top'),hero=card(null,[], 'role-hero growth-hero'),personality=el('div'),classics=el('div',null,'growth-classic'),discovery=el('div',null,'growth-discovery'),preview=data.preview;
      function renderHero(p){
        hero.replaceChildren(...identityCard(p).childNodes);
        // 「看看全部八种类型」默认展开：会员会拿自己对照着看
        const gallery=hero.querySelector('.growth-type-gallery');if(gallery)gallery.open=true;
        if(selected?.runId!==run.id&&selected)hero.prepend(el('p','历史报告 · '+date(selected.generatedAt),'role-small'));
        for(const w of p.warnings)hero.append(el('p',w,'growth-warning'));
        const chart=el('details',null,'growth-traits-detail');chart.open=true;chart.append(el('summary','先看我的五项特点'),renderTraits(p.radar,Object.fromEntries(p.dimensions.map(d=>[d.key,d.label||d.name])),p.traitSummaries||Object.fromEntries(p.dimensions.map(d=>[d.key,d.interpretation]))));traitsTop.replaceChildren(chart); // 提到页面最上方：进来先看到五项分数
        // classicCard 返回的是 details 折叠块本身，整块挂进去；别学 identityCard 的 childNodes 写法，那会把 details 壳丢掉
        classics.replaceChildren(classicCard(p));
        personality.replaceChildren();if(p.personalityInsights?.length)personality.append(personalityCard(p));
        discovery.replaceChildren();if(!selected)discovery.append(explorationCard(p),cooperationCard(p));else{const life=fold('也想看看生活和兴趣中的优势？',explorationCard(p));if(!lifeOpened){life.open=true;lifeOpened=true;}discovery.append(life);}
      }
      const partBase=part('base','第一部分','基础分析报告','认识性格与优势：看清长处和困扰，找到适合的创业与合作方式。');
      const partBusiness=part('business','第二部分','商业规划报告','结合你的业务：内容怎么讲、客户怎么聊、和谁合作、哪些事交给智能员工。');
      const partPlan=part('plan','第三部分','行动计划方案','7 天先做起来，90 天接得上：每天做什么、留下什么，都写在这一块。');
      partBase.body.append(traitsTop,hero,personality,classics,discovery);
      // 顶部横向导航：三个板块一眼看清，点一下直接跳（原生锚点会被固定顶栏和异步渲染顶偏，必须自己接管）
      const partNav=el('nav',null,'growth-part-nav');partNav.setAttribute('aria-label','报告三大板块');
      for(const [id,label]of [['base','基础分析报告'],['business','商业规划报告'],['plan','行动计划方案']]){const a=el('a',label);a.href='#growth-part-'+id;a.dataset.part=id;partNav.append(a);}
      // 落点按导航当前实际高度算：手机上导航要躲开左上角的菜单按钮，粘顶位置比桌面低
      partNav.addEventListener('click',event=>{
        const a=event.target.closest('a[data-part]');if(!a)return;
        event.preventDefault();
        const offset=Math.max(Math.round(partNav.getBoundingClientRect().bottom),0)+14;
        scrollToEl(document.getElementById('growth-part-'+a.dataset.part),offset);
      });
      root.append(partNav,partBase.section,notice,partBusiness.section,partPlan.section);
      const profileCard=el('details',null,'role-card growth-profile-card');profileCard.open=false;
      const profileHeading=el('summary');profileHeading.append(el('h3',data.context?.confirmed?'你的生意和近况 · 已填写，可修改':'想做内容或发展业务？按需补充资料'));profileCard.append(profileHeading,el('p','只是想了解自己，看到这里就已有完整的类型、探索和协作建议。如果你有明确的专业、产品或服务，再填写下面资料，获取结合业务的选题和计划。没有产品时不用填写，也不用编造业务。','role-small'));
      const form=el('form',null,'growth-context-form');
      const select=(label,options,value)=>{const wrap=el('label',label),input=el('select');for(const key of options){const o=el('option',labels[key]);o.value=key;input.append(o);}input.value=value||'unknown';wrap.append(input);form.append(wrap);return input;};
      const publishing=select('最近一个月的内容发布状态？',['never','paused','sometimes','weekly','unknown'],data.profile.data.publishing);
      const consulting=select('有没有客户因为看过你的内容主动联系咨询？',['none','some','steady','uncertain','unknown'],data.profile.data.consulting);
      const summary=el('details',null,'growth-business-summary');summary.open=!data.context?.confirmed;
      summary.append(el('summary',data.context?.confirmed?'你提供的服务和客户 · 点击可修改':'你做什么，主要帮助谁？'));
      summary.append(el('p','已保存的商业定位会自动带入。请确认下面三项；这里的修改只用于这份报告。','role-small'));
      const fields={};for(const [key,title,hint]of [['service','你具体提供什么专业、产品或服务？','例如：为幼儿园提供家长沟通培训'],['audience','主要帮助哪一类人？','例如：需要改善家长沟通的幼儿园园长'],['problem','帮助他们解决什么具体问题？','例如：让家长听懂教学安排，减少重复解释']]){
        const label=el('label',title),input=el('textarea');input.rows=2;input.maxLength=800;input.placeholder=hint;input.value=data.context?.business?.[key]||'';label.append(input);summary.append(label);fields[key]=input;
      }
      if(data.context?.notice)summary.append(el('p',data.context.notice,'role-small'));
      const portraitLink=link('查看或完善商业定位','/creator-workbench/member/portrait.html');portraitLink.target='_blank';portraitLink.rel='noopener noreferrer';summary.append(portraitLink);form.append(summary);
      const rights=el('p',rightsText(),'growth-rights'),contextNotice=el('p',data.context?.stage?.notice||'','role-small');form.append(contextNotice,rights);
      function rightsText(){return data.entitlement.first==='available'?'你还可以生成1份首次完整报告。补齐资料即可使用，不需要重新答题。':data.entitlement.first==='reserved'?'正在整理完整报告，可以稍后回来查看。':`还可重新生成报告 ${data.entitlement.remaining} 次。查看报告、记录任务进度不扣次数。`;}
      const saveProfile=async(skip=false)=>{
        const business=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value.trim()]));
        const saved=await request('/profile',{revision:data.profile.revision,publishing:skip?'unknown':publishing.value,consulting:skip?'unknown':consulting.value,timeBudget:data.profile.data.timeBudget||30,business,confirmBusiness:!skip},'PUT');
        data=await request('');rights.textContent=rightsText();contextNotice.textContent=data.context.stage.notice;
        const text=saved.savedLocally?'业务资料已保存到本机，阶段判断与报告生成服务待接入。':skip?'已跳过，下面直接看建议；想补充资料随时回到这里。':data.context.confirmed?'资料已保存，可以生成完整报告。':'已保存。把服务、客户和要解决的问题补齐后，就能生成完整报告，首次次数仍保留。';
        // 卡片会自动收起时（资料已确认），按钮下方的提示会跟着藏起来，这时改用页面上方那条
        const folds=!skip&&data.context.confirmed;
        notice.textContent='';formNotice.textContent='';formNotice.dataset.error='false';
        const target=folds?notice:formNotice;target.textContent=text;
        if(folds){summary.open=false;profileCard.open=false;profileHeading.querySelector('h3').textContent='你的生意和近况 · 已填写，可修改';}
        renderBody();
      };
      const formActions=el('div',null,'role-actions');formActions.append(action('确认资料并继续',()=>saveProfile(),true),action('先跳过，直接看建议',()=>saveProfile(true)));form.append(formActions,formNotice);form.addEventListener('submit',e=>e.preventDefault());profileCard.append(form);partBusiness.body.append(profileCard);
      const body=el('div',null,'growth-report-body');partBusiness.body.append(body);
      // 报告说明只是注释，不占正文：合成一个折叠模块放最底部，正文里不再散落第二块
      const notes=el('details',null,'role-card growth-notes'),notesBody=el('div',null,'growth-notes-body');
      notes.append(el('summary','报告版本与测评说明'),notesBody);
      function renderNotes(){
        const generated=selected?.generatedAt?`生成于${date(selected.generatedAt)}；基于该次测评和当时确认的业务摘要。`:'还没有生成完整报告；下面是测评方法和分数含义。';
        const src=link('查看公开题库来源','https://ipip.ori.org/newBigFive5broadKey.htm');src.target='_blank';src.rel='noopener noreferrer';
        notesBody.replaceChildren(
          el('h3','这份报告怎么来的'),el('p',generated),stack(selected?.report?.limits||preview.limits||[]),
          el('h3','五项特点在题库中的名称'),el('p','日常使用时看上面的建议即可。'),stack(preview.dimensions.map(d=>(d.label||d.subtitle)+'：'+d.name)),
          el('p','按这次答题，你的商业分工可参考：'+[run.result.primaryRole,run.result.secondaryRole].map(id=>run.config.roles.find(r=>r.id===id)?.name).join('、')+'。这只是分工建议，是否适合还要看你的经验和实际工作。'),
          src,action('查看原版报告',legacy)
        );
      }
      async function refresh(){data=await request('');selected=data.version?.runId===run.id?data.version:null;progress=selected?data.progress:[];reviews=selected?data.reviews:[];rights.textContent=rightsText();renderBody();}
      async function generate(){
        const q=await request('/estimate',{runId:run.id});
        const agreed=await window.WxgcMember.confirm(`${q.costText}\n\n${q.notice}`,{title:q.kind==='first'?'生成首次完整报告':'确认重新生成报告',confirmText:'确认并开始'});if(!agreed)return;
        generationKey=crypto.randomUUID();
        notice.textContent='正在根据你的答题和业务资料整理建议，通常需要一两分钟。你可以稍后回来查看。';notice.dataset.error='false';
        notice.scrollIntoView({behavior:'smooth',block:'start'});
        const buttons=body.querySelectorAll('[data-growth-generate]');buttons.forEach(b=>b.disabled=true);
        const previousId=selected?.id||null;
        try{const result=await request('/generate',{token:q.token,requestKey:generationKey});if(result.version.status==='failed')throw new Error('这次没有生成成功，次数已保留，可以重试。');notice.textContent=result.version.status==='running'?'正在整理，稍后回来查看。':'完整报告已保存，可以从今天的任务开始。';await refresh();}
        catch(e){try{await refresh();}catch{}if(selected?.id&&selected.id!==previousId){notice.textContent='刚才连接中断，但完整报告已保存；可以继续阅读和执行。';return;}throw e;}finally{buttons.forEach(b=>b.disabled=false);}
      }
      function planEmpty(){
        const card=el('section',null,'role-card growth-empty-plan');
        card.append(el('h3','还没有行动计划方案'),
          el('p','完整报告生成后，这里会出现一份 7 天行动计划和 90 天成长路线：每天做什么、留下什么、怎么算做完，都写清楚。'),
          el('p','想现在就拿到计划，到上面「商业规划报告」确认一下业务资料，两份计划会一起生成。','role-small'));
        const go=el('button','去确认资料','role-primary');go.type='button';
        go.addEventListener('click',()=>{profileCard.open=true;summary.open=true;const nav=document.querySelector('.growth-part-nav');scrollToEl(profileCard,(nav?Math.max(Math.round(nav.getBoundingClientRect().bottom),88):88)+14);});
        const row=el('div',null,'role-actions');row.append(go);card.append(row);
        return card;
      }
      function renderBody(){
        body.replaceChildren();partPlan.body.replaceChildren();
        renderHero(selected?.report?.preview||preview);
        const generation=selected?fold('报告管理 · 查看历史或重新生成'):data.context.confirmed?card('接下来，看看内容怎么做、客户怎么聊',[]):fold('有业务后，还能生成哪些建议？');
        if(selected?.report?.contextNotice)generation.append(el('p',selected.report.contextNotice,'growth-warning'));
        generation.append(el('p',data.context.confirmed?'这次重点：'+data.context.stage.label+'。':'上方的自我认识与探索建议可以直接使用。以后有了明确的专业服务或产品，补充资料即可获得三个选题、客户沟通建议，以及一份 7 天行动计划和 90 天成长路线。'));
        if(data.entitlement.runningId){generation.append(el('p','报告正在整理，生成成功后才扣次数。'),action('刷新查看',refresh));}
        else if(data.context.confirmed&&!data.context.stage.conflict&&(data.entitlement.first==='available'||data.entitlement.remaining>0)){
          if(data.entitlement.first==='available'&&!data.firstFundingConfigured)generation.append(el('p','完整报告暂时无法生成，请联系运营官完成设置。你的首次次数仍保留。','role-small'));
          const b=action(data.entitlement.first==='available'?'生成我的首次完整报告':'重新生成完整报告',generate,true);b.dataset.growthGenerate='';b.disabled=data.entitlement.first==='available'&&!data.firstFundingConfigured;generation.append(b);
        }else generation.append(el('p',data.entitlement.first==='consumed'?'原报告和计划可以继续使用。想重新生成，请先确认上方资料和剩余次数。':'确认上方资料后，就可以生成首次完整报告。','role-small'));
        if(data.history.length){const history=el('label','以前保存的报告'),select=el('select');select.append(new Option('选择一份已保存的报告',''));data.history.filter(h=>h.status==='succeeded').forEach((h,i)=>select.append(new Option(`${date(h.generatedAt)} · ${h.kind==='first'?'首次完整报告':'重新生成'}${h.runId!==run.id?' · 上次测评':''}`,h.id)));select.value=selected?.id||'';select.addEventListener('change',async()=>{if(!select.value)return;try{const r=await request(`/versions/${encodeURIComponent(select.value)}`);selected=r.version;progress=r.progress;reviews=r.reviews;renderBody();}catch(e){notice.textContent=e.message;}});history.append(select);generation.append(history);}
        body.append(generation);
        if(!selected){partPlan.body.append(planEmpty());return;}
        const r=selected.report;

        function area(id,title){const s=el('section',null,'role-section growth-section');s.id='growth-'+id;s.append(el('h2',title));body.append(s);return s;}
        const p=area('personality','01 这些特点，做内容时怎么用');
        if(selected.runId!==run.id)p.append(el('p','当前查看上一次测评的报告，首屏分数与下方建议均对应当时记录。','growth-warning'));
        const personality=fold('结合你的业务，看看优势和需要留意的地方');personality.append(markHeading(el('h3','可以发挥的特点'),'A'));r.personality.strengths.forEach(s=>personality.append(statement(s)));personality.append(markHeading(el('h3','需要留意'),'B'));r.personality.frictions.forEach(s=>personality.append(statement(s)));p.append(personality);
        const m=area('marketing','02 我的内容，怎样讲得清楚');m.append(markHeading(card('先试这种表达',[r.marketing.expressionStyle.primary,'备选：'+r.marketing.expressionStyle.alternative]),'A'),statement(r.marketing.expressionStyle.why));
        const topics=markHeading(card('三个起步选题',[]),'B');r.marketing.topics.forEach((t,i)=>{topics.append(el('h3',`${i+1}. ${t.title}`),el('p',t.purpose));const row=el('div',null,'role-actions');for(const [type,label]of [['video','用它做视频'],['moments','用它写朋友圈']])if(data.context.actions?.some(a=>a.type===type))row.append(action(label,async()=>{
          // Open during the click gesture, before awaiting the import request.
          const tab=window.open('about:blank','_blank');if(tab){tab.opener=null;tab.document.title='正在准备内容';tab.document.body.textContent='正在准备你的创作任务…';}
          try{const result=await request(`/versions/${selected.id}/start-content`,{topicIndex:i,type});if(tab&&!tab.closed)tab.location.replace(result.href);else{row.querySelector('[data-open-task]')?.remove();const retry=link('打开已准备好的内容',result.href);retry.dataset.openTask='';row.append(retry);notice.textContent='内容已准备好，请点击“打开已准备好的内容”在新窗口继续。';}}
          catch(e){if(tab&&!tab.closed)tab.close();throw e;}
        }));topics.append(row);});topics.append(el('p','口播结构：'+r.marketing.contentFormula));m.append(topics);
        if(r.marketing.trustEvidence.length)m.append(markHeading(card('这些经历和案例，可以让客户更了解你',r.marketing.trustEvidence.map(e=>e.text)),'C'));
        const s=area('selling','03 你的成交方式');s.append(markHeading(card(r.selling.recommendedStyle,[]),'A'),statement(r.selling.why),markHeading(card('你可以这样说',r.selling.sampleLines),'B'),markHeading(fold('需要时，展开沟通步骤与常见顾虑',stack(r.selling.consultSteps),card('面对犹豫，先问清顾虑',r.selling.objectionHelp)),'C'));
        const partners=area('partners','04 怎样合作更顺畅');partners.append(markHeading(cooperationCard(r.preview),'A'));
        // 上半是报告按答题推荐的两类搭档；下半让会员按八种类型自己加身边能请到的人。
        // 加的清单存在服务端（每种类型一位），刷新、换设备都还在，不扣报告次数。
        const partnerDetails=markHeading(fold('需要帮手时，可以这样分工'),'B'),partnerBody=el('div',null,'growth-partner-body');
        const partnerNotice=el('p','', 'growth-notice growth-notice-local');partnerNotice.setAttribute('role','status');partnerNotice.setAttribute('aria-live','polite');
        const partnerAction=(text,fn,primary=false)=>{
          const b=el('button',text,primary?'role-primary':'');b.type='button';
          b.addEventListener('click',async()=>{b.disabled=true;partnerNotice.dataset.error='false';try{await fn();}catch(e){partnerNotice.textContent=e.message||'暂未保存，请重试。';partnerNotice.dataset.error='true';}finally{b.disabled=false;}});
          return b;
        };
        // 八个选项来自服务端的 partnerOptions，不在前端写死，避免和题库里的角色对不上
        function partnerAdder(){
          const box=el('div',null,'growth-partner-add');let chosen='';
          const toggle=el('button','+ 添加一位搭档');toggle.type='button';toggle.dataset.addPartner='';
          const form=el('div',null,'growth-partner-form');form.hidden=true;
          form.append(el('p','从八种类型里选一位你身边可以请来帮忙的人。加进来之后，会写清他能帮你补什么、哪些事仍要你自己定、配合时容易卡在哪一步。','role-small'));
          const options=el('div',null,'growth-partner-options');
          for(const option of data.partnerOptions||[]){
            const b=el('button',null,'growth-partner-option');b.type='button';b.dataset.partnerRole=option.roleId;b.setAttribute('aria-pressed','false');
            b.append(el('strong',option.title),el('small',option.motto));
            b.addEventListener('click',()=>{chosen=option.roleId;for(const x of options.querySelectorAll('[data-partner-role]'))x.setAttribute('aria-pressed',String(x.dataset.partnerRole===chosen));});
            options.append(b);
          }
          const noteLabel=el('label','备注（选填，方便你自己认人）'),note=el('input');note.maxLength=40;note.placeholder='例如：表哥，做工程的';noteLabel.append(note);
          const row=el('div',null,'role-actions');
          row.append(partnerAction('添加这位搭档',async()=>{
            if(!chosen)throw new Error('先在上面选一位，再点添加。');
            const saved=await request('/partners',{roleId:chosen,note:note.value.trim()});
            data.partners=saved.partners;partnerNotice.textContent='已添加到“我添加的搭档”，可以查看分工说明。';renderPartnerList();
          },true));
          const cancel=el('button','取消','');cancel.type='button';cancel.addEventListener('click',()=>{form.hidden=true;toggle.textContent='+ 添加一位搭档';});
          row.append(cancel);form.append(options,noteLabel,row);
          // 按钮一直在原位：展开后变成「收起选择」，不用滚到表单最底部找取消
toggle.addEventListener('click',()=>{form.hidden=!form.hidden;toggle.textContent=form.hidden?'+ 添加一位搭档':'收起选择';});
          box.append(el('h4','身边还有谁能补位？'),el('p','继续添加后，会和上面的搭档保存在同一份清单中。','role-small'),toggle,form);
          return box;
        }
        function partnerCard(p,mine=false){
          const c=card(mine?p.title:p.type,[p.ability]);
          c.append(el('small',mine?'你添加的 · 属于八种类型之一':'报告按你的答题推荐 · 不用马上找人，可以先自己试','growth-partner-tag'));
          if(mine&&p.note)c.append(el('p','备注：'+p.note,'growth-partner-note'));
          if(p.why)c.append(statement(p.why));
          c.append(el('p',p.boundary+' '+p.friction,'role-small'));
          if(mine){
            const row=el('div',null,'role-actions');row.append(partnerAction('移除这位搭档',async()=>{
              const ask=window.WxgcMember?.confirm,agreed=ask?await ask('移除后这条分工说明会从这里消失，随时可以重新添加。',{title:'移除 '+p.title,confirmText:'确认移除',cancelText:'先留着'}):true;
              if(!agreed)return;
              const saved=await request(`/partners/${encodeURIComponent(p.id)}`,'','DELETE');
              data.partners=saved.partners;partnerNotice.textContent='已移除，随时可以重新添加。';renderPartnerList();
            }));c.append(row);
          }
          return c;
        }
        function renderPartnerList(){
          partnerBody.replaceChildren();
          const recommended=el('section',null,'growth-partner-recommended');recommended.append(markHeading(el('h3','为你推荐的搭档'),'a'));
          for(const p of r.collaboration.humanPartnerTypes)recommended.append(partnerCard(p,false));
          partnerBody.append(recommended);
          const mine=data.partners||[];
          const workspace=el('section',null,'growth-partner-workspace');workspace.append(markHeading(el('h3','我添加的搭档'),'b'));
          if(!mine.length)workspace.append(el('p','还没有添加搭档。可以从身边愿意帮忙的人中选一位，记录你们怎样配合。','role-small'));
          for(const p of mine)workspace.append(partnerCard(p,true));
          workspace.append(partnerAdder(),partnerNotice);partnerBody.append(workspace);
        }
        renderPartnerList();partnerDetails.append(partnerBody);partners.append(partnerDetails);
        const employees=markHeading(card('当前可用的智能员工',[]),'C');r.collaboration.employees.forEach(e=>{const c=el('article',null,'growth-employee');c.append(el('h3',e.name),el('p',e.reason),el('p',e.today),link('立即使用',e.href));employees.append(c);});if(r.collaboration.employees.length<2)employees.append(el('p','当前权限内暂无更多可用员工，按计划独立完成即可。','role-small'));partners.append(employees);
        // 7 天和 90 天是同一条路线的两段：放进同一个容器，才能被一条竖线串起来。
        const timeline=el('div',null,'growth-timeline');partPlan.body.append(timeline);
        const stage=(id,title)=>{const s=el('section',null,'role-section growth-section growth-stage');s.id='growth-'+id;s.append(el('h2',title));timeline.append(s);return s;};
        const week=stage('week','05 我的7天行动计划');week.append(el('p','按自己的时间来，做完一项再继续。忙的时候可以暂停，也可以跳过。','role-small'));
        const timeLabel=el('label','我今天能投入多久？'),time=el('select');for(const v of [15,30,60])time.append(new Option(`${v}分钟`,v));time.value=String(data.profile.data.timeBudget||30);timeLabel.append(time);week.append(timeLabel);
        const days=el('div');week.append(days);
        // 每个状态都写清「刚才点了什么、现在怎样、下一步做什么」，点之前点之后都看得懂
        // 点之前先弹窗说清「这一下会发生什么」：三个按钮都会写数据，不说明白会员不敢点
        const dayConfirmText=status=>({
          in_progress:'点「正在做」，只是记一下：这一天已经开工。\n做完再回来点「完成今天任务」。进度会自动保存，不扣报告次数。',
          done:'点「完成今天任务」，会把这一天记为完成，完成情况写进这份报告。\n选错了也不怕，随时可以点回「正在做」。不扣报告次数。',
          skipped:'点「先跳过」，这一天先放一放，其他天不受影响。\n随时可以回来点「正在做」。不扣报告次数。'
        }[status]||'');
        const dayStateText=status=>({
          todo:'还没开始。点「正在做」记下这一天已经开工；点「完成今天任务」记为做完；点「先跳过」这一天先放一放。三个按钮都不扣报告次数。',
          in_progress:'已记为「正在做」：这一步还在进行中，做完再回来点「完成今天任务」。进度会保存，不扣报告次数。',
          done:'这一天已经完成，完成情况已记进这份报告。想重做可以改回「正在做」。',
          skipped:'这一天先跳过了，随时可以回来点「正在做」继续，不影响其他天。'
        }[status]||'');
        function renderDays(plan,flashDay=0){
          days.replaceChildren();const firstOpen=plan.days.find(d=>!['done','skipped'].includes(progress.find(p=>p.day===d.day)?.status))?.day||7;
          plan.days.forEach(d=>{const saved=progress.find(p=>p.day===d.day)||{status:'todo',feedback:'',artifactId:''},box=el('details',null,'role-card growth-day');box.dataset.status=saved.status;if(flashDay===d.day)box.dataset.flash='true';box.open=d.day===firstOpen||flashDay===d.day;box.append(el('summary',`第${d.day}天 · ${d.title}${{done:' · 已完成',skipped:' · 已跳过',in_progress:' · 正在做'}[saved.status]||''}`));box.append(stack(d.steps),el('p','今天留下：'+d.deliverable),el('p','时间不够就先做第一步，点击“正在做”，下次可以继续。','role-small'));
            const why=el('details',null,'growth-evidence');why.append(el('summary','为什么安排这件事'),el('p',d.whyForYou),el('p','完成标准：'+d.doneCriteria));box.append(why);
            if(d.systemAction)box.append(link(d.systemAction.label,d.systemAction.url));
            for(const id of d.relatedEmployeeIds){const e=r.collaboration.employees.find(e=>e.id===id);if(e)box.append(link('请'+e.name+'帮忙',e.href));}
            const feedbackLabel=el('label','实际做了什么，或卡在哪里？（选填）'),feedback=el('textarea');feedback.rows=2;feedback.maxLength=1000;feedback.value=saved.feedback;feedback.placeholder='例如：写好了开头，但还不知道怎样把自己的服务讲清楚。';feedbackLabel.append(feedback);box.append(feedbackLabel);
            const artifactLabel=el('label','关联已有创作任务（选填）'),artifact=el('select');artifact.append(new Option('暂不关联',''));for(const task of data.context.studio.recent||[])artifact.append(new Option(task.title,task.id));if(saved.artifactId&&![...artifact.options].some(o=>o.value===saved.artifactId))artifact.append(new Option('之前关联的内容任务',saved.artifactId));artifact.value=saved.artifactId||'';artifactLabel.append(artifact);box.append(artifactLabel);
            const row=el('div',null,'role-actions');for(const [value,title]of [['in_progress','正在做'],['done','完成今天任务'],['skipped','先跳过']])row.append(action(title,async()=>{const ask=window.WxgcMember?.confirm;const agreed=ask?await ask(dayConfirmText(value),{title:`第${d.day}天 · ${title}`,confirmText:'好，记一下',cancelText:'先不点'}):true;if(!agreed)return;const response=await request(`/versions/${selected.id}/tasks/${d.day}`,{status:value,feedback:feedback.value,artifactId:artifact.value},'PUT');progress=response.progress;renderDays(plan,d.day);notice.textContent={in_progress:'已记为「正在做」。做完这一步再点「完成今天任务」，进度会保存，不扣报告次数。',done:'已记为完成，完成情况已保存，不扣报告次数。',skipped:'这一天先跳过，随时可以回来继续，不扣报告次数。'}[value]||'任务进度和反馈已保存，不扣报告次数。';},value==='done'));box.append(row,el('p',dayStateText(saved.status),'growth-day-state'));days.append(box);
          });
        }
        renderDays(r.plan7);time.addEventListener('change',async()=>{try{const saved=await request('/time-budget',{minutes:Number(time.value)},'PUT');data.profile=saved.profile;const result=await request(`/versions/${selected.id}/plan?minutes=${time.value}`);renderDays(result.plan7);notice.textContent='已按你今天的时间调整任务，不扣报告次数。';}catch(e){notice.textContent=e.message;}});
        const months=stage('months','06 我的90天成长路线');r.plan90.months.forEach(month=>{const c=fold(`第${month.month}个月 · ${month.mainGoal}`);c.classList.add('growth-month');c.append(stack(month.focusActions),el('h3','记得保存'),stack(month.expectedArtifacts),el('h3','看看这些变化'),stack(month.metrics.map(v=>v.label)));months.append(c);});
        if(reviews.length){const latest=reviews.slice().sort((a,b)=>b.updatedAt-a.updatedAt)[0];months.append(card('你上次决定的下一步',[latest.data.next]));}
        const review=fold('第7／30／60天，记录一次回顾',el('p','记下做完的事、收到的反馈和下一步安排。保存这些记录不扣报告次数。'));
        if(data.reviewState?.due?.length)review.append(el('p',`从首次记录任务开始，已使用${data.reviewState.elapsedDays}天。可以完成第${data.reviewState.due.join('、')}天复盘。`,'growth-warning'));
        const reviewDay=el('select');[7,30,60].forEach(d=>reviewDay.append(new Option(`第${d}天复盘`,d)));reviewDay.setAttribute('aria-label','选择复盘节点');review.append(reviewDay);
        const reviewFields={};for(const [key,title]of [['completed','实际完成了什么？'],['learned','收到了什么真实反馈？'],['next','下一步保留或调整什么？']]){const l=el('label',title),input=el('textarea');input.rows=2;input.maxLength=1200;l.append(input);review.append(l);reviewFields[key]=input;}
        function fillReview(){const item=reviews.find(r=>r.milestone===Number(reviewDay.value));Object.entries(reviewFields).forEach(([k,input])=>input.value=item?.data[k]||'');}fillReview();reviewDay.addEventListener('change',fillReview);
        review.append(action('保存回顾记录',async()=>{const response=await request(`/versions/${selected.id}/reviews/${reviewDay.value}`,Object.fromEntries(Object.entries(reviewFields).map(([k,v])=>[k,v.value])),'PUT');reviews=response.reviews;notice.textContent='回顾记录已保存，不扣报告次数。';},true));months.append(review);
        renderNotes();
      }
      renderBody();
      renderNotes();root.append(notes);footer();
    }
  };
  return window.WxgcFounderGrowth;
}
