/* Commercial positioning fields live in the existing portrait Markdown.
 * Only our delimited block is updated; all legacy prose stays intact.
 * No account, permission, sharing or API keys change.
 *
 * 2026-09-30：填写分区由 6 组重排为 9 组、字段 24 → 30，对齐 AI 读取商业自画像时用的
 * 9 段结构（C 端 / B 端 / BC 融合端共用同一套序号，三端只有段标题措辞不同，
 * 见 src/lib/ai-context.js）。这样「会员填什么」和「AI 读什么」是同一套维度，
 * 不再出现「填了 24 项、AI 只认得其中 12 项」的错位。
 *
 * ⚠️ 已有 24 个字段的 label 一个字都不能改：parse() 是按 `### <label>` 的**文字**
 *    反查 key 的，改 label 等于让老会员已保存的内容读不回来。本次只新增 6 个字段
 *    （新 key + 新 label），原有 24 个 key 与 label 全部原样保留 → 老数据零迁移。 */
(function (root) {
  'use strict';
  const groups = [
    { title: '个人 / 品牌基础信息', hint: '先让人认识你：你是谁、在哪一行、做什么。', fields: [
      ['name', '姓名 / 品牌名', '你希望客户如何称呼你'],
      ['identity', '当前身份', '例如：创业者、律师、咨询师、培训师'],
      ['industry', '所属行业', '你主要在哪个行业或领域服务']
    ] },
    { title: '产品 / 服务包', hint: '你现在靠什么帮到客户，怎么收费，客户能拿到什么结果。', fields: [
      ['business', '我现在主要做什么', '用自己的话描述目前最主要的业务'],
      ['products', '主要产品 / 服务', '产品名称、服务内容和交付方式'],
      ['price', '产品价格区间', '例如：单次咨询、月度服务或项目的价格范围'],
      ['value', '我能提供什么价值', '你具体能帮客户解决什么问题？'],
      ['outcome', '客户能够获得什么结果', '描述真实可交付的变化，不必承诺收益'],
      ['focus', '当前最重要的业务方向', '你现在最想把哪一项业务做稳？'],
      ['bottleneck', '目前最大的业务卡点', '当前最让你费心的是什么？']
    ] },
    { title: '背景与经历', hint: '你走过的路，和真实服务过的客户。', fields: [
      ['experience', '个人经历与专业背景', '哪些经历、专业或资质，让你开始做这件事？'],
      ['cases', '我的典型客户', '可以匿名描述一位客户及真实服务经历']
    ] },
    { title: '性格与风格特征', hint: '让 AI 说话像你，而不是像一份说明书。', fields: [
      ['style', '我的表达与沟通风格', '你平时怎么说话？直接、温和、爱打比方，还是讲逻辑'],
      ['styleAvoid', '我不接受的合作方式', '哪些客户或合作方式，你会婉拒？']
    ] },
    { title: '核心价值观 / 服务理念', hint: '你为什么做这件事，以及你的底线。', fields: [
      ['belief', '我做这件事的初心', '当初为什么开始？什么让你愿意一直做下去'],
      ['promise', '我承诺不做什么', '哪些事你不做，哪怕客户要求'],
      ['goal', '下一阶段目标', '接下来希望看到什么变化？'],
      ['future', '希望重点发展的业务', '你希望把更多精力放在哪里？']
    ] },
    { title: '目标客户画像', hint: '想一位真实客户，比写“所有人”更容易。', fields: [
      ['customers', '我的核心客户是谁', '他们的身份、行业或生活与工作场景'],
      ['situation', '客户通常处于什么状态', '他们在什么情况下会需要帮助？'],
      ['problem', '客户最想解决的问题', '尽量用客户说过的原话'],
      ['reason', '客户为什么会来找我', '是什么触发了咨询或购买？']
    ] },
    { title: '竞争格局认知', hint: '为什么是你，而不是别人。', fields: [
      ['strength', '我的专业优势', '经验、方法、作品或专业能力'],
      ['difference', '我的差异化', '相比其他选择，你的服务有什么不同？'],
      ['resources', '我的核心资源', '可依靠的团队、合作伙伴、渠道或工具']
    ] },
    { title: '典型成交路径', hint: '从客户认识你，到成交，简单串起来。', fields: [
      ['acquisition', '主要获客方式', '客户通常从哪里认识你？'],
      ['sales', '成交方式', '从咨询到购买，一般会经历哪些步骤？'],
      ['revenue', '收入来源', '例如：咨询费、产品销售、项目服务或续费']
    ] },
    { title: '客户购买障碍分析', hint: '客户明明需要，为什么还在犹豫。', fields: [
      ['hesitation', '客户最常见的顾虑', '价格、信任、时机，还是担心效果？'],
      ['reassure', '我通常怎样让客户放心', '你会用什么方式打消这些顾虑？']
    ] }
  ];
  const fields = groups.flatMap(group => group.fields);
  /* 2026-09-30（第二版）：编辑区改成「完整成品」主视图后，**存储格式本身就是页面主框里
   * 显示的那份文本**，所以里面不能再混机器标记 —— 会员会直接看到 <!-- ... --> 和 '> ' 前缀。
   *
   * 新格式（主框所见即所存）：
   *   ## <组标题>
   *   ### <字段 label>
   *   <字段值，多行原样>
   *   ...
   *   ## 其他补充
   *   <会员自己撰写的、不属于任何栏目的内容>
   * 「## 其他补充」是必要的边界标记：没有它，紧跟在最后一个字段后面的自由文字
   * 会被当成那个字段的值（往返一次就串行）。它由 serialize 保证存在，会员删掉也会被补回。
   *
   * 老格式（`<!-- wxgc-positioning:v1 -->` 定界块 + 字段值用 '> ' 引用行）**继续可读**：
   * parse 自动识别，保存一次即升级为新格式，不需要手工迁移。
   * ⚠️ 只有确认是老格式时才剥 '> ' 前缀 —— 否则会误删会员新写的 Markdown 引用。 */
  const START = '<!-- wxgc-positioning:v1 -->';
  const END = '<!-- /wxgc-positioning:v1 -->';
  const SUPPLEMENT = '其他补充';
  const GROUP_TITLES = new Set(groups.map(group => group.title));
  const MARKER = /^<!--.*-->$/;
  // 组标题可能带序号前缀：AI 起草的骨架是「## 一、个人 / 品牌基础信息」，
  // 模板（growth-access.js）也是「## 二、产品 / 服务包」。不带这层容忍，这些标题会被
  // 当成"自由正文"整段沉进「其他补充」，而它在页面上看不出问题 —— 只会显得正文里多了一堆标题。
  const stripOrdinal = (title) => String(title).replace(/^[0-9一二三四五六七八九十]+\s*[、.．)）]\s*/, '');

  function parse(markdown) {
    const text = String(markdown || '');
    const legacyFormat = text.includes(START);
    const values = {};
    const rest = [];
    let key = '';
    let buffer = null;
    const flush = () => {
      if (key && buffer) {
        const value = buffer.join('\n').trim();
        if (value) values[key] = values[key] ? `${values[key]}\n${value}` : value;
      }
      buffer = null;
    };
    for (const raw of text.split(/\r?\n/)) {
      const line = legacyFormat ? raw.replace(/^>\s?/, '') : raw;
      if (MARKER.test(line.trim())) {
        // 老格式的结束标记之后就是自由正文，必须先收口当前字段，否则正文会被吸进上一个字段
        if (legacyFormat && line.includes('<!-- /')) { flush(); key = ''; }
        continue;
      }
      const field = line.match(/^###\s+(.+?)\s*$/);
      if (field) {
        flush();
        const hit = fields.find(item => item[1] === field[1]);
        // 不认识的 ### 标题不属于结构化字段，归自由正文，避免污染字段值
        if (hit) { key = hit[0]; buffer = []; } else { key = ''; rest.push(line); }
        continue;
      }
      const head = line.match(/^##\s+(.+?)\s*$/);
      if (head) {
        flush(); key = '';
        const title = stripOrdinal(head[1]);
        // 组标题与老格式的「我的商业定位」都是结构标记，本身不进正文
        if (GROUP_TITLES.has(title) || title === '我的商业定位' || title === SUPPLEMENT) continue;
        rest.push(line);
        continue;
      }
      if (key) buffer.push(line);
      else rest.push(line);
    }
    flush();
    return { values, legacy: rest.join('\n').trim() };
  }

  function serialize(values, legacy = '') {
    const blocks = [];
    for (const group of groups) {
      const filled = group.fields.filter(([key]) => String(values[key] || '').trim());
      if (!filled.length) continue;
      const lines = [`## ${group.title}`];
      for (const [key, label] of filled) {
        lines.push('', `### ${label}`, ...String(values[key]).split(/\r?\n/));
      }
      blocks.push(lines.join('\n'));
    }
    const body = blocks.join('\n\n');
    const rest = String(legacy || '').trim();
    if (!body) return rest;
    return rest ? `${body}\n\n## ${SUPPLEMENT}\n\n${rest}\n` : `${body}\n`;
  }
  function completion(values) {
    const counts = groups.map(group => group.fields.filter(([key]) => String(values[key] || '').trim()).length);
    const filled = counts.reduce((sum, count) => sum + count, 0);
    return { counts, filled, total: fields.length, percent: Math.round(filled / fields.length * 100) };
  }
  // AI 读取商业自画像时用的 9 段结构，就是填写分区本身。
  // 从 groups 派生、不再单独维护一份清单：两份清单一分叉就会静默错位
  //（页面新增了一组、AI 却读不到），而这种错位在页面上看不出来。
  const summary = groups.map(group => [group.title, group.fields.map(([key]) => key)]);
  root.WxgcPositioning = { groups, fields, parse, serialize, completion, summary };
})(globalThis);
