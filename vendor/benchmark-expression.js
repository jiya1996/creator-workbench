/* 把既有拆解数据转成会员能直接阅读的中文，不额外调用模型或改写原始标签。 */
(function () {
  'use strict';
  const labels = {
    rhetoric: '修辞手法', rhetoricaldevices: '修辞手法', rhetorical_devices: '修辞手法', devices: '修辞手法', techniques: '表达方法',
    tone: '说话语气', mood: '表达情绪', emotion: '表达情绪', emotions: '表达情绪', style: '表达风格',
    voice: '说话方式', language: '语言特点', language_style: '语言特点', languagestyle: '语言特点',
    rhythm: '表达节奏', pace: '表达节奏', pacing: '表达节奏', sentence: '句式特点', sentences: '句式特点',
    sentence_style: '句式特点', sentencestructure: '句式特点', sentence_length: '句子长短', sentence_len: '句子长短',
    vocabulary: '用词特点', diction: '用词特点', persona: '呈现的形象', perspective: '讲述角度',
    imagery: '画面感', images: '画面感', metaphor: '比喻方式', metaphors: '比喻方式',
    opening: '开头方式', ending: '结尾方式', hook: '开头方式', structure: '组织方式',
    examples: '具体例子', example: '具体例子', description: '具体说明', features: '表达特点', keywords: '重点用词'
  };
  const explanations = {
    '化用典故/古诗词': '借用古诗词或历史故事的意境，用自己的话重新表达',
    '化用典故': '借用历史故事的意境，用自己的话重新表达',
    '化用古诗词': '借用古诗词的意境，用自己的话重新表达',
    '排比意象群': '把多个有画面感的事物排列在一起，营造气势和氛围',
    '以景结情': '文章结尾不直接说感受，而是用景物留下情绪和余韵',
    '排比': '把意思相关的句子接连说出来，让表达更有力量',
    '借景抒情': '通过眼前的景物，表达自己的感受',
    '欲扬先抑': '先说不被看好或遇到的困难，再讲后来的变化',
    '设问': '先提出一个问题，再给出自己的回答',
    '反问': '用问句强调自己的看法，让人多想一步',
    '隐喻': '用另一个熟悉的事物，帮助别人理解你想说的意思',
    '首尾呼应': '结尾回应开头，让整段内容更完整',
    conversational: '像平时聊天一样', warm: '温暖亲切', humorous: '轻松幽默', emotional: '带着真实的感情',
    authoritative: '表达专业而有底气', concise: '简洁直接', 'short sentences': '多用简短的句子'
  };
  const labelFor = key => labels[String(key).toLowerCase()] || (/[㐀-鿿]/.test(key) ? key : '其他表达特点');
  function decoded(value) {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    if (/^[\[{]/.test(text)) { try { return JSON.parse(text); } catch { /* 不是JSON的普通文字仍保留 */ } }
    return text;
  }
  function textOf(value, depth = 0) {
    if (depth > 4 || value == null || typeof value === 'boolean') return '';
    const data = decoded(value);
    if (Array.isArray(data)) return [...new Set(data.slice(0, 30).map(item => textOf(item, depth + 1)).filter(Boolean))].join('；');
    if (data && typeof data === 'object') return Object.entries(data).slice(0, 30).map(([key, item]) => {
      const text = textOf(item, depth + 1); if (!text) return '';
      return labelFor(key) === '其他表达特点' ? text : `${labelFor(key)}：${text}`;
    }).filter(Boolean).join('；');
    const text = String(data).trim();
    if (!text || text === '[object Object]') return '';
    return explanations[text] || explanations[text.toLowerCase()] || text;
  }
  function formatExpression(value) {
    const data = decoded(value);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      const text = textOf(data); return text ? [text] : [];
    }
    const grouped = new Map();
    for (const [key, item] of Object.entries(data).slice(0, 30)) {
      const text = textOf(item); if (!text) continue;
      const label = labelFor(key);
      grouped.set(label, [...(grouped.get(label) || []), text]);
    }
    return [...grouped].map(([label, texts]) => `${label}：${[...new Set(texts)].join('；')}`);
  }
  globalThis.WxgcBenchmarkExpression = { formatExpression };
})();
