import './vendor/benchmark-list.js'
import './vendor/benchmark-expression.js'

export function mountOriginalBenchmark() {
/* =====================================================================
 * benchmark.js — 爆款拆解（对标库 → 拆解卡 → 选题 → 填空式成稿 → 回填）
 *
 * 两条产品铁律（2026-10-15 用户明确要求）：
 *  1. 凡点击后会调用大模型的按钮，文案必须带「AI 」字样 —— 会员点之前就知道要花 AI；
 *  2. 点击后**先弹费用确认**（用量/配额/提醒），确认后才真正发起调用。
 *     → 所有 AI 调用统一走 confirmAi()，不允许绕过。
 *
 * 另：自有论据是硬闸（服务端 400），前端同步拦截并给出可执行的提示。
 * 一键复制仅操作剪贴板并显示前置提示；打开做内容通过已保存的 draftId 导入。
 * ===================================================================== */
(function () {
  'use strict';

  const M = window.WxgcMember || {};
  const api = (path = '', options = {}) => M.request('/api/member/benchmark' + path, options);
  const id = (key) => document.getElementById('bm-' + key);

  const state = {
    tracks: [],
    rawIndustries: {},
    rawSubtracks: {},
    recommended: null,
    // ⭐ 标准赛道浏览（2026-10-15 用户要求）：22 个一级赛道 + 二级细分 + 「全部」。
    //    trackCode = '__all__' 表示会员不想逐个看赛道，直接看全库。
    trackTree: [],
    trackGroups: [],
    allTrackCode: '__all__',
    allCorpus: { videoCount: 0, accountCount: 0 },
    trackCode: '__all__',
    subtrackCode: '',
    // 三级（更具体的方向/关键词），目前只用于把细分方向说得更准
    recommendedTrack: null,
    templates: [],
    hookTypes: [],
    // ⭐ 每个钩子类型在「当前赛道 + 账号」下的真实条数（后端给，前端不猜）
    hookCounts: {},
    totalNoHook: 0,
    accounts: [],
    videos: [],
    topics: [],
    niche: '',
    accountId: '',
    hookType: '',
    sortBy: 'engagement',
    offset: 0,
    total: 0,
    pageSize: 9,
    search: '',
    tracksExpanded: false,
    quota: { topics: { used: 0, limit: null, unlimited: false }, scripts: { used: 0, limit: null, unlimited: false } },
    current: { video: null, topic: null, draft: null, segments: [] }
  };

  let videoView, videoRequest = 0, accountRequest = 0, selectionRevision = 0;
  const topicViews = {};

  /* ---------- 小工具 ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function status(key, message, isError) {
    const node = id(key);
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('is-error', Boolean(isError));
  }

  function toast(message) {
    if (typeof M.showToast === 'function') M.showToast(message);
  }

  function formatCount(value) {
    const num = Number(value || 0);
    if (num >= 10000) return (num / 10000).toFixed(1) + ' 万';
    return String(num);
  }

  function durationText(seconds) {
    const total = Math.max(0, Math.round(Number(seconds || 0)));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m ? `${m} 分 ${s} 秒` : `${s} 秒`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 非 HTTPS / 权限被拒时的兜底：临时 textarea + execCommand
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'readonly');
        // ⚠️ 用 class 而不是 element.style：全站 CSP 的口径是样式只走外链 CSS，
        //    JS 里写内联样式会绕过这条约束（也让样式散落在两处难维护）。
        area.className = 'bm-offscreen';
        const host=document.activeElement?.closest('dialog[open]') || document.body;
        host.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  /* ---------- AI 费用确认弹窗 ---------- */
  let confirmResolve = null;

  function quotaText(entry) {
    if (!entry) return '';
    if (entry.unlimited || entry.limit === null) return `已用 ${entry.used} 次，不限量`;
    return `已用 ${entry.used} 次 / 配额 ${entry.limit} 次，还剩 ${Math.max(0, entry.limit - entry.used)} 次`;
  }

  /**
   * 所有 AI 动作的入口：先估费用 → 弹窗 → 会员确认后才执行。
   * 配额用完时弹窗改为「额度已用完」并禁用确认按钮。
   */
  async function confirmAi({ kind, action, chars, run }) {
    let estimate;
    try {
      estimate = await api('/estimate', { method: 'POST', body: { kind, chars } });
    } catch (error) {
      toast(error.message || '暂时没能预估这次 AI 的用量，请稍后重试。');
      return;
    }
    if (!estimate || !estimate.ok) {
      toast((estimate && estimate.message) || '暂时没能预估这次 AI 的用量，请稍后重试。');
      return;
    }
    const dialog = id('confirm');
    id('confirm-title').textContent = estimate.exhausted
      ? '本月额度已用完'
      : `这次 AI 操作预计花费 ¥${estimate.estimate.low.toFixed(2)}–¥${estimate.estimate.high.toFixed(2)}`;
    id('confirm-action').textContent = `${estimate.action}，按当前模型档位估算，实际按用量结算。`;
    id('confirm-quota').textContent = quotaText(estimate.quota);
    status('confirm-status', estimate.exhausted
      ? '本月 AI 次数已用完。升级会员等级可以不限量使用，也可以下个月再来。'
      : '', estimate.exhausted);
    const okButton = id('confirm-ok');
    okButton.disabled = Boolean(estimate.exhausted);
    okButton.textContent = estimate.exhausted ? '额度已用完' : '确认并生成';
    confirmResolve = run;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  function closeConfirm() {
    const dialog = id('confirm');
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    confirmResolve = null;
  }

  /* ---------- 分区切换 ---------- */
  function bindTabs() {
    document.querySelectorAll('[data-bm-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('[data-bm-tab]').forEach((item) => {
          const active = item === button;
          item.classList.toggle('is-active', active);
          if (active) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current');
        });
        const key = button.dataset.bmTab;
        document.querySelectorAll('[data-bm-panel]').forEach((panel) => {
          panel.hidden = panel.dataset.bmPanel !== key;
        });
        if (key === 'topics') loadTopics();
        if (key === 'stats') loadStats();
      });
    });
  }

  /* ---------- 赛道 / 博主 / 列表 ---------- */
  // 语料不足 50 条的赛道默认折叠（2026-10-15 用户要求）：主行只留厚赛道，
  // 小赛道收进「还有 N 个」里，点开再展开、再点收起。当前选中与推荐赛道
  // 即使不足 50 也留在主行 —— 否则会员看不到自己选的是什么。
  const SMALL_TRACK_LIMIT = 50;
  /** 拆解卡里少于等于这个行数的卡片并排显示（内容多的独占一行） */
  const SHORT_BLOCK_MAX_LINES = 2;

  /**
   * 让 chip 区最多显示三行，多出来的折叠起来、可展开/再收起。
   *
   * ⭐ 实现要点（本项目约束很紧）：
   *   · CSP 禁 inline style、且守卫禁止 benchmark.js 写 element.style
   *     → 高度一律由 CSS 类 `.is-clamped` 决定，JS 只切类。
   *   · 判定是否溢出：先加上 clamp 再比较 scrollHeight/clientHeight，
   *     不够三行的话 scrollHeight==clientHeight，此时把类去掉（不做无谓折叠）。
   *   · 事件只挂一次（重渲染会重复调用，重复挂会让点击翻两次）。
   */
  function applyClamp(containerId, toggleId) {
    const box = id(containerId);
    const toggle = id(toggleId);
    if (!box || !toggle) return;
    box.classList.add('is-clamped');
    const overflow = box.scrollHeight - box.clientHeight > 1;
    if (!overflow) {
      box.classList.remove('is-clamped');
      toggle.hidden = true;
      return;
    }
    toggle.hidden = false;
    const open = !box.classList.contains('is-clamped');
    toggle.setAttribute('aria-expanded', String(open));
    if (toggle.dataset.wired === '1') return;
    toggle.dataset.wired = '1';
    toggle.addEventListener('click', () => {
      const nowClamped = box.classList.toggle('is-clamped');
      const expanded = !nowClamped;
      toggle.setAttribute('aria-expanded', String(expanded));
      const label = toggle.querySelector('.bm-clamp-label');
      if (label) label.textContent = expanded ? '收起' : '展开更多';
    });
  }

  /** 切换赛道后的统一收尾：清账号/翻页/钩子，再重拉三处 */
  async function applyTrackChange() {
    const revision = ++selectionRevision;
    // 切换时立即清空旧结果，旧请求即使较晚返回也不能恢复旧列表。
    accountRequest += 1;
    videoRequest += 1;
    state.accountId = '';
    state.offset = 0;
    state.hookType = '';
    state.search = '';
    state.accounts = [];
    state.videos = [];
    state.hookCounts = {};
    state.totalNoHook = 0;
    state.tracksExpanded = false;
    renderTracks();
    id('accounts').replaceChildren(el('p', 'pm-muted', '正在更新这个方向的博主…'));
    id('videos').replaceChildren(el('p', 'pm-muted', '正在更新这个方向的内容…'));
    id('videos-empty').hidden = true;
    id('list-count').textContent = '正在更新…';
    renderHookOptions();
    status('status', '正在更新赛道、博主和内容…');
    try {
      await Promise.all([loadAccounts(), loadVideos(true, true)]);
      if (revision === selectionRevision) status('status', '');
    } catch (error) {
      if (revision === selectionRevision) status('status', error.message || '暂时没有更新成功，请重新选择后重试。', true);
    }
  }

  function chip(label, count, active, onClick) {
    const node = el('button', 'bm-chip');
    node.type = 'button';
    node.classList.toggle('is-active', Boolean(active));
    node.append(el('span', null, label));
    if (typeof count === 'number') node.append(el('small', null, `${count} 条`));
    node.addEventListener('click', onClick);
    return node;
  }

  /**
   * 01 模块：全部 + 22 个一级标准赛道 + 选中赛道的二级细分。
   *
   * ⭐ 用户 2026-10-15 明确要求「全部」：有的会员不想逐个点赛道，
   *    就想直接翻全库，所以「全部」排在最前且是默认选中。
   * ⭐ 一级赛道按 A/B/C/D 分组展示（PRD 的四大类），语料条数来自映射表；
   *    条数为 0 的赛道照样显示（点了会看到「该赛道暂无语料」空态），
   *    不隐藏 —— 隐藏会让会员以为系统里没有这个方向。
   */
  /**
   * 01 模块：一级（大行业）/ 二级（细分方向）/ 三级（更具体的方向）联动下拉。
   *
   * ⭐ 用户 2026-10-15 定稿：三级用下拉精确筛选，小赛道另起一行用常用胶囊快速切换。
   * ⭐ 三级数据来自 ip_track_keywords（每个细分方向挂在下面的关键词/更细方向），
   *    PRD §9.1 里「三级方向或自定义关键词」就是这一层。
   * ⭐ 下级依赖上级：改了一级就要重置二级、三级，否则会出现「教育培训 + 口腔健康」
   *    这种跨父子的非法组合（服务端也会拒绝）。
   */
  function renderTracks() {
    const isAll = state.trackCode === state.allTrackCode;
    renderLevelSelects(isAll);
    renderRawTracks();
    renderTrackHint(isAll);
  }

  function fillSelect(select, options, current, placeholder) {
    if (!select) return;
    select.replaceChildren();
    select.append(new Option(placeholder, ''));
    options.forEach((item) => select.append(new Option(item.label, item.value)));
    select.value = current || '';
  }

  function renderLevelSelects(isAll) {
    const l1 = id('l1');
    const l2 = id('l2');
    if (!l1 || !l2) return;
    fillSelect(
      l1,
      state.trackTree.map((track) => ({
        value: track.code,
        label: track.videoCount ? `${track.name}（${track.videoCount} 条）` : track.name
      })),
      isAll ? '' : state.trackCode,
      '全部行业'
    );
    const track = isAll ? null : state.trackTree.find((item) => item.code === state.trackCode);
    // ⭐ 二级也要带条数，跟一级下拉一个口径：没有数，会员不知道点哪个才有内容
    fillSelect(
      l2,
      (track?.subtracks || []).map((sub) => ({
        value: sub.code,
        label: sub.videoCount ? `${sub.name}（${sub.videoCount} 条）` : sub.name
      })),
      state.subtrackCode,
      '全部细分方向'
    );
    // 没有细分方向时，二级下拉要禁用而不是留空让人以为坏了
    l2.disabled = !track || !track.subtracks.length;
  }

  /** 仅在“全部赛道”下收起不足50条的分类；行业和细分范围内全部平铺。 */
  function renderRawTracks() {
    const box = id('raw-tracks');
    if (!box) return;
    box.replaceChildren();
    if (!state.tracks.length) {
      box.append(el('p', 'pm-muted', '还没有赛道语料，请联系运营官导入。'));
      renderSmallTracks([]);
      return;
    }
    // ⭐ 选了细分方向（二级）就只显示归到它的语料赛道：
    //    用户 2026-10-15 明确要求「点家庭教育，赛道列表只显示跟家庭教育相关的」。
    //    依据是运营做的映射（benchmark_track_map.subtrack_code），不是猜的。
    const wanted = state.subtrackCode;
    const isAll = state.trackCode === state.allTrackCode;
    const list = state.tracks.filter(track => {
      if (!isAll && !(state.rawIndustries[track.name] || []).includes(state.trackCode)) return false;
      return !wanted || (state.rawSubtracks[track.name] || []).includes(wanted);
    });
    if (!list.length) {
      box.append(el('p', 'pm-muted', '这个方向下还没有归类的语料赛道，换一个方向看看。'));
      renderSmallTracks([]);
      return;
    }
    const small = [];
    list.forEach((track) => {
      if (isAll && track.videoCount < SMALL_TRACK_LIMIT) {
        small.push(track);
        return;
      }
      box.append(rawChip(track));
    });
    renderSmallTracks(small);
  }

  function rawChip(track) {
    return chip(track.name, track.videoCount, track.name === state.niche, () => {
      // 点当前行业/细分下的语料赛道，只进一步缩小范围；不重置上方选择。
      if (state.niche === track.name) {
        state.niche = '';
      } else {
        state.niche = track.name;
      }
      applyTrackChange();
    });
  }

  function trackCodeInGroup(code, list) {
    return list.some((item) => item.code === code);
  }

  function renderTrackHint(isAll) {
    const hint = id('track-hint');
    if (!hint) return;
    if (state.niche) {
      hint.textContent = `当前查看「${state.niche}」。再点一次可取消，回到当前行业或细分方向的全部内容。`;
      return;
    }
    if (isAll) {
      hint.textContent = `现在看的是全部赛道，共 ${state.allCorpus.videoCount} 条语料。想更有针对性，就点下面一个赛道。`;
      return;
    }
    if (state.recommendedTrack && state.recommendedTrack.code === state.trackCode) {
      hint.textContent = `${state.recommendedTrack.reason}。也可以点别的赛道。`;
      return;
    }
    hint.textContent = '先选一个大方向，再看下面的细分方向。选错了随时可以点回「全部」。';
  }

  /** 小赛道折叠组：开合状态存 state（重渲染不丢），aria 与 class 同步显式切换 */
  /**
   * 钩子下拉按后端返回的**真实条数**渲染，0 条的禁用并标注「暂无」。
   *
   * ⭐ 为什么不直接列七种钩子：语料打标是分批跑的，某个赛道可能一个钩子都还没有。
   *    会员选到空钩子会看到一片空白、以为页面坏了（2026-10-15 线上实拍反馈）。
   *    这里把「有没有」前置到下拉，选不到就是选不到，不给空白的机会。
   */
  function renderHookOptions() {
    const select = id('hook');
    if (!select) return;
    const counts = state.hookCounts || {};
    select.replaceChildren();
    select.append(new Option(`全部钩子 · ${state.totalNoHook} 条`, ''));
    const available = state.hookTypes.filter((item) => (counts[item.id] || 0) > 0);
    const missing = state.hookTypes.filter((item) => (counts[item.id] || 0) === 0);
    for (const item of available) {
      select.append(new Option(`${item.label} · ${counts[item.id]} 条`, item.id));
    }
    for (const item of missing) {
      const option = new Option(`${item.label} · 本赛道暂无`, item.id);
      option.disabled = true;
      select.append(option);
    }
    // 选中的钩子在新上下文里变成 0 条时回落到「全部钩子」，而不是留在空结果上
    if (state.hookType && (counts[state.hookType] || 0) === 0) {
      state.hookType = '';
      // 换赛道后原钩子失效，重新拉一次列表（避免停在空结果）
      state.offset = 0;
      select.value = '';
      return true;
    }
    select.value = state.hookType;
    return false;
  }

  function renderSmallTracks(small) {
    const wrap = id('track-more');
    const box = id('tracks-small');
    const toggle = id('tracks-toggle');
    if (!wrap || !box || !toggle) return;
    box.replaceChildren();
    if (!small.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    const open = Boolean(state.tracksExpanded);
    box.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('is-open', open);
    const label = toggle.querySelector('.bm-track-more-label');
    if (label) {
      label.textContent = open
        ? '收起小赛道'
        : `还有 ${small.length} 个小赛道（不足 ${SMALL_TRACK_LIMIT} 条）`;
    }
    // ⭐ 这里必须是 rawChip：这一组收的都是**语料自带赛道**，
    //    不是标准赛道树里的二级细分（那是 renderSubtracks 的事）。
    //    2026-10-15 线上事故：这里调了重构时被删掉的 trackChip →
    //    ReferenceError，会员点「还有 N 个小赛道」什么都没有。
    small.forEach((track) => box.append(rawChip(track)));
  }

  function renderAccounts() {
    const box = id('accounts');
    box.replaceChildren();
    if (!state.accounts.length) {
      // ⭐ 分两种情况，别笼统说一句「没有」：
      //    ① 已经是在「全部」了还没博主 → 库里确实没语料，得找运营官
      //    ② 选了某个具体赛道/博主筛选后没结果 → 会员能自己解决，给一条明确的退路
      const isAll = state.trackCode === state.allTrackCode && !state.niche && !state.subtrackCode;
      box.append(el('p', 'pm-muted', isAll
        ? '还没有博主语料。请联系运营官导入对标语料。'
        : '这个赛道还没有找到博主。换一个赛道，或者直接看全部。'));
      if (!isAll) {
        const back = el('button', 'bm-chip', '看全部赛道');
        back.type = 'button';
        back.addEventListener('click', () => {
          state.trackCode = state.allTrackCode;
          state.subtrackCode = '';
              state.niche = '';
          state.accountId = '';
          applyTrackChange();
        });
        box.append(back);
      }
      return;
    }
    const all = el('button', 'bm-chip');
    all.type = 'button';
    all.classList.toggle('is-active', !state.accountId);
    all.append(el('span', null, '全部博主'));
    all.addEventListener('click', () => {
      state.accountId = '';
      state.offset = 0;
      renderAccounts();
      loadVideos(true);
    });
    box.append(all);
    state.accounts.forEach((account) => {
      const chip = el('button', 'bm-chip');
      chip.type = 'button';
      chip.classList.toggle('is-active', account.accountId === state.accountId);
      chip.append(el('span', null, account.name));
      if (account.isSeedTarget) chip.append(el('span', 'bm-seed', '推荐对标'));
      chip.append(el('small', null, `${account.videoCount} 条`));
      chip.addEventListener('click', () => {
        state.accountId = account.accountId === state.accountId ? '' : account.accountId;
        state.offset = 0;
        renderAccounts();
        loadVideos(true);
      });
      box.append(chip);
    });
    // 博主最多三行，多出来的折叠（用户 2026-10-15 要求）
    applyClamp('accounts', 'accounts-toggle');
  }

  // 标题超过 50 字就折叠（用户 2026-10-15 要求），两行截断 + 可展开/再收起。
  const TITLE_CLAMP_LENGTH = 50;

  function videoCard(video) {
    const card = el('button', 'bm-video-card');
    card.type = 'button';
    const title = String(video.title || '（无标题）');
    const heading = el('h3', null, title);
    if (title.length > TITLE_CLAMP_LENGTH) heading.classList.add('is-clamped');
    card.append(heading);
    if (title.length > TITLE_CLAMP_LENGTH) {
      // ⭐ 卡片本身是按钮：展开按钮必须阻止冒泡，否则点「展开」会连带打开拆解卡。
      const toggle = el('button', 'bm-title-toggle', '展开');
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const clamped = heading.classList.toggle('is-clamped');
        toggle.setAttribute('aria-expanded', String(!clamped));
        toggle.textContent = clamped ? '展开' : '收起';
      });
      card.append(toggle);
    }
    const meta = el('div', 'bm-video-meta');
    if (video.accountName) meta.append(el('span', null, video.accountName));
    if (video.niche) meta.append(el('span', null, video.niche));
    if (video.durationSec) meta.append(el('span', null, durationText(video.durationSec)));
    meta.append(el('span', null, video.tagStatus === 'tagged' ? '已拆解' : '待拆解'));
    card.append(meta);
    const stats = el('div', 'bm-video-stats');
    stats.append(el('span', null, '互动 '), el('b', null, formatCount(video.engagementIndex)));
    stats.append(el('span', null, `赞 ${formatCount(video.likeCount)}`));
    stats.append(el('span', null, `藏 ${formatCount(video.collectCount)}`));
    stats.append(el('span', null, `享 ${formatCount(video.shareCount)}`));
    stats.append(el('span', null, `评 ${formatCount(video.commentCount)}`));
    card.append(stats);
    const foot = el('div', 'bm-video-foot');
    foot.append(el('span', null, '点开看拆解'));
    card.append(foot);
    card.addEventListener('click', () => openDetail(video.videoId));
    return card;
  }

  function renderVideos(reset) {
    const box = id('videos');
    box.replaceChildren();
    state.videos.forEach((video) => box.append(videoCard(video)));
    id('videos-empty').hidden = state.total > 0;
    id('list-count').textContent = `共 ${state.total} 条`;
    id('load-more').hidden = true;
    const sortName = state.sortBy === 'engagement' ? '互动指数' : id('sort').selectedOptions[0].textContent;
    id('sort-hint').textContent = `按${sortName}从高到低排序（内部打分公式：综合互动指数＝点赞＋收藏×2＋分享×3＋评论×2）`;
  }

  async function loadVideos(reset, clearSearch = false) {
    if (reset) return videoView.reset({ clearSearch });
    const query = new URLSearchParams({
      limit: String(state.pageSize),
      offset: String(state.offset)
    });
    if (state.search) query.set('q', state.search);
    // ⭐ 两条筛选路径互斥：选了「赛道列表」里的语料赛道就发 ?niche=，
    //    否则发 ?track=（__all__ 是全部）与 ?sub=（细分方向）。
    if (state.niche) {
      query.set('niche', state.niche);
    } else {
      query.set('track', state.trackCode || state.allTrackCode);
      if (state.subtrackCode) query.set('sub', state.subtrackCode);
    }
    if (state.accountId) query.set('accountId', state.accountId);
    if (state.hookType) query.set('hookType', state.hookType);
    query.set('sortBy', state.sortBy);
    const requestId = ++videoRequest;
    const result = await api('/videos?' + query.toString());
    if (requestId !== videoRequest) return result;
    if (!result.ok) throw new Error(result.message || '对标内容没有加载成功，请刷新重试。');
    state.videos = result.items || [];
    state.total = result.total || 0;
    state.totalNoHook = Number.isFinite(result.totalNoHook) ? result.totalNoHook : (result.total || 0);
    state.hookCounts = result.hookCounts || {};
    // 换赛道后原钩子可能已变成 0 条：renderHookOptions 会回落到「全部钩子」，
    // 这时要按回落后的条件重新拉一次，否则会员仍停在空列表上（最多递归一层）。
    if (renderHookOptions()) {
      await loadVideos(true);
      return;
    }
    return { ...result, page: Math.floor(state.offset / state.pageSize) + 1 };
  }

  async function loadAccounts() {
    const query = new URLSearchParams();
    if (state.niche) {
      query.set('niche', state.niche);
    } else {
      query.set('track', state.trackCode || state.allTrackCode);
      if (state.subtrackCode) query.set('sub', state.subtrackCode);
    }
    const requestId = ++accountRequest;
    const result = await api('/accounts?' + query.toString());
    if (requestId !== accountRequest) return;
    if (!result.ok) throw new Error(result.message || '博主列表没有加载成功。');
    state.accounts = result.items || [];
    renderAccounts();
  }

  async function bootstrap() {
    const result = await api('/bootstrap');
    if (!result.ok) throw new Error(result.message || '爆款拆解暂时打不开，请刷新重试。');
    state.tracks = result.tracks || [];
    state.recommended = result.recommended || null;
    state.trackTree = result.trackTree || [];
    state.trackGroups = result.trackGroups || [];
    // 语料赛道 → 二级细分 的索引，赛道列表靠它跟着细分方向走
    state.rawSubtracks = result.rawSubtracks || {};
    state.rawIndustries = result.rawIndustries || {};
    if (result.allTrackCode) state.allTrackCode = result.allTrackCode;
    state.allCorpus = result.allCorpus || { videoCount: 0, accountCount: 0 };
    state.recommendedTrack = result.recommendedTrack || null;
    state.templates = result.templates || [];
    state.hookTypes = result.hookTypes || [];
    state.quota = result.quota || state.quota;
    // ⭐ 默认落在「全部」：会员不必先挑赛道才看得到内容。
    //    有自画像推荐时也不强行切过去 —— 推荐只在提示里给，选择权留给会员。
    state.trackCode = state.allTrackCode;
    state.subtrackCode = '';
    state.niche = '';
    // 具体选项由 loadVideos 拿到真实条数后经 renderHookOptions 渲染（这里不预填，
    // 否则会先闪一版没有条数、没有禁用态的下拉，再被覆盖）。
    renderTracks();
    await loadAccounts();
    await loadVideos(true);
    renderQuota();
  }

  function renderQuota() {
    id('ai-topics-quota').textContent = quotaText(state.quota.topics);
    id('ai-script-quota').textContent = quotaText(state.quota.scripts);
  }

  /* ---------- 拆解卡 ---------- */
  async function openDetail(videoId) {
    status('detail-status', '正在读取拆解卡…');
    const result = await api('/videos/' + encodeURIComponent(videoId));
    if (!result || !result.ok) {
      toast((result && result.message) || '没有打开这条内容，请稍后重试。');
      return;
    }
    const video = result.video;
    state.current.video = video;
    state.current.canGenerate = Boolean(result.canGenerate);
    id('detail-title').textContent = video.title || '这条爆款是怎么做出来的';
    id('detail-meta').textContent = [
      video.accountName,
      video.niche,
      durationText(video.durationSec),
      `互动指数 ${formatCount(video.engagementIndex)}`,
      `赞 ${formatCount(video.likeCount)} · 藏 ${formatCount(video.collectCount)} · 享 ${formatCount(video.shareCount)} · 评 ${formatCount(video.commentCount)}`
    ].filter(Boolean).join(' · ');

    const masked = id('detail-masked');
    masked.hidden = !result.maskedNotice;
    masked.textContent = result.maskedNotice || '';

    const tags = video.tags;
    const blocks = id('detail-tags');
    blocks.replaceChildren();
    const empty = id('detail-empty');
    empty.replaceChildren();
    empty.hidden = Boolean(tags);
    id('detail-summary').hidden = !tags;
    if (!tags) {
      const block = el('div', 'bm-tag-block');
      block.append(el('h4', null, video.analysisNeedsReview ? '原文已更新，等待复核拆解' : '还没有拆解'));
      block.append(el('p', null, '这条内容还没完成七维拆解，暂时不能基于它生成选题。可以先看文案，或换一条已经拆解好的。'));
      empty.append(block);
    } else {
      // ⭐ 结构骨架卡片已删：它的内容就是逐段拆解的段名 + 占比，在上方已经完整呈现，
      //    再列一遍是重复信息（用户 2026-10-15 反馈）。
      blocks.append(tagBlock('怎么开场', [summaryOpeningLabel(tags.hookType)]));
      blocks.append(tagBlock('哪种互动更突出', interactionSummaryItems(video)));
      // ⭐「表达特征（不要搬）」「不可搬（别人的专属）」两张卡已删（2026-10-15 用户要求）：
      //    前者是修辞名罗列，后者与下方「怎么理解学与不学」重复，卡片太密反而没人看。
      const migratableBlock = tagBlock('可以借鉴', tags.migratable || []);
      blocks.append(migratableBlock);
      const layer = tags.tagLayers || {};
      if (layer.structure || layer.expression) {
        const understandingBlock = tagBlock('怎么换成自己的', [`讲述顺序：${layer.structure || '—'}`, `表达方式：${layer.expression || '—'}`]);
        // 两张相关卡片保持相同宽度，不按说明条数单独缩窄。
        understandingBlock.classList.toggle('is-short', migratableBlock.classList.contains('is-short'));
        blocks.append(understandingBlock);
      }
    }
    id('detail-script').textContent = video.scriptRefined || video.scriptRaw || '（这条没有抓到文案）';
    renderDetailSegments(tags, video);
    renderDetailLearning(tags);
    const source = id('detail-source');
    if (video.sourceUrl) {
      source.href = video.sourceUrl;
      source.hidden = false;
    } else {
      source.hidden = true;
    }
    const create = id('detail-create');
    create.disabled = !result.canGenerate;
    create.textContent = result.canGenerate ? '在这条上建选题' : '待拆解，暂不能建选题';
    status('detail-status', result.canGenerate ? '' : '这条还没完成拆解，先看看文案，或换一条已经拆解好的。');
    const dialog = id('detail');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  /**
   * 逐段拆解：把「结构骨架」落到每一段上——这段在干什么、占多长、能不能搬。
   *
   * ⭐ 为什么值得做：七维标签是**结论**，段落才是**证据**。只给标签，会员看到
   *    「清单式开头」却不知道对应原文的哪一句，学完还是不会写；把段落摆出来，
   *    他才能照着「这一段负责抛问题 → 那我也这么开头」去套。
   * ⭐ 但必须优雅降级：段落来自打标（structure_json）。当前线上 taggedCount 为 0，
   *    没有段落数据就**整块隐藏**，只用规则切分（按句号/换行）会切得很差、
   *    比不给更误导。等打标跑完，这里会自动出现分段。
   */
  /**
   * 把原文按各段的占比切成一段段（**对齐到句子边界**，不在句子中间切断）。
   *
   * ⭐ 打标数据 structure_json 只有 {label, ratio}，**没有段落原文**，
   *    所以这一步是按比例还原出来的位置，不是标注者手切的。
   *    因此界面上必须说明是「按占比对齐」，不能让会员以为是精确的逐句标注。
   * ⭐ 最后一段吃掉剩余全部：各段比例加起来未必正好 100，
   *    逐段扣会累计误差，最后丢字或重复。
   */
  function splitScriptByRatio(script, segments) {
    const text = String(script || '');
    if (!text || !segments.length) return [];
    // 逐字符扫而不是正则 lookbehind —— 后者在微信内置浏览器等老内核上会直接抛错
    const sentences = splitSentences(text);
    if (!sentences.length) return [];

    const total = text.length;
    const ratios = segments.map((item) => Number(item.ratio) || 0);
    const sum = ratios.reduce((acc, item) => acc + item, 0) || 100;
    const out = [];
    let cursor = 0;
    segments.forEach((item, index) => {
      const remainingSents = sentences.length - cursor;
      const remainingSegs = segments.length - index; // 含本段
      if (remainingSents <= 0) {
        out.push('');
        return;
      }
      if (index === segments.length - 1) {
        out.push(sentences.slice(cursor).join('').trim()); // 最后一段收尾，避免比例误差丢字
        return;
      }
      // ⭐ 本段最多能吃几句：必须给后面的段留够，否则短文案会出现「后几段全空」
      const max = remainingSents - (remainingSegs - 1);
      let end = cursor + 1; // 至少一句
      if (max > 1) {
        const target = (ratios[index] / sum) * total;
        let acc = sentences[cursor].length;
        while (end < cursor + max && acc < target) {
          acc += sentences[end].length;
          end += 1;
        }
      }
      out.push(sentences.slice(cursor, end).join('').trim());
      cursor = end;
    });
    return out;
  }

  /** 按句末标点切句，保留标点。英文句点也算，但跳过 3.5 这类小数点。 */
  function splitSentences(text) {
    const sentences = [];
    let buf = '';
    const chars = [...text];
    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i];
      buf += ch;
      if ('。！？!?；;\n'.includes(ch)) {
        sentences.push(buf);
        buf = '';
        continue;
      }
      // ⭐ 语料里中英文标点混用很常见（用户给的示例就是「…那一天.」），
      //    不认 '.' 会把整段当一句，切出来毫无意义。但别把 3.5 的小数点当句末。
      if (ch === '.') {
        const prev = chars[i - 1];
        const next = chars[i + 1];
        const isDecimal = prev >= '0' && prev <= '9' && next >= '0' && next <= '9';
        if (!isDecimal) {
          sentences.push(buf);
          buf = '';
        }
      }
    }
    if (buf.trim()) sentences.push(buf);
    return sentences;
  }

  function renderDetailSegments(tags, video) {
    const block = id('detail-segment-block');
    const box = id('detail-segments');
    if (!block || !box) return;
    box.replaceChildren();
    const segments = (tags?.structure || []).filter((item) => item && item.label);
    if (!segments.length) {
      block.hidden = true;
      return;
    }
    block.hidden = false;
    const script = video?.scriptRefined || video?.scriptRaw || '';
    // 打标若已给出段落原文就直接用；否则按占比切（见 splitScriptByRatio 的说明）
    const hasRealText = segments.some((item) => item.text);
    const texts = hasRealText ? [] : splitScriptByRatio(script, segments);

    segments.forEach((item, index) => {
      const card = el('div', 'bm-seg-card');
      const head = el('div', 'bm-seg-head');
      head.append(el('span', 'bm-seg-index', String(index + 1)));
      head.append(el('b', null, item.label || ''));
      if (item.ratio) head.append(el('span', 'bm-seg-ratio', `${tags?.tagLayers?.learning?.version === 2 ? '篇幅约占' : '约占'} ${item.ratio}%`));
      card.append(head);
      const text = item.text || texts[index] || '';
      if (text) card.append(el('p', 'bm-seg-text', text));
      for (const [label, value] of [['这一段的作用',item.purpose],['为什么这样讲',item.technique],['换成你自己的内容',item.rewriteHint]]) {
        if (typeof value !== 'string' || !value.trim()) continue;
        const detail=el('div','bm-seg-explain');detail.append(el('b',null,label),el('p',null,value));card.append(detail);
      }
      box.append(card);
    });

    if (!script) {
      box.append(el('p', 'pm-muted', '这条没抓到原文文案，只能看到结构。'));
    } else if (!hasRealText) {
      // ⭐ 必须交代清楚：这是按占比还原的，不是人工逐句标的
      box.append(el('p', 'pm-muted', '段落起止按各段占比对齐到句子边界，供你照着套用；不是逐句精确标注。'));
    }
  }

  // 新拆解保存在原有标签JSON中；老卡片保持可读，不在浏览时悄悄付费重跑。
  function renderDetailLearning(tags) {
    const root=id('detail-learning'); if(!root) return; root.replaceChildren();
    const learning=tags?.tagLayers?.learning;
    if(learning?.version!==2) {
      if(tags) root.append(el('p','bm-cost-note','这是较早的拆解，暂未包含完整写法和示范。可请运营官按新版规范重新拆解；查看本卡片不会调用智能员工。'));
      return;
    }
    const section=(number,title,description)=>{
      const card=el('section','bm-learning-section');
      const head=el('h3');head.append(el('span','bm-learning-number',number),document.createTextNode(title));card.append(head);
      if(description)card.append(el('p','bm-learning-intro',description));root.append(card);return card;
    };
    const framework=learning.framework || {};
    const method=section('02','照这个顺序，换成你自己的内容',learning.summary);
    method.append(el('h4','bm-framework-name',framework.name));
    const steps=el('ol','bm-framework-steps');
    (framework.steps || []).forEach(step=>{const li=el('li');li.append(el('b',null,step.label),el('p',null,step.writingHint));steps.append(li);});method.append(steps);
    const example=learning.example || {};
    const sample=section('03','看一个换行业的示范',example.scenario);
    sample.append(el('p','bm-example-notice','虚构教学示范 · 仅用于理解写法，请换成自己的真实素材'));
    const dialogue=el('div','bm-example-dialogue');
    (example.lines || []).forEach(line=>{const row=el('div','bm-example-line');row.append(el('b',null,line.speaker),el('p',null,line.text));dialogue.append(row);});sample.append(dialogue);
    const logic=section('04','这条内容为什么能让人想听下去','以下是根据文字作出的分析；观看反应是推测，不代表一定会获得流量或成交。');
    const grid=el('div','bm-logic-grid');
    (learning.logic || []).forEach(item=>{const card=el('div','bm-logic-card');card.append(el('h4',null,item.label),el('p',null,item.value),el('blockquote',null,'原文依据：'+item.evidence));grid.append(card);});logic.append(grid);
    const boundary=section('05','用之前，先留意这些边界');
    const cautions=el('ul','bm-learning-cautions');(learning.cautions || []).forEach(item=>cautions.append(el('li',null,item)));boundary.append(cautions);
  }

  /**
   * 拆解卡里的一张卡。
   * ⭐ 内容少的（≤ SHORT_BLOCK_MAX_LINES 行）自动并排两列，内容多的独占一行。
   *    按**实际行数**分流而不是写死哪几个卡片——以后新增卡片不用回来改名单。
   */
  function tagBlock(title, lines) {
    const block = el('div', 'bm-tag-block');
    const count = (lines || []).filter(Boolean).length;
    if (count > 0 && count <= SHORT_BLOCK_MAX_LINES) block.classList.add('is-short');
    block.append(el('h4', null, title));
    if (!count) {
      block.append(el('p', 'pm-muted', '—'));
      return block;
    }
    const list = el('ul');
    lines.filter(Boolean).forEach((line) => list.append(el('li', null, line)));
    block.append(list);
    return block;
  }

  function hookLabel(value) {
    return state.hookTypes.find((item) => item.id === value)?.label || value || '未标注';
  }

  function summaryOpeningLabel(value) {
    const map = { question: '用提问引出话题', number: '用数字抓住注意', warning: '先提醒一个问题',
      story: '从一个故事讲起', contrarian: '先说一个不同看法', identity: '先点出目标人群', other: '其他开场方式' };
    return map[value] || '暂未归纳';
  }

  function interactionSummaryItems(video) {
    const summary = video.interactionSummary;
    if (!summary || typeof summary.label !== 'string' || typeof summary.basis !== 'string') {
      return ['互动判断暂时无法读取，可以先查看上方的点赞、收藏、分享和评论次数。'];
    }
    return [summary.label, summary.basis];
  }

  /* ---------- 建选题（自有论据硬闸） ---------- */
  function openTopicDialog() {
    const video = state.current.video;
    if (!video) return;
    state.current.candidates = [];
    id('evidence').value = '';
    id('audience').value = '';
    const select = id('template');
    select.replaceChildren();
    state.templates.forEach((item) => select.append(new Option(`${item.id} ${item.name} · 冲${item.goal}`, item.id)));
    const suggested = state.current.video?.tags?.metricProfile;
    const map = { collect: 'T4', comment: 'T6', share: 'T2', like: 'T1', mixed: 'T3' };
    if (suggested && map[suggested]) select.value = map[suggested];
    id('ai-candidates').hidden = true;
    id('ai-candidates').replaceChildren();
    status('topic-status', '');
    const dialog = id('topic');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  async function runAiTopics() {
    const video = state.current.video;
    if (!video) return;
    await confirmAi({
      kind: 'topic',
      action: 'AI 生成 3 个候选选题',
      chars: 1500,
      run: async () => {
        status('topic-status', 'AI 正在生成候选选题…');
        try {
          const result = await api('/topics/generate', {
            method: 'POST',
            body: {
              sourceVideoId: video.videoId,
              templateId: id('template').value,
              targetAudience: id('audience').value.trim()
            }
          });
          if (!result.ok) throw new Error(result.message || 'AI 这次没有给出选题，请稍后重试。');
          state.current.candidates = result.items || [];
          renderCandidates();
          if (result.quota) {
            state.quota.topics = { ...state.quota.topics, used: result.quota.used };
            renderQuota();
          }
          status('topic-status', '选一个最像你的，把论据补到上面那一栏。');
        } catch (error) {
          status('topic-status', error.message || 'AI 生成没有成功，请稍后重试。', true);
        }
      }
    });
  }

  function renderCandidates() {
    const box = id('ai-candidates');
    box.replaceChildren();
    const list = state.current.candidates || [];
    if (!list.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    list.forEach((item) => {
      const card = el('button', 'bm-candidate');
      card.type = 'button';
      card.append(el('h4', null, item.title));
      if (item.angle) card.append(el('p', null, item.angle));
      if (item.evidenceNeeded) card.append(el('p', null, `需要你补充：${item.evidenceNeeded}`));
      card.addEventListener('click', () => {
        document.querySelectorAll('.bm-candidate').forEach((node) => node.classList.remove('is-active'));
        card.classList.add('is-active');
        if (!id('evidence').value.trim() && item.evidenceNeeded) {
          id('evidence').value = item.evidenceNeeded;
        }
        if (item.templateId) id('template').value = item.templateId;
      });
      box.append(card);
    });
  }

  async function submitTopic() {
    const video = state.current.video;
    const evidence = id('evidence').value.trim();
    if (!evidence) {
      status('topic-status', '请先填「我自己的论据」。没有这一项，生成出来的内容会和别人一样。', true);
      id('evidence').focus();
      return;
    }
    status('topic-status', '正在保存…');
    try {
      const result = await api('/topics', {
        method: 'POST',
        body: {
          sourceVideoId: video.videoId,
          ownEvidence: evidence,
          targetAudience: id('audience').value.trim(),
          templateId: id('template').value
        }
      });
      if (!result.ok) throw new Error(result.message || '选题没有保存成功，请重试。');
      closeTopicDialog();
      toast('✓ 选题已保存，随后在【我的选题】继续成稿');
      switchTab('topics');
      await loadTopics();
      openDraftDialog(result.topicId);
    } catch (error) {
      status('topic-status', error.message || '选题没有保存成功，请重试。', true);
    }
  }

  function closeTopicDialog() {
    const dialog = id('topic');
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function switchTab(key) {
    const button = document.querySelector(`[data-bm-tab="${key}"]`);
    if (button) button.click();
  }

  /* ---------- 选题库 ---------- */
  async function loadTopics() {
    const result = await api('/topics');
    if (!result.ok) throw new Error(result.message || '选题没有加载成功，请刷新重试。');
    state.topics = result.items || [];
    renderTopics('topics', state.topics, false);
  }

  async function loadStats() {
    const [topics, baseline] = await Promise.all([
      api('/topics'),
      api('/baseline')
    ]);
    if (!topics.ok) throw new Error(topics.message || '选题没有加载成功，请刷新重试。');
    state.topics = topics.items || [];
    const published = state.topics.filter((item) => item.status === 'published' || item.status === 'reviewed');
    renderTopics('stats-list', published, true);
    id('stats-empty').hidden = published.length > 0;
    renderBaseline(baseline.baseline);
  }

  function renderBaseline(baseline) {
    const box = id('baseline');
    box.replaceChildren();
    if (!baseline || !baseline.sample_count) {
      box.hidden = true;
      const hint = el('p', 'pm-muted', '回填满 5 条之后，这里会出现「按你自己的效果」推荐：哪个模板更适合你、互动中位数是多少。');
      box.append(hint);
      box.hidden = false;
      return;
    }
    box.hidden = false;
    const add = (label, value) => {
      const cell = el('div');
      cell.append(el('span', null, label));
      cell.append(el('b', null, value));
      box.append(cell);
    };
    add('已回填', `${baseline.sample_count} 条`);
    add('互动中位数', formatCount(baseline.median_engagement));
    if (baseline.best_template_id) add('更适合你的模板', baseline.best_template_id);
  }

  /**
   * 选题库 / 发布记录里的模板：只写「模板 T3」会员不知道那是什么，
   * 带上模板名和它冲什么（例：模板T3（案例复盘·冲信任与成交））。
   */
  function templateLabel(id) {
    const template = (state.templates || []).find((item) => item.id === id);
    return template ? `模板${template.id}（${template.name}·冲${template.goal}）` : `模板 ${id}`;
  }

  function renderTopics(containerKey, items, withStats, pageOnly = false) {
    if (!pageOnly) {
      if (!topicViews[containerKey]) topicViews[containerKey] = window.WxgcBenchmarkList.create({
        target: id(containerKey), label: withStats ? '发布记录' : '我的选题', placeholder: '搜索自己的经历、客户或模板',
        // 能按「案例复盘」这种模板名搜到，会员记不住 T3 这种编号。
        searchText: topic => [topic.ownEvidence, topic.targetAudience, topic.templateId, templateLabel(topic.templateId), topic.status].join(' '),
        render: list => renderTopics(containerKey, list, withStats, true)
      });
      return topicViews[containerKey].setItems(items);
    }
    const box = id(containerKey);
    box.replaceChildren();
    if (!items.length) {
      id(containerKey === 'topics' ? 'topics-empty' : 'stats-empty').hidden = false;
      return;
    }
    id(containerKey === 'topics' ? 'topics-empty' : 'stats-empty').hidden = true;
    items.forEach((topic) => {
      const card = el('div', 'bm-topic-card');
      // ⭐ 「对标」要能点开拆解卡：会员在选题库里只看到一串截断的 id，
      //    根本不知道自己对标的是哪位博主、原文讲了什么（用户 2026-10-15 要求）。
      const heading = el('h3');
      if (topic.sourceVideoId) {
        // ⭐ 认不出自己对标的是哪条内容，等于白建选题：显示原标题 + 博主，点开仍是拆解卡。
        const author = topic.sourceAccountName ? ` （${topic.sourceAccountName}）` : '';
        const text = topic.sourceTitle ? `${topic.sourceTitle}${author}` : `对标 ${topic.sourceVideoId.slice(0, 12)}…`;
        const link = el('button', 'bm-topic-source', text);
        link.type = 'button';
        link.title = topic.sourceTitle ? `对标：${text}（点击打开拆解卡）` : '打开这条对标内容的拆解卡';
        link.addEventListener('click', () => { openDetail(topic.sourceVideoId); });
        heading.append(link);
      } else {
        heading.append(el('span', null, '自有选题'));
      }
      card.append(heading);
      const row = el('div', 'bm-topic-row');
      row.append(el('span', 'bm-badge is-tagged', statusLabel(topic.status)));
      if (topic.templateId) row.append(el('span', null, templateLabel(topic.templateId)));
      if (topic.hookType) row.append(el('span', null, hookLabel(topic.hookType)));
      if (topic.targetAudience) row.append(el('span', null, `说给：${topic.targetAudience}`));
      card.append(row);
      if (topic.ownEvidence) card.append(el('p', 'bm-topic-evidence', topic.ownEvidence));
      if (withStats && topic.stats) {
        const stats = el('div', 'bm-video-stats');
        stats.append(el('span', null, `第 ${topic.stats.snapshotDay} 天`));
        stats.append(el('span', null, `互动 ${formatCount(topic.stats.engagementIndex)}`));
        stats.append(el('span', null, `涨粉 ${topic.stats.followerDelta}`));
        card.append(stats);
      }
      const actions = el('div', 'bm-topic-actions');
      actions.append(button('继续成稿', () => openDraftDialog(topic.topicId), 'pm-btn pm-primary'));
      if (!withStats) {
        const next = topic.status === 'candidate' ? 'scripted' : (topic.status === 'scripted' ? 'published' : 'reviewed');
        actions.append(button(`标记${statusLabel(next)}`, async () => {
          const result = await api('/topics/' + encodeURIComponent(topic.topicId), { method: 'PATCH', body: { status: next } });
          if (!result.ok) { toast(result.message || '状态没有更新成功，请重试。'); return; }
          await loadTopics();
        }));
      }
      if (withStats) {
        actions.append(button('回填数据', () => openStatsDialog(topic)));
      }
      actions.append(button('删除', async () => {
        if (!(await window.WxgcMember.confirm('删除这个选题？它的草稿和回填数据也会一起删掉。'))) return;
        const result = await api('/topics/' + encodeURIComponent(topic.topicId), { method: 'DELETE' });
        if (!result.ok) { toast(result.message || '删除没有成功，请重试。'); return; }
        toast('✓ 选题已删除');
        if (withStats) await loadStats(); else await loadTopics();
      }));
      card.append(actions);
      box.append(card);
    });
  }

  function button(label, onClick, className) {
    const node = el('button', className || 'pm-btn', label);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  function statusLabel(status) {
    const map = { candidate: '待成稿', scripted: '已成稿', published: '已发布', reviewed: '已复盘' };
    return map[status] || status;
  }

  /* ---------- 填空式成稿 ---------- */
  async function openDraftDialog(topicId) {
    const topic = state.topics.find((item) => item.topicId === topicId);
    if (!topic) {
      const result = await api('/topics');
      if (result.ok) state.topics = result.items || [];
    }
    const found = state.topics.find((item) => item.topicId === topicId);
    if (!found) { toast('没有找到这个选题，请刷新后重试。'); return; }
    state.current.topic = found;
    const template = state.templates.find((item) => item.id === found.templateId);
    if (!template) { toast('这个选题的脚本模板不存在，请重新创建选题。'); return; }
    state.current.template = template;
    state.current.draft = null;
    id('draft-title').textContent = `${template.id} ${template.name} · 冲${template.goal}`;
    id('draft-evidence').textContent = `你填的论据：${found.ownEvidence}`;
    renderSegments(template);
    id('result').hidden = true;
    status('draft-status', '每一段都写了你自己的素材，AI 才能成稿。空着的段落不能串稿。');
    const dialog = id('draft');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    try {
      const saved=await api('/scripts?'+new URLSearchParams({topicId,limit:'1'}));
      if(state.current.topic?.topicId!==topicId)return;
      if(saved.items?.[0]){state.current.draft=saved.items[0];renderResult(saved.items[0]);status('draft-status','已载入这份选题最近保存的稿子，可以复制，或打开做内容继续修改。');}
    }catch{status('draft-status','之前的稿子暂时没有加载出来，可以关闭后重试。');}
  }

  function renderSegments(template) {
    const box = id('segments');
    box.replaceChildren();
    // ⭐ 段落定义只认后端下发的 template.segments。
    //    2026-10-15 线上事故：这里曾回退到一个**从未被定义过的全局模板变量**，
    //    回退结果恒为空数组 → 段落区一片空白、会员无处可填，
    //    点「AI 串稿」必被后端拒「还有 N 段没写完」。宁可显式报错，也不要静默变空。
    const source = (template && Array.isArray(template.segments)) ? template.segments : [];
    state.current.segments = source.map((segment) => ({ segmentKey: segment.key, segmentLabel: segment.label, material: '', text: '' }));
    if (!source.length) {
      box.append(el('p', 'pm-muted', '段落没有加载出来，请刷新页面重试。'));
      return;
    }
    source.forEach((segment, index) => {
      const block = el('div', 'bm-segment');
      const head = el('div', 'bm-segment-head');
      head.append(el('h4', null, `${index + 1}. ${segment.label}`));
      head.append(el('span', null, `占时长 ${segment.ratio}%`));
      block.append(head);
      block.append(el('p', 'pm-muted', segment.hint || ''));
      const area = el('textarea');
      area.rows = 3;
      area.placeholder = '写下你自己的素材：真实动作、客户原话、可核对的数字';
      area.addEventListener('input', () => { state.current.segments[index].material = area.value; });
      block.append(area);
      const actions = el('div', 'bm-segment-actions');
      const aiButton = button(`AI 成稿这一段（${segment.label}）`, async () => {
        const material = area.value.trim();
        if (!material) {
          status('draft-status', `请先在「${segment.label}」写下你自己的素材，再让 AI 成稿。AI 不替你编经历。`, true);
          area.focus();
          return;
        }
        await confirmAi({
          kind: 'segment',
          action: `AI 成稿「${segment.label}」这一段`,
          chars: 900,
          run: async () => {
            status('draft-status', 'AI 正在写这一段…');
            try {
              const result = await api('/scripts/segment', {
                method: 'POST',
                body: {
                  topicId: state.current.topic.topicId,
                  segmentIndex: index,
                  material
                }
              });
              if (!result.ok) throw new Error(result.message || '这一段没有成稿，请稍后重试。');
              state.current.segments[index].text = result.text || '';
              state.current.segments[index].material = material;
              renderSegmentResult(block, index, result.text || '');
              if (result.quota) {
                state.quota.scripts = { ...state.quota.scripts, used: result.quota.used };
                renderQuota();
              }
              status('draft-status', `「${segment.label}」已成稿，可以再改改让它更像你。`);
            } catch (error) {
              status('draft-status', error.message || '这一段没有成稿，请稍后重试。', true);
            }
          }
        });
      });
      actions.append(aiButton);
      block.append(actions);
      const resultBox = el('div', 'bm-segment-result');
      resultBox.hidden = true;
      block.append(resultBox);
      block.dataset.segmentIndex = String(index);
      box.append(block);
    });
  }

  function renderSegmentResult(block, index, text) {
    const resultBox = block.querySelector('.bm-segment-result');
    if (!resultBox) return;
    resultBox.replaceChildren();
    resultBox.hidden = !text;
    if (!text) return;
    const area = el('textarea');
    area.rows = 4;
    area.value = text;
    area.addEventListener('input', () => { state.current.segments[index].text = area.value; });
    resultBox.append(area);
  }

  async function runFinalize() {
    const segments = state.current.segments || [];
    // ⭐ 空数组必须拦住：空集的「没写完的段」是 0，会让下面的判断直接放行，
    //    结果请求发出去被后端拒，会员只看到一句看不懂的「还有 N 段没写完」。
    if (!segments.length) {
      status('draft-status', '段落没有加载出来，请刷新页面重试。', true);
      return;
    }
    const missing = segments.filter((item) => !String(item.text || '').trim());
    if (missing.length) {
      status('draft-status', `还有 ${missing.length} 段没成稿：${missing.map((item) => item.segmentLabel).join('、')}。`, true);
      return;
    }
    await confirmAi({
      kind: 'script',
      action: 'AI 串稿并生成 3 个标题',
      chars: 2200,
      run: async () => {
        status('draft-status', 'AI 正在串稿…');
        try {
          const result = await api('/scripts/finalize', {
            method: 'POST',
            body: { topicId: state.current.topic.topicId, segments }
          });
          if (!result.ok) throw new Error(result.message || '串稿没有成功，请稍后重试。');
          state.current.draft = result;
          renderResult(result);
          if (result.quota) {
            state.quota.scripts = { ...state.quota.scripts, used: result.quota.used };
            renderQuota();
          }
          status('draft-status', '串好了。检查一下标题和口播稿，点击“打开做内容”即可带入并继续修改。');
        } catch (error) {
          status('draft-status', error.message || '串稿没有成功，请稍后重试。', true);
        }
      }
    });
  }

  function renderResult(result) {
    id('result').hidden = false;
    id('open-studio').href='/creator-workbench/member/video-studio.html?benchmarkDraft='+encodeURIComponent(result.draftId);
    const titles = id('result-titles');
    titles.replaceChildren();
    (result.titles || []).forEach((title) => titles.append(el('li', null, title)));
    id('result-script').textContent = result.scriptText || '';
    const timeline = id('result-timeline');
    timeline.replaceChildren();
    (result.timeline || []).forEach((item) => {
      timeline.append(el('li', null, `${item.segmentLabel}：${item.startSec}s – ${item.endSec}s`));
    });
    id('result-hashtags').textContent = (result.hashtags || []).length ? '话题：' + (result.hashtags || []).map((item) => '#' + item).join(' ') : '';
    const sim = id('result-similarity');
    const report = result.similarity || {};
    sim.hidden = !report.flagged;
    sim.textContent = report.flagged
      ? '原创度提醒：' + (report.reasons || []).join('；')
      : '';
  }

  /** 复制文字并在浏览器模态层显示结果，不触发模型或新建任务。 */
  async function copyToStudio() {
    const draft = state.current.draft;
    if (!draft) { toast('还没有成稿，先串稿再复制。'); return; }
    const lines = [];
    if ((draft.titles || []).length) {
      lines.push('标题候选：');
      draft.titles.forEach((title, index) => lines.push(`${index + 1}. ${title}`));
      lines.push('');
    }
    lines.push('口播稿：');
    lines.push(draft.scriptText || '');
    if ((draft.timeline || []).length) {
      lines.push('');
      lines.push('时间轴：');
      draft.timeline.forEach((item) => lines.push(`${item.segmentLabel}：${item.startSec}s – ${item.endSec}s`));
    }
    if ((draft.hashtags || []).length) {
      lines.push('');
      lines.push((draft.hashtags || []).map((item) => '#' + item).join(' '));
    }
    const ok = await copyText(lines.join('\n'));
    id('copy-notice-title').textContent=ok?'已复制成功':'这次没有复制成功';
    id('copy-notice-message').textContent=ok?'已复制选题、口播稿和相关说明。':'你仍可以点击“打开做内容”带入选题和稿子，不依赖剪贴板。';
    id('copy-notice').showModal();
  }

  /* ---------- 回填 ---------- */
  function openStatsDialog(topic) {
    state.current.topic = topic;
    id('stats-topic').textContent = topic.ownEvidence || '';
    id('stats-day').value = '3';
    id('stats-like').value = '';
    id('stats-collect').value = '';
    id('stats-share').value = '';
    id('stats-comment').value = '';
    id('stats-follower').value = '';
    status('stats-status', '同一天的数据重复填只会覆盖，不会重复计数。');
    const dialog = id('stats');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  async function submitStats() {
    const topic = state.current.topic;
    if (!topic) return;
    const body = {
      snapshotDay: Number(id('stats-day').value) === 7 ? 7 : 3,
      likeCount: Number(id('stats-like').value || 0),
      collectCount: Number(id('stats-collect').value || 0),
      shareCount: Number(id('stats-share').value || 0),
      commentCount: Number(id('stats-comment').value || 0),
      followerDelta: Number(id('stats-follower').value || 0)
    };
    status('stats-status', '正在保存…');
    try {
      const result = await api('/topics/' + encodeURIComponent(topic.topicId) + '/stats', { method: 'PUT', body });
      if (!result.ok) throw new Error(result.message || '数据没有保存成功，请重试。');
      const dialog = id('stats');
      if (dialog.open && typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
      toast('✓ 数据已记录');
      await loadStats();
    } catch (error) {
      status('stats-status', error.message || '数据没有保存成功，请重试。', true);
    }
  }

  /* ---------- 绑定 ---------- */
  const initialize = () => {
    const videoToolbar = id('hook').closest('.bm-list-toolbar');
    const hookField = id('hook').closest('label'); hookField.classList.add('bm-hook-field');
    const videoFilters = document.createDocumentFragment();
    videoFilters.append(hookField, id('sort').closest('label'));
    videoView = window.WxgcBenchmarkList.create({ target: id('videos'), label: '对标内容', placeholder: '搜索视频标题、博主或赛道', pageSize: state.pageSize,
      beforeSearch: videoFilters, afterActions: id('list-count'),
      load: async ({ page, q, pageSize }) => { state.offset = (page - 1) * pageSize; state.search = q; return loadVideos(false); },
      render: (items, result) => { state.videos = items; state.total = result.total || 0; renderVideos(true); }
    });
    videoToolbar.remove();
    bindTabs();
    // 小赛道折叠组：开合都走 state，重渲染（点别的赛道）后不丢当前开合状态
    id('tracks-toggle').addEventListener('click', () => {
      state.tracksExpanded = !state.tracksExpanded;
      renderTracks();
    });
    // 三级联动：改了上级必须重置下级，否则会拼出「教育培训 + 口腔健康」这种
    // 跨父子组合（服务端也会拒绝，会员只会看到莫名其妙的空列表）。
    id('l1').addEventListener('change', () => {
      const value = id('l1').value;
      state.trackCode = value || state.allTrackCode;
      state.subtrackCode = '';
      state.niche = ''; // 与「赛道列表」互斥
      applyTrackChange();
    });
    id('l2').addEventListener('change', () => {
      state.subtrackCode = id('l2').value || '';
      state.niche = '';
      applyTrackChange();
    });
    id('hook').addEventListener('change', () => {
      state.hookType = id('hook').value;
      state.offset = 0;
      loadVideos(true).catch((error) => status('status', error.message, true));
    });
    id('sort').addEventListener('change', () => {
      state.sortBy = id('sort').value;
      state.offset = 0;
      loadVideos(true).catch((error) => status('status', error.message, true));
    });
    id('topics-refresh').addEventListener('click', () => {
      loadTopics().catch((error) => status('status', error.message, true));
    });
    id('detail-create').addEventListener('click', openTopicDialog);
    id('ai-topics').addEventListener('click', () => { runAiTopics(); });
    id('topic-submit').addEventListener('click', () => { submitTopic(); });
    id('ai-finalize').addEventListener('click', () => { runFinalize(); });
    id('copy-studio').addEventListener('click', () => { copyToStudio(); });
    id('copy-notice-close').addEventListener('click',()=>id('copy-notice').close());
    id('stats-submit').addEventListener('click', () => { submitStats(); });
    id('confirm-ok').addEventListener('click', () => {
      const run = confirmResolve;
      closeConfirm();
      if (run) run();
    });
    id('confirm-cancel').addEventListener('click', closeConfirm);
    document.querySelectorAll('[data-bm-detail-close]').forEach((node) => node.addEventListener('click', () => {
      const dialog = id('detail');
      if (dialog.open && typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    }));
    document.querySelectorAll('[data-bm-topic-close]').forEach((node) => node.addEventListener('click', closeTopicDialog));
    document.querySelectorAll('[data-bm-draft-close]').forEach((node) => node.addEventListener('click', () => {
      const dialog = id('draft');
      if (dialog.open && typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    }));
    document.querySelectorAll('[data-bm-stats-close]').forEach((node) => node.addEventListener('click', () => {
      const dialog = id('stats');
      if (dialog.open && typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    }));

    status('status', '正在加载…');
    bootstrap()
      .then(async () => {
        id('app').hidden = false;
        status('status', '');
        const linkedVideo=new URLSearchParams(location.search).get('videoId');
        if(linkedVideo)await openDetail(linkedVideo);
        document.dispatchEvent(new CustomEvent('replica:benchmark-ready'));
      })
      .catch((error) => {
        id('app').hidden = false;
        status('status', error.message || '爆款拆解暂时打不开，请刷新重试。', true);
      });
  };
  initialize();
})();

}
