import { mountBenchmark } from './benchmark-local.js'
import { mountFounder, hydrateFounderSummary } from './founder-local.js'
import { mountPreferences } from './preferences-local.js'
import './vendor/business-positioning.js'

const $ = (selector, parent = document) => parent.querySelector(selector)
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)]
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
const storageKey = 'creator-workbench-public-demo-v1'
let state
try { state = JSON.parse(localStorage.getItem(storageKey)) || {} } catch { state = {} }
state = { notes: [], customers: [], drafts: [], favorites: [], actions: [], teams: [], shortLinks: [], fields: {}, ...state }
let catalog
let currentPage
let currentKey
let activeNoteId = null
let activeCustomerId = null
let activeDraftId = null
let activeSpace = 'private'
let requestVersion = 0
const cache = new Map()

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)) }
  catch { toast('本机存储空间不足，请先导出数据') }
}

function toast(message) {
  $('.replica-toast')?.remove()
  const element = document.createElement('div')
  element.className = 'replica-toast'
  element.role = 'status'
  element.textContent = message
  document.body.append(element)
  setTimeout(() => element.remove(), 3200)
}

function markdown(source) {
  return escapeHTML(source).split('\n').map(line => {
    const heading = line.match(/^(#{1,4})\s+(.+)/)
    if (heading) return `<h${heading[1].length}>${heading[2]}</h${heading[1].length}>`
    if (line.startsWith('- ')) return `<p>• ${line.slice(2)}</p>`
    return `<p>${line || '<br>'}</p>`
  }).join('').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function dialog(title, content) {
  const element = document.createElement('dialog')
  element.className = 'replica-dialog'
  element.innerHTML = `<button class="replica-close" aria-label="关闭弹窗">×</button><h2>${escapeHTML(title)}</h2>${content}`
  element.querySelector('.replica-close').onclick = () => element.close()
  element.addEventListener('close', () => element.remove())
  element.addEventListener('click', event => { if (event.target === element) element.close() })
  document.body.append(element)
  element.showModal()
  return element
}

async function getPage(key) {
  if (!cache.has(key)) {
    const response = await fetch(`/creator-workbench/data/pages/${encodeURIComponent(key)}.json`)
    if (!response.ok) throw new Error('页面资料读取失败')
    cache.set(key, await response.json())
  }
  return cache.get(key)
}

function pageKey(url) {
  const variant = url.searchParams.get('_view')
  if (variant && catalog.pages.some(page => page.key === variant)) return variant
  const pathname = url.pathname.startsWith('/creator-workbench/') ? url.pathname.slice(18) : url.pathname
  if (['/', '/index.html', '/member/', '/member/main.html'].includes(pathname)) {
    return (url.searchParams.get('mode') || state.mode) === 'advanced' ? 'main-advanced' : 'main'
  }
  if (pathname.endsWith('/library.html')) return 'library-' + (url.searchParams.get('section') || 'featured')
  if (pathname.endsWith('/content.html')) return 'content-' + url.searchParams.get('id')
  if (pathname.endsWith('/immersive.html')) return 'immersive-' + url.searchParams.get('id')
  if (pathname.endsWith('/reference.html')) return 'reference-' + url.searchParams.get('id')
  if (pathname.endsWith('/ai-agent.html')) return 'ai-agent-' + url.searchParams.get('bot_id')
  if (pathname.endsWith('/text-studio.html')) return 'text-studio-' + (url.searchParams.get('type') === 'moments' ? 'moments' : 'article')
  return pathname.split('/').pop().replace(/\.html$/, '')
}


function localAsset(value, base) {
  if (!value || /^(data:|blob:|#)/.test(value)) return value
  let url
  try { url = new URL(value, base) } catch { return value }
  if (url.pathname.endsWith('/icons.svg')) return '/creator-workbench/assets/icons.svg' + url.hash
  return catalog.assets[url.href] || catalog.assets[url.pathname + url.search] || catalog.assets[url.pathname] || null
}

function cleanDocument(data) {
  const doc = new DOMParser().parseFromString(data.html, 'text/html')
  $$('script, base, meta[http-equiv], #codex-agent-overlay-root, [data-codex-agent-overlay-root], #immersive-translate-popup, immersive-translate-popup, plasmo-csui, .nav-tooltip, .release-update-dialog', doc).forEach(element => element.remove())
  $$('[src^="chrome-extension:"], [href^="chrome-extension:"]', doc).forEach(element => (element.closest('a') || element).remove())
  if (data.key !== 'settings-themes') $('#theme-picker-modal', doc)?.remove()
  $$('[inert]', doc).forEach(element => element.removeAttribute('inert'))
  doc.body.classList.remove('theme-picker-open')
  doc.body.style.removeProperty('overflow')
  for (const element of $$('*', doc)) {
    for (const attribute of [...element.attributes]) {
      if (/^on/i.test(attribute.name) || attribute.name.startsWith('data-codex')) element.removeAttribute(attribute.name)
    }
    if (element.hasAttribute('style')) {
      element.setAttribute('style', element.getAttribute('style').replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (_, quote, value) => `url("${localAsset(value, data.url) || ''}")`))
    }
  }
  $$('link[href]', doc).forEach(element => {
    const mapped = localAsset(element.getAttribute('href'), data.url)
    if (mapped) element.setAttribute('href', mapped)
    else element.remove()
  })
  $$('img, video, source, use', doc).forEach(element => {
    const attribute = element.tagName.toLowerCase() === 'use' ? 'href' : 'src'
    const value = element.getAttribute(attribute)
    if (value === '') element.removeAttribute(attribute)
    if (value) {
      const mapped = localAsset(value, data.url)
      if (mapped) element.setAttribute(attribute, mapped)
      else element.removeAttribute(attribute)
    }
    element.removeAttribute('srcset')
    element.removeAttribute('loading')
    if (element.hasAttribute('poster')) {
      const poster = localAsset(element.getAttribute('poster'), data.url)
      if (poster) element.setAttribute('poster', poster)
      else element.removeAttribute('poster')
    }
  })
  $$('iframe', doc).forEach(element => {
    const replacement = doc.createElement('div')
    replacement.className = 'replica-chat-host'
    element.replaceWith(replacement)
  })
  $$('a[href]', doc).forEach(element => {
    const original = element.getAttribute('href')
    if (!original || original.startsWith('#')) return
    const url = new URL(original, data.url)
    if (/^(www\.)?wxgaochu\.com$/.test(url.hostname)) url.pathname = '/creator-workbench' + url.pathname
    const reference = /feishu\.cn$/.test(url.hostname) ? catalog.references?.[url.pathname.split('/').pop()] : null
    const shortLink = catalog.shortLinks?.[url.origin + url.pathname]
    if ((reference && !element.hasAttribute('data-original-source')) || shortLink) {
      element.setAttribute('href', reference || shortLink)
      element.removeAttribute('target')
    } else if (/^(www\.)?wxgaochu\.com$/.test(url.hostname)) {
      const known = url.pathname === '/creator-workbench/' || catalog.pages.some(page => page.pathname === url.pathname) || ['/', '/index.html', '/creator-workbench/member/'].includes(url.pathname)
      const internal = known || url.pathname.startsWith('/creator-workbench/member/') || url.pathname.startsWith('/api/')
      element.setAttribute('href', internal ? url.pathname + url.search + url.hash : url.href)
      if (internal) element.removeAttribute('target')
      else { element.setAttribute('target', '_blank'); element.setAttribute('rel', 'noopener noreferrer') }
    } else {
      element.setAttribute('href', url.href)
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noopener noreferrer')
    }
  })
  return doc
}

async function render(key, options = {}) {
  const version = ++requestVersion
  if (!catalog.pages.some(page => page.key === key)) {
    showMissing(key)
    return
  }
  const data = await getPage(key)
  if (version !== requestVersion) return
  const doc = cleanDocument(data)
  const previousScroll = window.scrollY
  for (const attribute of [...document.documentElement.attributes]) document.documentElement.removeAttribute(attribute.name)
  for (const attribute of [...doc.documentElement.attributes]) document.documentElement.setAttribute(attribute.name, attribute.value)
  document.documentElement.lang = 'zh-CN'
  document.head.replaceChildren(...doc.head.childNodes)
  const stylesheet = document.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = '/creator-workbench/replica.css'
  document.head.append(stylesheet)
  document.body.replaceWith(doc.body)
  document.title = data.title.replace(/｜稳行高处$/, '') + ' · 本地复刻'
  currentPage = data
  currentKey = key
  const params = new URL(location.href).searchParams
  activeNoteId = params.get('note') || (key.startsWith('notes') ? activeNoteId : null)
  activeDraftId = params.get('draft') || (key.includes('studio') ? activeDraftId : null)
  for (const control of data.controls || []) {
    const element = control.id ? document.getElementById(control.id) : null
    if (element && !['checkbox', 'radio', 'file', 'password'].includes(element.type)) element.value = control.value
  }
  restoreFields()
  await hydrate()
  if (version !== requestVersion) return
  document.documentElement.dataset.replicaView = key
  const badge = document.createElement('button')
  badge.className = 'replica-badge'
  badge.textContent = '公开演示 · 数据保存在当前浏览器'
  badge.addEventListener('click', showCoverage)
  document.body.append(badge)
  if (options.preserveScroll) window.scrollTo(0, previousScroll)
  else if (location.hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView())
  else window.scrollTo(0, 0)
}

function showMissing(key) {
  dialog('此入口的复刻范围', `<p>当前已采集内容中没有这个页面的完整界面。</p><p>入口标识 ${escapeHTML(key)}</p><p>账号未开通、外部服务和未采集的数据会保持明确状态。</p><a href="/creator-workbench/member/main.html">返回本地工作台</a>`)
}

async function navigate(href) {
  const url = new URL(href, location.href)
  if (currentKey?.startsWith('benchmark') || pageKey(url).startsWith('benchmark') || currentKey?.startsWith('founder-role') || pageKey(url).startsWith('founder-role')) {
    location.assign(url.pathname + url.search + url.hash)
    return
  }
  history.pushState({}, '', url.pathname + url.search + url.hash)
  await render(pageKey(url))
}

async function variant(key) {
  const url = new URL(location.href)
  url.searchParams.set('_view', key)
  history.replaceState({}, '', url)
  await render(key, { preserveScroll: true })
}

function restoreFields() {
  const fields = state.fields[currentKey] || {}
  for (const [selector, value] of Object.entries(fields)) {
    const element = $(selector)
    if (!element || element.type === 'password') continue
    if (element.type === 'checkbox' || element.type === 'radio') element.checked = Boolean(value)
    else element.value = value
  }
  if (state.theme) {
    document.documentElement.setAttribute('data-theme', state.theme)
    document.documentElement.className = document.documentElement.className.replace(/theme-[\w-]+/g, '') + ' ' + state.theme
  }
}

function rememberField(element) {
  if (!element.matches('input, textarea, select') || ['password', 'file'].includes(element.type)) return
  if (/key|secret|token|password/i.test(element.id + element.name + element.getAttribute('placeholder'))) return
  const selector = element.id ? '#' + CSS.escape(element.id) : null
  if (!selector) return
  state.fields[currentKey] ||= {}
  state.fields[currentKey][selector] = ['checkbox', 'radio'].includes(element.type) ? element.checked : element.value
  if (currentKey.startsWith('video-studio')) {
    const draft = state.drafts.find(item => item.id === activeDraftId)
    const fields = { 'studio-brief': 'brief', 'studio-script': 'body', 'studio-topic': 'title', 'studio-topic-final': 'title', 'studio-cover': 'cover' }
    if (draft && fields[element.id]) draft[fields[element.id]] = element.value
  }
  persist()
}

async function hydrate() {
  // 页面结构沿用实测状态，业务数据在本机单独维护。
  if (currentKey.startsWith('main')) hydrateDashboard()
  if (currentKey.startsWith('notes')) hydrateNotes()
  if (currentKey.startsWith('journey')) hydrateJourney()
  if (currentKey.startsWith('portrait')) hydratePortrait()
  if (currentKey.startsWith('workspaces')) hydrateCustomers()
  if (currentKey === 'video-studio' || currentKey === 'video-studio-guide') hydrateVideo()
  if (currentKey === 'text-studio-article') hydrateText()
  if (currentKey === 'text-studio-moments') hydrateMoments()
  if (/^(coze-|ai-agent-)/.test(currentKey)) hydrateChat()
  if (currentKey.startsWith('member-profile') && !currentKey.startsWith('member-profile-public')) hydrateProfile()
  if (currentKey.startsWith('member-profile-public')) {
    const following = Boolean(state.followedPublicProfile)
    $$('[data-profile-follow], [data-profile-follow-entry]').forEach(button => { button.textContent = following ? '我已关注' : '我要关注' })
  }
  if (currentKey.startsWith('benchmark')) await mountBenchmark({ state, persist, toast, key: currentKey })
  if (currentKey.startsWith('founder-role')) await mountFounder({ state, persist, toast, key: currentKey })
  if (currentKey === 'my-short-links') hydrateShortLinks()
  if (currentKey.startsWith('messages')) hydrateMessages()
  if (currentKey.startsWith('activity-') && $('.salon-dialog')) {
    $('.salon-dialog').removeAttribute('open')
    $('.salon-dialog').showModal()
  }
  if (currentKey.startsWith('main')) $('[data-starter-status]')?.setAttribute('hidden', '')
  if (currentKey === 'settings-themes' && $('#theme-picker-modal')) {
    $('#theme-picker-modal').removeAttribute('open')
    $('#theme-picker-modal').showModal()
  }
  if (state.sidebarCollapsed) document.body.classList.add('replica-sidebar-collapsed')
  if (currentKey.startsWith('main') || currentKey.startsWith('settings')) mountPreferences({ state, persist, toast })
  $$('dialog[open]').forEach(element => {
    if (element.matches(':modal')) return
    element.removeAttribute('open')
    element.showModal()
  })
  if ($('[data-weekly-form] input[type="date"]')) {
    const date = $('[data-weekly-form] input[type="date"]')
    date.min = new Date().toLocaleDateString('en-CA')
    if (!date.value) date.value = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA')
  }
  $$('button[disabled][data-workspace-mode]').forEach(button => { button.disabled = false })
  updatePreviews()
  updateFavorites()
}

function updatePreviews() {
  const pairs = [
    ['#portrait-markdown', '[data-portrait-live-preview]'],
    ['[data-notes-content]', '[data-notes-preview]'],
    ['#text-body', '#text-preview'],
    ['#ms-body', '#ms-preview'],
    ['#studio-script', '#studio-script-preview']
  ]
  for (const [input, preview] of pairs) {
    if ($(input) && $(preview)) $(preview).innerHTML = markdown($(input).value)
  }
  if ($('#portrait-markdown') && $('[data-markdown-count]')) $('[data-markdown-count]').textContent = `${$('#portrait-markdown').value.length}/20000字符`
  if ($('#text-save')) $('#text-save').disabled = !$('#text-body')?.value.trim()
  if ($('#text-copy')) $('#text-copy').disabled = !$('#text-body')?.value.trim()
  if ($('#ms-save')) $('#ms-save').disabled = !$('#ms-body')?.value.trim()
  if ($('#ms-copy')) $('#ms-copy').disabled = !$('#ms-body')?.value.trim()
}

function toggle(element, panel) {
  if (!panel) return
  panel.hidden = !panel.hidden
  element.setAttribute('aria-expanded', String(!panel.hidden))
}

function showSearch() {
  const element = dialog('全站搜索', '<input type="search" aria-label="搜索关键词" placeholder="搜索功能、课程、SOP、笔记…"><div class="replica-search-results"></div>')
  const input = $('input', element)
  const results = $('.replica-search-results', element)
  const candidates = catalog.pages.filter(page => page.searchable && !/^(activity-|global-search|benchmark-page)/.test(page.key))
  function search() {
    const query = input.value.trim().toLowerCase()
    const pages = candidates.filter(page => !query || page.text.toLowerCase().includes(query)).slice(0, 35)
    results.innerHTML = pages.map(page => `<a href="${escapeHTML(page.pathname + page.search)}"><strong>${escapeHTML(page.title.split('｜')[0])}</strong><small>${escapeHTML(page.pathname)}</small></a>`).join('') + state.notes.filter(note => !query || (note.title + note.body).toLowerCase().includes(query)).map(note => `<button class="replica-list-item" data-open-note="${note.id}">${escapeHTML(note.title)}<small>本机笔记</small></button>`).join('')
    if (!results.children.length) results.textContent = '没有找到相关内容'
  }
  input.addEventListener('input', search)
  search()
  input.focus()
}

async function showCoverage() {
  const coverage = await (await fetch('/creator-workbench/data/coverage.json')).json()
  dialog('复刻范围与本机数据', `<p>已保存 ${coverage.capturedStates} 个界面状态，包含 ${coverage.contentDetails} 个内容详情、${coverage.lessons} 个必修课页面。</p><p>爆款库包含 ${coverage.benchmarkVideos} 条列表与 ${coverage.benchmarkDetails} 份拆解详情。经营优势测评包含 ${coverage.founderQuestions} 道题目，已补入原站完成的真实基础分析报告与原版报告。</p><p>补充 ${coverage.externalDocuments} 篇参考资料和 ${coverage.embeddedTables} 张嵌入表格。</p><p>原站版本 ${escapeHTML(coverage.sourceVersion)}</p><p>笔记、稿件、客户和行动保存在当前浏览器。</p><p>待接入的能力包括 AI 生成、测评角色报告、服务器登录、跨设备同步、第三方笔记、提醒发送与在线支付。</p><p>当前版本仍有已知功能缺口，尚未通过全功能一致性验收。</p><ul>${coverage.limitations.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul><button data-export-local>导出本机数据</button>`)
}

function updateFavorites() {
  $$('button').filter(button => /先关注|已关注/.test(button.textContent) && !button.closest('.ai-department-section')).forEach(button => {
    const id = button.closest('[data-employee-id]')?.dataset.employeeId || currentKey
    const saved = state.favorites.includes(id)
    button.classList.toggle('is-favorite', saved)
    button.setAttribute('aria-pressed', String(saved))
    if (saved) button.textContent = '★ 已关注'
  })
}

function hydrateDashboard() {
  hydrateFounderSummary({ state })
  $('[data-progress-saved]')?.replaceChildren(String(state.drafts.length))
  $('[data-progress-published]')?.replaceChildren(String(state.drafts.filter(draft => draft.published).length))
  const weekly = $('[data-weekly-list]')
  if (weekly && state.actions.length) weekly.innerHTML = state.actions.map(action => `<label class="replica-list-item"><input type="checkbox" data-action-done="${action.id}" ${action.done ? 'checked' : ''}> ${escapeHTML(action.title)} <small>${escapeHTML(action.due || '')}</small></label>`).join('')
  const favorites = $('[data-favorites-list]')
  if (favorites && state.favorites.length) favorites.innerHTML = state.favorites.map(id => catalog.pages.find(page => page.key === id || page.key === 'content-' + id)).filter(Boolean).map(page => `<a class="replica-list-item" href="${page.pathname + page.search}">${escapeHTML(page.title.split('｜')[0])}</a>`).join('')
}

function portraitVersion() {
  return /^portrait-bc(?:-|$)/.test(currentKey) ? 'bc' : /^portrait-b(?:-|$)/.test(currentKey) ? 'b' : 'c'
}

function hydrateJourney() {
  const type = { 'journey-c': 'consumer', 'journey-b': 'business', 'journey-bc': 'hybrid' }[currentKey]
  const answers = state.journeyAnswers?.[type] || {}
  $$('input[name="audienceType"]').forEach(input => { input.checked = input.value === type })
  const questions = $$('.journey-question')
  let count = 0
  for (const question of questions) {
    $$('input[type="radio"]', question).forEach(input => { input.checked = answers[input.name] === input.value })
    const selected = $('input:checked', question)
    question.classList.toggle('is-answered', Boolean(selected))
    $('.journey-answer-state', question)?.replaceChildren(selected ? '已选：' + selected.parentElement.textContent.trim() : '待选择')
    if (selected) count++
  }
  $('[data-progress]')?.replaceChildren(!type ? '请先选择主要客户类型' : count === questions.length ? '全部完成，回答已保存在本机' : `已完成 ${count} / ${questions.length} 题`)
}

function hydratePortrait() {
  const version = portraitVersion()
  const saved = state.portraits?.[version]
  if (saved) {
    if ($('#portrait-markdown')) $('#portrait-markdown').value = saved.body
    if ($('[data-title]')) $('[data-title]').value = saved.title
  }
  const textarea = $('#portrait-markdown')
  if (textarea && !textarea.value) textarea.value = '# 我的商业定位\n\n## 我是谁\n\n## 我的产品和服务\n\n## 我的目标客户\n\n## 客户为什么选择我\n'
  if (saved?.directions) {
    const list = $('[data-direction-list]')
    if (list) list.replaceChildren(...saved.directions.map(value => {
      const item = document.createElement('span')
      item.textContent = value
      return item
    }))
    const primary = $('[data-direction-primary]')
    if (primary) primary.replaceChildren(...saved.directions.map(value => new Option(value, value)))
  }
  const history = $('[data-revisions]')
  const revisions = state.portraitHistory?.[version] || []
  if (history && revisions.length) history.innerHTML = revisions.map((item, index) => `<details class="revision-item"><summary>${escapeHTML(item.title)} · ${new Date(item.updated).toLocaleString('zh-CN')}</summary><article class="markdown-preview">${markdown(item.body)}</article><button data-restore-portrait="${index}">恢复</button></details>`).join('')
}

function savePortrait() {
  const version = portraitVersion()
  state.portraits ||= {}
  const previous = state.portraits[version]
  const next = { title: $('[data-title]')?.value || '我的商业定位', body: $('#portrait-markdown')?.value || '', directions: $$('[data-direction-list] span').map(item => item.textContent), updated: new Date().toISOString() }
  if (previous && (previous.title !== next.title || previous.body !== next.body)) {
    state.portraitHistory ||= {}
    state.portraitHistory[version] ||= []
    state.portraitHistory[version].unshift(previous)
  }
  state.portraits[version] = next
  persist()
  hydratePortrait()
  toast('商业定位已保存到本机')
}

function hydrateNotes() {
  const list = $('[data-notes-list]')
  if (!list) return
  const query = $('[data-notes-filter]')?.value?.toLowerCase() || ''
  const notes = state.notes.filter(note => !note.deleted).filter(note => !query || (note.title + note.body).toLowerCase().includes(query))
  list.innerHTML = notes.map(note => `<li><button class="replica-list-item" data-open-note="${note.id}">${escapeHTML(note.title || '未命名笔记')}<small>${escapeHTML(note.category || '其他')} · ${new Date(note.updated).toLocaleDateString('zh-CN')}</small></button></li>`).join('')
  if ($('[data-notes-empty]')) $('[data-notes-empty]').hidden = Boolean(notes.length)
  if (activeNoteId) fillNote(state.notes.find(note => note.id === activeNoteId))
  if ($('[data-notes-delete]')) $('[data-notes-delete]').hidden = !activeNoteId
}

function fillNote(note) {
  if (!note) return
  const fields = { '[data-notes-title]': note.title, '[data-notes-content]': note.body, '[data-notes-event]': note.event, '[data-notes-judgment]': note.judgment, '[data-notes-decision]': note.next }
  for (const [selector, value] of Object.entries(fields)) if ($(selector)) $(selector).value = value || ''
  updatePreviews()
}

function saveNote() {
  const title = $('[data-notes-title]')?.value.trim() || '我的笔记 ' + new Date().toLocaleDateString('zh-CN')
  const body = $('[data-notes-content]')?.value || ''
  const event = $('[data-notes-event]')?.value || ''
  if (!body.trim() && !event.trim()) { toast('先写下正文或发生的事'); return }
  const note = { id: activeNoteId || crypto.randomUUID(), title, body, event, judgment: $('[data-notes-judgment]')?.value || '', next: $('[data-notes-decision]')?.value || '', category: $('[data-notes-category]')?.value || '', updated: new Date().toISOString() }
  state.notes = [note, ...state.notes.filter(item => item.id !== note.id)]
  activeNoteId = note.id
  const url = new URL(location.href)
  url.searchParams.set('note', note.id)
  history.replaceState({}, '', url)
  persist()
  hydrateNotes()
  toast('笔记已保存到本机')
}

function hydrateCustomers() {
  const list = $('[data-ws-list]')
  if (!list) return
  const query = $('[data-ws-q]')?.value.toLowerCase() || ''
  const filter = state.customerFilter || 'all'
  const today = new Date().toLocaleDateString('en-CA')
  const customers = state.customers.filter(customer => (customer.space || 'private') === activeSpace && (filter === 'deleted' ? customer.deleted : !customer.deleted)).filter(customer => !query || JSON.stringify(customer).toLowerCase().includes(query)).filter(customer => {
    if (filter === 'today') return customer.nextDate?.slice(0, 10) === today
    if (filter === 'overdue') return customer.nextDate && customer.nextDate.slice(0, 10) < today
    if (filter === 'next7' || filter === 'next7d') return customer.nextDate && customer.nextDate.slice(0, 10) >= today && new Date(customer.nextDate) <= new Date(Date.now() + 7 * 86400000)
    if (filter === 'paused') return customer.planState === 'paused' || customer.stage === 'paused'
    return true
  })
  list.innerHTML = customers.map(customer => `<div class="replica-customer"><strong>${escapeHTML(customer.customerName)}</strong><span>${escapeHTML(customer.need || customer.cooperationItem)}</span><span>本人</span><span>${escapeHTML(customer.planState === 'paused' ? '已暂停' : customer.nextAction || '待设置')}<small>${escapeHTML(customer.nextDate || '')}</small></span><div><button data-open-customer="${customer.id}">详情</button> <button data-trash-customer="${customer.id}">${customer.deleted ? '恢复' : '移入回收站'}</button></div></div>`).join('')
  if ($('[data-ws-empty]')) $('[data-ws-empty]').hidden = Boolean(customers.length)
  const visible = state.customers.filter(customer => !customer.deleted && (customer.space || 'private') === activeSpace)
  for (const [selector, count] of [
    ['[data-ws-stat-today]', visible.filter(customer => customer.nextDate?.slice(0, 10) === today).length],
    ['[data-ws-stat-overdue]', visible.filter(customer => customer.nextDate && customer.nextDate.slice(0, 10) < today).length],
    ['[data-ws-stat-next7]', visible.filter(customer => customer.nextDate && new Date(customer.nextDate) > new Date() && new Date(customer.nextDate) < new Date(Date.now() + 7 * 86400000)).length]
  ]) if ($(selector)) $(selector).textContent = count
  const tabs = $('[data-ws-tabs]')
  if (tabs) {
    $$('[data-local-team]', tabs).forEach(element => element.remove())
    state.teams.forEach(team => {
      const button = document.createElement('button')
      button.className = 'ws-space-tab'
      button.dataset.localTeam = team.id
      button.textContent = team.name
      tabs.append(button)
    })
  }
  if ($('[data-ws-team-manage]')) $('[data-ws-team-manage]').hidden = activeSpace === 'private'
}

function showCustomer(id, tab = 'profile') {
  const customer = state.customers.find(item => item.id === id)
  if (!customer) return
  activeCustomerId = id
  $('[data-ws-drawer]').hidden = false
  $('[data-ws-drawer-name]').textContent = customer.customerName
  $('[data-ws-drawer-kicker]').textContent = activeSpace === 'private' ? '私人空间' : state.teams.find(team => team.id === activeSpace)?.name || '团队空间'
  $('[data-ws-drawer-summary]').textContent = [customer.organization, customer.contactName, customer.contactMethod].filter(Boolean).join(' · ')
  $$('[data-ws-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.wsTab === tab))
  const body = $('[data-ws-drawer-body]')
  if (tab === 'profile') {
    const fields = [['客户名称', 'customerName'], ['联系人', 'contactName'], ['企业名称', 'organization'], ['联系电话', 'contactMethod'], ['来源', 'source'], ['当前需求', 'need'], ['合作事项', 'cooperationItem'], ['进度', 'stage'], ['联系偏好', 'contactPreference'], ['合作意向度', 'cooperationLevel'], ['备注', 'notes']]
    body.innerHTML = `<dl class="ws-kv">${fields.map(([label, key]) => {
      const control = $('[data-ws-customer-form] [name="' + key + '"]')
      const option = control?.tagName === 'SELECT' ? [...control.options].find(option => option.value === String(customer[key])) : null
      return `<dt>${label}</dt><dd>${escapeHTML(option?.textContent || (customer[key] ?? '—'))}</dd>`
    }).join('')}</dl>`
  } else if (tab === 'followups') {
    const followups = customer.followups || []
    body.innerHTML = `<section><h3>AI 帮你想下次怎么聊</h3><button type="button" class="ws-btn">AI 帮我分析客户跟进</button></section><div class="ws-section-title"><h3>沟通记录</h3><span>${followups.length} 条</span></div><div class="ws-followup-history">${followups.length ? followups.map(item => `<div class="ws-followup"><div class="ws-followup-head"><b>我</b><time>${escapeHTML(new Date(item.created).toLocaleString('zh-CN'))}</time></div><p>${escapeHTML(item.content)}</p></div>`).join('') : '<p class="ws-empty-line">还没有沟通记录。</p>'}</div><form data-local-followup><label>记录沟通结果<textarea name="content" class="ws-input" required maxlength="3000"></textarea></label><label>完成后状态<select name="action" class="ws-select"><option value="keep">只记录沟通，保留当前计划</option><option value="done">记录沟通，并完成当前跟进计划</option><option value="pause">暂停当前跟进计划</option></select></label><button type="submit" class="ws-btn ws-btn-primary">保存</button></form>`
  } else {
    body.innerHTML = `<div class="ws-plan-card"><span class="ws-plan-state">${customer.planState === 'paused' ? '已暂停' : customer.nextAction ? '待跟进' : '无计划'}</span><p>${escapeHTML(customer.nextAction || '尚未安排跟进。')}</p><time>${escapeHTML(customer.nextDate || '')}</time></div><form class="ws-plan-form" data-local-plan><h3>安排下一次跟进</h3><label>下一步动作<input name="nextAction" class="ws-input" value="${escapeHTML(customer.nextAction || '')}" required></label><label>跟进时间<input name="nextDate" type="datetime-local" class="ws-input" value="${escapeHTML(customer.nextDate || '')}" required></label><button class="ws-btn ws-btn-primary" type="submit">保存跟进计划</button><button class="ws-btn" type="button" data-pause-plan>暂停跟进</button></form>`
  }
  $('[data-ws-drawer-actions]').innerHTML = `<button type="button" class="ws-btn" data-edit-customer="${id}">编辑客户资料</button>`
}

function saveCustomer(form) {
  if (!form.reportValidity()) return
  const customer = { ...Object.fromEntries(new FormData(form)), id: activeCustomerId || crypto.randomUUID(), space: activeSpace, updated: new Date().toISOString() }
  const previous = state.customers.find(item => item.id === customer.id)
  state.customers = [{ ...previous, ...customer }, ...state.customers.filter(item => item.id !== customer.id)]
  persist()
  $('[data-ws-customer-modal]').hidden = true
  hydrateCustomers()
  toast('客户资料已保存到本机')
}

function hydrateText() {
  const list = $('#text-list')
  if (!list) return
  const drafts = state.drafts.filter(draft => draft.type === 'article' && !draft.deleted)
  list.innerHTML = drafts.length ? drafts.map(draft => `<button class="replica-list-item" data-open-draft="${draft.id}">${escapeHTML(draft.title)}<small>${draft.published ? '已确认发布' : '已有正文'}</small></button>`).join('') : '<p class="replica-empty">还没有保存的小红书。写一点正文，点击“保存这份文字”就会出现在这里。</p>'
  const draft = drafts.find(item => item.id === activeDraftId)
  if (draft) {
    $('#text-title').value = draft.title
    $('#text-body').value = draft.body
    $('#text-reflection').value = draft.reflection || ''
  }
}

function saveText(type = 'article') {
  const body = $(type === 'moments' ? '#ms-body' : '#text-body')?.value || ''
  if (!body.trim()) { toast('先写一点正文'); return }
  const previous = state.drafts.find(draft => draft.id === activeDraftId)
  const draft = { ...previous, id: activeDraftId || crypto.randomUUID(), type, body, title: $('#text-title')?.value || body.slice(0, 24), reflection: $('#text-reflection')?.value || '', updated: new Date().toISOString() }
  state.drafts = [draft, ...state.drafts.filter(item => item.id !== draft.id)]
  activeDraftId = draft.id
  const url = new URL(location.href)
  url.searchParams.set('draft', draft.id)
  history.replaceState({}, '', url)
  persist()
  if (type === 'article') hydrateText()
  else hydrateMoments()
  toast('文字已保存到本机')
}

function hydrateMoments() {
  const list = $('#ms-list')
  if (list) list.innerHTML = state.drafts.filter(draft => draft.type === 'moments').map(draft => `<button class="replica-list-item" data-open-draft="${draft.id}">${escapeHTML(draft.title)}</button>`).join('') || '<p class="replica-empty">我留下的朋友圈暂时还没有</p>'
  const draft = state.drafts.find(item => item.id === activeDraftId && item.type === 'moments')
  if (draft) {
    $('#ms-output').hidden = false
    $('#ms-draft').hidden = false
    $('#ms-body').value = draft.body
  }
}

function hydrateVideo() {
  const draft = state.drafts.find(item => item.id === activeDraftId)
  if (draft?.type === 'video') {
    if ($('#studio-work')) $('#studio-work').hidden = false
    if ($('#studio-script')) $('#studio-script').value = draft.body || ''
    if ($('#studio-topic')) $('#studio-topic').value = draft.title || ''
    if ($('#studio-topic-final')) $('#studio-topic-final').value = draft.title || ''
    if ($('#studio-cover')) $('#studio-cover').value = draft.cover || ''
    if ($('#studio-brief')) $('#studio-brief').value = draft.brief || ''
    $$('[data-studio-step], [data-studio-next]').forEach(button => { button.disabled = false })
    $('#studio-save').disabled = false
    $$('[data-filming-check]').forEach(input => {
      input.disabled = false
      input.checked = Boolean(draft.checks?.[input.dataset.filmingCheck])
    })
    $('#studio-filming-count')?.replaceChildren(`已准备 ${$$('[data-filming-check]:checked').length} / 4 项`)
    showVideoStep(draft.step || 1)
  }
  const list = $('#studio-list')
  if (list && state.drafts.some(item => item.type === 'video')) list.innerHTML = state.drafts.filter(item => item.type === 'video').map(item => `<button class="replica-list-item" data-open-draft="${item.id}">${escapeHTML(item.title || '未命名视频')}<small>第 ${item.step || 1} / 5 步 · ${item.published ? '已确认发布' : '本机草稿'}</small></button>`).join('')
}

function showVideoStep(step) {
  $$('[data-studio-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.studioPanel) !== Number(step) })
  $$('[data-studio-step]').forEach(button => {
    button.classList.toggle('is-active', Number(button.dataset.studioStep) === Number(step))
    button.setAttribute('aria-current', Number(button.dataset.studioStep) === Number(step) ? 'step' : 'false')
  })
  const draft = state.drafts.find(item => item.id === activeDraftId)
  if (draft) { draft.step = Number(step); persist() }
  const names = ['说想法', '定选题', '改稿子', '做拍剪', '去发布']
  $('#studio-progress-title')?.replaceChildren('正在做第 ' + step + ' 步：' + names[Number(step) - 1])
  $('#studio-progress-count')?.replaceChildren('第 ' + step + ' / 5 步')
  if ($('#studio-progress-bar')) $('#studio-progress-bar').value = Number(step) - 1
  $('#studio-status')?.replaceChildren('当前草稿保存在本机，可以随时回来继续。')
  if (draft) {
    const button = $$('[data-open-draft]').find(item => item.dataset.openDraft === draft.id)
    $('small', button || document.createElement('div'))?.replaceChildren(`第 ${step} / 5 步 · ${draft.published ? '已确认发布' : '本机草稿'}`)
  }
}

function saveVideo() {
  const draft = state.drafts.find(item => item.id === activeDraftId)
  if (!draft) { toast('请先新建一份内容'); return }
  draft.title = $('#studio-topic-final')?.value || $('#studio-topic')?.value || '我的视频草稿'
  draft.body = $('#studio-script')?.value || ''
  draft.brief = $('#studio-brief')?.value || ''
  draft.updated = new Date().toISOString()
  const url = new URL(location.href)
  url.searchParams.set('draft', draft.id)
  history.replaceState({}, '', url)
  persist()
  hydrateVideo()
  toast('视频草稿已保存到本机')
}

function hydrateChat() {
  let host = $('.replica-chat-host')
  if (!host) {
    host = document.createElement('div')
    document.body.append(host)
  }
  const title = currentPage.title.split('·')[0].split('｜')[0].trim()
  host.innerHTML = `<section class="replica-chat"><div class="replica-chat-head">✦ ${escapeHTML(title)}</div><div class="replica-chat-messages"><div class="replica-chat-message">${escapeHTML(currentPage.frame?.text || '这个智能体的服务由原站嵌入提供。可以在这里整理素材并保存本机草稿。')}</div></div><form data-local-chat><textarea aria-label="发送消息" placeholder="写下你的真实业务信息…"></textarea><button type="submit">保存草稿</button></form><small>本地界面 · AI 服务待连接</small></section>`
}

function hydrateProfile() {
  if (state.defaultPortrait && state.portraits?.[state.defaultPortrait]) {
    const portrait = state.portraits[state.defaultPortrait]
    const panel = $('[data-profile-m-preview]')
    if (panel) panel.innerHTML = markdown(portrait.body)
    $('[data-profile-portrait-empty]')?.setAttribute('hidden', '')
  }
  const list = $('[data-profile-notes-list]')
  if (list && state.notes.length) {
    list.innerHTML = state.notes.map(note => `<li><button class="replica-list-item" data-open-note="${note.id}">${escapeHTML(note.title)}</button></li>`).join('')
    $('[data-profile-notes-empty]')?.setAttribute('hidden', '')
  }
}

function hydrateShortLinks() {
  const body = $('#ms-tbody')
  if (!body || !state.shortLinks.length) return
  const query = $('#ms-search')?.value.toLowerCase() || ''
  const links = state.shortLinks.filter(link => !query || (link.title + link.slug + link.target).toLowerCase().includes(query))
  body.innerHTML = links.map(link => `<tr><td>${escapeHTML(link.title)}<br><a href="/creator-workbench/s/${encodeURIComponent(link.slug)}">/s/${escapeHTML(link.slug)}</a></td><td>${escapeHTML(link.target)}</td><td>本机可用</td><td>—</td><td>—</td><td><button data-copy-short="${link.id}">复制</button></td></tr>`).join('') || '<tr><td colspan="6">没有符合条件的短链接</td></tr>'
}

function filterEmployees(query) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const cards = $$('.ai-employee-card')
  const matches = cards.filter(card => words.every(word => card.textContent.toLocaleLowerCase().includes(word)))
  cards.forEach(card => { card.hidden = !matches.includes(card) })
  $$('.ai-role-card').forEach(card => {
    card.hidden = !$$('.ai-employee-card', card).some(employee => !employee.hidden)
    const team = $('.ai-role-team', card)
    if (team) team.hidden = !words.length
    card.classList.toggle('is-collapsed', !words.length)
  })
  $$('.ai-department-section').forEach(section => {
    section.hidden = Boolean(words.length) && !$$('.ai-employee-card', section).some(card => !card.hidden)
    section.classList.remove('is-collapsed')
    const roles = $('.ai-role-list', section)
    if (roles) roles.hidden = false
  })
  const status = $('.ai-search-status')
  if (status) status.hidden = !words.length
  $('.ai-search-status-text')?.replaceChildren(`找到 ${matches.length} 位相关 AI 员工`)
  const rail = $('.ai-search-rail')
  if (rail) rail.replaceChildren(...matches.map(card => {
    const original = $('a[href]', card)
    const link = document.createElement('a')
    link.className = 'replica-list-item'
    link.href = original?.href || '#ai-team-directory'
    link.textContent = $('h3,h4,strong', card)?.textContent || original?.textContent || '查看员工'
    return link
  }))
}

function hydrateMessages(filter = 'all', source = 'all') {
  const read = state.readMessages || []
  $$('[data-inbox-id]').forEach(button => {
    const isRead = read.includes(button.dataset.inboxId)
    const matchesRead = filter === 'all' || (filter === 'read' ? isRead : !isRead)
    const matchesSource = source === 'all' || button.dataset.inboxId.startsWith(source === 'digest' ? 'digest:' : source + ':')
    button.hidden = !matchesRead || !matchesSource
    const status = $('em', button)
    if (status) status.textContent = isRead ? '已读' : '未读'
  })
}

async function copyText(text) {
  if (!text) { toast('目前没有可复制的文字'); return }
  try { await navigator.clipboard.writeText(text); toast('已复制') }
  catch { dialog('复制文字', `<textarea readonly rows="12">${escapeHTML(text)}</textarea>`) }
}

function exportLocal() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = '自媒体工作台-本机数据.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

document.addEventListener('input', event => {
  if (event.target.closest('.ai-task-form')) filterEmployees(event.target.value)
  rememberField(event.target)
  updatePreviews()
  if (event.target.matches('[data-ws-q]')) hydrateCustomers()
  if (event.target.matches('[data-notes-filter]')) hydrateNotes()
  if (event.target.id === 'ms-search') hydrateShortLinks()
  if (event.target.matches('.ai-task-search input')) {
    const query = event.target.value.trim().toLowerCase()
    $$('.ai-employee-card').forEach(card => { card.hidden = Boolean(query) && !card.dataset.search.includes(query) })
  }
})

document.addEventListener('change', async event => {
  const element = event.target
  rememberField(element)
  if (element.matches('[data-action-done]')) {
    const action = state.actions.find(item => item.id === element.dataset.actionDone)
    if (action) action.done = element.checked
    persist()
  }
  if (element.matches('input[name="audienceType"], input[name="audience"]')) {
    const versions = { consumer: 'c', business: 'b', hybrid: 'bc' }
    await variant('journey-' + versions[element.value])
  }
  if (element.closest('.journey-question')) {
    const type = { 'journey-c': 'consumer', 'journey-b': 'business', 'journey-bc': 'hybrid' }[currentKey]
    if (type) {
      state.journeyAnswers ||= {}
      state.journeyAnswers[type] ||= {}
      state.journeyAnswers[type][element.name] = element.value
      persist()
      hydrateJourney()
    }
  }
  if (element.matches('[data-filming-check]')) {
    const draft = state.drafts.find(item => item.id === activeDraftId)
    if (draft) {
      draft.checks ||= {}
      draft.checks[element.dataset.filmingCheck] = element.checked
      persist()
    }
    const count = $$('[data-filming-check]:checked').length
    $('#studio-filming-count')?.replaceChildren(`已准备 ${count} / 4 项`)
  }
})

document.addEventListener('submit', async event => {
  event.preventDefault()
  const form = event.target
  if (form.matches('.ai-task-form')) { filterEmployees($('input', form).value); return }
  if (form.matches('[data-local-followup], [data-local-plan]')) {
    if (!form.reportValidity()) return
    const customer = state.customers.find(item => item.id === activeCustomerId)
    const data = Object.fromEntries(new FormData(form))
    if (form.matches('[data-local-followup]')) {
      customer.followups ||= []
      customer.followups.push({ content: data.content, created: new Date().toISOString() })
      if (data.action === 'pause') customer.planState = 'paused'
      if (data.action === 'done') { customer.planState = 'done'; customer.nextAction = ''; customer.nextDate = '' }
    } else Object.assign(customer, data, { planState: 'pending' })
    persist()
    hydrateCustomers()
    showCustomer(customer.id, form.matches('[data-local-plan]') ? 'plan' : 'followups')
    toast('已保存到本机')
    return
  }
  if (form.matches('[data-notes-form]')) { saveNote(); return }
  if (form.matches('[data-ws-customer-form]')) { saveCustomer(form); return }
  if (form.id === 'text-form') { saveText(); return }
  if (form.id === 'ms-create') {
    if (!form.reportValidity()) return
    const target = $('#ms-target').value.trim()
    let url
    try { url = new URL(target, location.origin) } catch { toast('请输入完整有效的网址'); return }
    if (!/^https?:$/.test(url.protocol)) { toast('仅支持 http 或 https 页面'); return }
    const slug = $('#ms-slug').value.trim() || crypto.randomUUID().slice(0, 8)
    if (!/^[a-z0-9_-]{6,32}$/.test(slug)) { toast('短码需为 6–32 位英文小写字母、数字、短横线或下划线'); return }
    if (state.shortLinks.some(link => link.slug === slug)) { toast('短码已使用，请换一个'); return }
    state.shortLinks.unshift({ id: crypto.randomUUID(), title: $('#ms-title').value.trim() || '我的分享', slug, target: url.href })
    persist()
    hydrateShortLinks()
    toast('已创建仅在当前浏览器可解析的本机短链接')
    return
  }
  if (form.matches('[data-weekly-form], [data-daily-action-form]')) {
    const input = $('input[type="text"], textarea', form)
    const selected = $('input[type="radio"]:checked', form)
    const title = input?.value.trim() || selected?.closest('label')?.textContent.trim()
    if (!title) { toast('先写下要推进的事'); return }
    state.actions.unshift({ id: crypto.randomUUID(), title, due: $('input[type="date"]', form)?.value || '', created: new Date().toISOString() })
    persist()
    input.value = ''
    $('[data-daily-action-dialog]')?.setAttribute('hidden', '')
    hydrateDashboard()
    toast('行动已保存到本机')
    return
  }
  if (form.matches('[data-local-chat]')) {
    const textarea = $('textarea', form)
    if (!textarea.value.trim()) return
    state.drafts.unshift({ id: crypto.randomUUID(), title: currentPage.title.split('｜')[0], body: textarea.value, type: 'chat', updated: new Date().toISOString() })
    persist()
    toast('对话素材已保存为本机草稿，AI 服务待连接')
    return
  }
  if (form.matches('[data-assessment-form]')) {
    toast('已记录本机选择，原站评分算法与报告服务待接入')
    return
  }
  toast('这个操作需要连接对应服务')
})

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); showSearch() }
  if (event.key === 'Escape') {
    $$('.replica-fullscreen').forEach(element => element.classList.remove('replica-fullscreen'))
    $$('[data-global-search-dialog], [data-daily-action-dialog], [data-ws-customer-modal]').forEach(element => { element.hidden = true })
  }
  if (['Enter', ' '].includes(event.key) && event.target.matches('[role="button"]') && !event.target.matches('button')) {
    event.preventDefault()
    event.target.click()
  }
})

document.addEventListener('click', async event => {
  const visual = event.target.closest('img[role="button"], [data-lightbox-src], button[aria-label^="放大查看"]')
  if (visual) {
    const img = visual.tagName === 'IMG' ? visual : $('img', visual)
    const source = img?.src || localAsset(visual.dataset.lightboxSrc, currentPage.url)
    if (source) {
      event.preventDefault()
      dialog(img?.alt || '图片预览', `<img src="${escapeHTML(source)}" style="max-width:100%;height:auto">`)
      return
    }
  }
  const anchor = event.target.closest('a[href]')
  if (anchor && anchor.target !== '_blank' && !anchor.hasAttribute('download') && !event.metaKey && !event.ctrlKey) {
    const href = anchor.getAttribute('href')
    if (href.startsWith('#')) return
    const url = new URL(href, location.href)
    if (url.origin === location.origin) {
      event.preventDefault()
      if (url.pathname.startsWith('/api/')) { toast('此操作需要连接账号服务'); return }
      await navigate(href)
      return
    }
  }
  const button = event.target.closest('button, [role="button"], [data-ws-modal-close], [data-close-search], [data-close-daily]')
  if (!button || button.disabled || button.closest('.replica-dialog')) return
  const text = button.textContent.trim()
  const id = button.id

  if (currentKey.startsWith('benchmark') && button.closest('#bm-app, #bm-detail, #bm-topic, #bm-draft, #bm-stats, #bm-confirm, #bm-copy-notice')) return
  if (currentKey.startsWith('founder-role') && button.closest('#role-app, #role-dialog')) return

  if (button.matches('[data-open-search]') || /搜索功能与内容/.test(text)) { showSearch(); return }
  if (button.matches('[data-toggle-password]')) {
    const input = document.getElementById(button.dataset.togglePassword)
    if (!input) return
    const visible = input.type === 'password'
    input.type = visible ? 'text' : 'password'
    $('use', button)?.setAttribute('href', '/creator-workbench/assets/icons.svg#' + (visible ? 'eye-off' : 'eye'))
    button.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码')
    return
  }
  if (button.matches('[data-history-close]')) {
    $('[data-history-modal]').hidden = true
    document.body.classList.remove('history-modal-open')
    return
  }
  if (button.matches('[data-confirm-stage]')) {
    $('[data-result-status]')?.replaceChildren('阶段报告与确认服务待接入，题目回答已保存在本机。')
    return
  }
  if (button.matches('[data-close-search]')) { $('[data-global-search-dialog]').hidden = true; return }
  if (button.matches('[data-workspace-mode]')) {
    const advanced = /高级/.test(text)
    state.mode = advanced ? 'advanced' : 'starter'
    persist()
    await navigate('/creator-workbench/member/main.html?mode=' + state.mode)
    return
  }
  if (button.matches('[data-starter-role]') && ['social', 'week', 'sales'].includes(button.dataset.starterRole)) {
    const pending = button.dataset.starterRole === 'social'
    dialog('先确认一下', `<p>${pending ? '这位助手正在准备，暂时还不能使用。你可以先选其他助手。' : '暂时还不能使用，请联系运营官确认权限。'}</p>`)
    return
  }
  if (button.matches('[data-promotion-href]')) {
    button.dataset.promotionClicks = String(Number(button.dataset.promotionClicks || 0) + 1)
    if (Number(button.dataset.promotionClicks) >= 3) await navigate(button.dataset.promotionHref)
    return
  }
  if (button.matches('[data-profile-follow], [data-profile-follow-entry]') && currentKey.startsWith('member-profile-public')) {
    state.followedPublicProfile = !state.followedPublicProfile
    persist()
    $$('[data-profile-follow], [data-profile-follow-entry]').forEach(item => { item.textContent = state.followedPublicProfile ? '我已关注' : '我要关注' })
    return
  }
  if (button.matches('[data-nav-section], .nav-label-toggle')) {
    const group = button.closest('[data-nav-section], .sidebar-section, .nav-section') || button.parentElement
    group.classList.toggle('is-collapsed')
    const expanded = button.getAttribute('aria-expanded') !== 'true'
    button.setAttribute('aria-expanded', String(expanded))
    $$('a', group).forEach(element => { element.hidden = !expanded })
    return
  }
  if (button.matches('[data-sidebar-collapse], [data-sidebar-restore], [data-open-sidebar]')) {
    state.sidebarCollapsed = !state.sidebarCollapsed
    document.body.classList.toggle('replica-sidebar-collapsed', state.sidebarCollapsed)
    persist()
    return
  }
  if (button.matches('[data-portrait-type]')) {
    const type = { consumer: 'c', business: 'b', hybrid: 'bc' }[button.dataset.portraitType]
    await variant(type === 'c' ? 'portrait' : 'portrait-' + type)
    return
  }
  if (button.matches('[data-save]') && currentKey.startsWith('portrait')) { savePortrait(); return }
  if (button.matches('[data-default]')) {
    savePortrait()
    state.defaultPortrait = currentKey.endsWith('-bc') ? 'bc' : currentKey.endsWith('-b') ? 'b' : 'c'
    persist()
    toast('已设为本机默认商业定位')
    return
  }
  if (button.matches('[data-copy]') && currentKey.startsWith('portrait')) { await copyText($('#portrait-markdown').value); return }
  if (button.matches('[data-positioning-assist-open]')) {
    const parsed = window.WxgcPositioning.parse($('#portrait-markdown').value)
    $$('[data-assist-field]').forEach(input => { input.value = parsed.values[input.dataset.assistField] || '' })
    const modal = $('[data-positioning-assist]')
    if (!modal.open) modal.showModal()
    return
  }
  if (button.matches('[data-positioning-assist-close]')) { $('[data-positioning-assist]').close(); return }
  if (button.matches('[data-positioning-assist-apply]')) {
    const textarea = $('#portrait-markdown')
    const parsed = window.WxgcPositioning.parse(textarea.value)
    const values = Object.fromEntries($$('[data-assist-field]').map(input => [input.dataset.assistField, input.value]))
    textarea.value = window.WxgcPositioning.serialize(values, parsed.legacy)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    $('[data-positioning-assist]').close()
    return
  }
  if (button.matches('[data-template-merge]')) {
    const textarea = $('#portrait-markdown')
    const parsed = window.WxgcPositioning.parse(textarea.value)
    textarea.value = window.WxgcPositioning.serialize(parsed.values, parsed.legacy)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }
  if (button.matches('[data-restore-portrait]')) {
    const item = state.portraitHistory[portraitVersion()][Number(button.dataset.restorePortrait)]
    $('#portrait-markdown').value = item.body
    $('[data-title]').value = item.title
    savePortrait()
    updatePreviews()
    return
  }
  if (button.matches('[data-portrait-expand]')) {
    const modal = $('[data-portrait-fullscreen]')
    const editing = button.dataset.portraitExpand === 'edit'
    const content = editing ? $('#portrait-markdown') : $('[data-portrait-live-preview]')
    const marker = document.createComment('商业定位原位置')
    content.before(marker)
    $('[data-portrait-fullscreen-title]').textContent = editing ? '商业定位 · 编辑' : '商业定位 · 预览'
    $('[data-portrait-fullscreen-content]').append(content)
    modal.addEventListener('close', () => marker.replaceWith(content), { once: true })
    modal.showModal()
    return
  }
  if (button.matches('[data-portrait-fullscreen-close]')) { $('[data-portrait-fullscreen]').close(); return }
  if (button.matches('[data-positioning-more]')) { toggle(button, $('[data-positioning-more-panel]')); return }
  if (button.matches('[data-template-toggle]')) { toggle(button, $('[data-template-panel]')); return }
  if (button.matches('[data-positioning-start]')) { $('#portrait-markdown')?.focus(); $('#portrait-markdown')?.scrollIntoView({ behavior: 'smooth' }); return }
  if (button.matches('[data-direction-add]')) {
    const input = $('[data-direction-new]')
    if (!input?.value.trim()) { toast('先填写业务方向'); return }
    const option = new Option(input.value, input.value)
    $('[data-direction-primary]')?.add(option)
    const item = document.createElement('span')
    item.textContent = input.value
    $('[data-direction-list]')?.append(item)
    input.value = ''
    return
  }
  if (button.matches('[data-notes-new], [data-notes-empty-new]')) {
    activeNoteId = null
    const url = new URL(location.href)
    url.searchParams.delete('note')
    history.replaceState({}, '', url)
    await variant('notes-new')
    $$('[data-notes-title], [data-notes-content], [data-notes-event]').forEach(element => { element.value = '' })
    updatePreviews()
    return
  }
  if (button.matches('[data-open-note]')) {
    activeNoteId = button.dataset.openNote
    await navigate('/creator-workbench/member/notes.html?_view=notes-new&note=' + encodeURIComponent(activeNoteId))
    return
  }
  if (button.matches('[data-notes-save]')) { saveNote(); return }
  if (button.matches('[data-notes-delete]')) {
    const note = state.notes.find(item => item.id === activeNoteId)
    if (note) note.deleted = true
    activeNoteId = null
    const url = new URL(location.href)
    url.searchParams.delete('note')
    history.replaceState({}, '', url)
    state.fields['notes-new'] = {}
    persist()
    await variant('notes')
    toast('笔记已移入本机回收状态，可从导出数据恢复')
    return
  }
  if (button.matches('[data-notes-source]')) {
    const source = button.dataset.notesSource
    await variant(source === 'local' || source === 'notes' ? 'notes' : 'notes-' + source)
    return
  }
  if (button.matches('[data-notes-copy-preview]')) { await copyText($('[data-notes-preview]')?.innerText); return }
  if (button.matches('[data-mood], [data-category]')) {
    $$('button', button.parentElement).forEach(item => item.setAttribute('aria-pressed', String(item === button)))
    return
  }
  if (button.matches('[data-ws-new]')) {
    activeCustomerId = null
    const modal = $('[data-ws-customer-modal]')
    modal.hidden = false
    $('form', modal).reset()
    return
  }
  if (button.matches('[data-ws-modal-close]')) { $('[data-ws-customer-modal]').hidden = true; return }
  if (button.matches('[data-open-customer]')) { showCustomer(button.dataset.openCustomer); return }
  if (button.matches('[data-ws-drawer-close]')) { $('[data-ws-drawer]').hidden = true; return }
  if (button.matches('[data-ws-tab]')) { showCustomer(activeCustomerId, button.dataset.wsTab); return }
  if (button.matches('[data-pause-plan]')) {
    const customer = state.customers.find(item => item.id === activeCustomerId)
    customer.planState = 'paused'
    persist()
    hydrateCustomers()
    showCustomer(customer.id, 'plan')
    return
  }
  if (button.matches('[data-edit-customer]')) {
    activeCustomerId = button.dataset.editCustomer
    const customer = state.customers.find(item => item.id === activeCustomerId)
    const modal = $('[data-ws-customer-modal]')
    modal.hidden = false
    for (const input of $$('input[name], textarea[name], select[name]', modal)) input.value = customer[input.name] || ''
    if (!$('[name="nextAction"]', modal)) {
      const extra = document.createElement('div')
      extra.innerHTML = '<label>下一步<input name="nextAction"></label><label>下次跟进时间<input type="datetime-local" name="nextDate"></label>'
      $('.ws-form-grid', modal).append(extra)
    }
    $('[name="nextAction"]', modal).value = customer.nextAction || ''
    $('[name="nextDate"]', modal).value = customer.nextDate || ''
    return
  }
  if (button.matches('[data-trash-customer]')) {
    const customer = state.customers.find(item => item.id === button.dataset.trashCustomer)
    customer.deleted = !customer.deleted
    persist()
    hydrateCustomers()
    return
  }
  if (button.matches('[data-ws-filter], [data-ws-stat-filter]')) {
    state.customerFilter = button.dataset.wsFilter || button.dataset.wsStatFilter
    hydrateCustomers()
    return
  }
  if (button.matches('[data-local-team], [data-ws-space]')) {
    activeSpace = button.dataset.localTeam || 'private'
    hydrateCustomers()
    return
  }
  if (button.matches('[data-ws-team-manage]')) {
    const team = state.teams.find(item => item.id === activeSpace)
    if (!team) return
    $('[data-ws-members-modal]').hidden = false
    $('[data-ws-team-name-box]').hidden = false
    $('[data-ws-team-name-input]').value = team.name
    $('[data-ws-members]').innerHTML = '<div class="ws-member"><strong>本人</strong><span>负责人</span></div>'
    return
  }
  if (button.matches('[data-ws-members-close]')) { $('[data-ws-members-modal]').hidden = true; return }
  if (button.matches('[data-ws-team-name-save]')) {
    const team = state.teams.find(item => item.id === activeSpace)
    const name = $('[data-ws-team-name-input]').value.trim()
    if (!name) { toast('团队名称不能为空'); return }
    team.name = name
    persist()
    hydrateCustomers()
    toast('团队名称已保存到本机')
    return
  }
  if (button.matches('[data-ws-create-team]')) {
    const element = dialog('创建本机团队空间', '<form data-local-team-form><label>空间名称<input name="name" required maxlength="40"></label><p>本机可切换团队空间。成员邀请和协作服务待连接。</p><button type="submit">创建空间</button></form>')
    $('form', element).addEventListener('submit', submitEvent => {
      submitEvent.preventDefault()
      submitEvent.stopPropagation()
      const name = $('input', element).value.trim()
      if (!name) return
      const team = { id: crypto.randomUUID(), name }
      state.teams.push(team)
      activeSpace = team.id
      persist()
      hydrateCustomers()
      element.close()
    })
    return
  }
  if (button.matches('[data-open-daily]')) { $('[data-daily-action-dialog]').hidden = false; return }
  if (button.matches('[data-close-daily]')) { $('[data-daily-action-dialog]').hidden = true; return }
  if (button.matches('[data-dismiss-onboarding]')) { $('[data-onboarding]')?.setAttribute('hidden', ''); return }
  if (button.matches('[data-profile-tab]')) {
    if (currentKey.startsWith('member-profile-public') && button.dataset.profileTab !== 'favorites') {
      await variant('member-profile-public-' + button.dataset.profileTab)
      return
    }
    const tab = button.dataset.profileTab
    const map = { portrait: 'member-profile', daily: 'member-profile-checkins', following: 'member-profile-favorites', favorites: 'member-profile-favorites', notes: 'member-profile-notes', access: 'member-profile-access' }
    if (map[tab]) await variant(map[tab])
    else {
      $$('[data-profile-pane]').forEach(panel => { panel.hidden = panel.dataset.profilePane !== tab })
      $$('[data-profile-tab]').forEach(item => item.classList.toggle('active', item === button))
    }
    return
  }
  if (button.matches('[data-profile-access-open], [data-profile-access]')) { await variant('member-profile-access'); return }
  if (button.matches('[data-profile-access-close]')) { $('[data-profile-access-dialog]').hidden = true; return }
  if (button.matches('[data-level]')) {
    const level = button.dataset.level
    const sections = $$('section.ai-department-section')
    if (level === 'tasks') { dialog('今天的任务', '<p>请选择 AI 员工，给 TA 布置工作。</p>'); return }
    const list = sections[0]?.parentElement
    if (!list) return
    if (level === 'departments') list.hidden = !list.hidden
    else {
      list.hidden = false
      sections.forEach(section => {
        section.hidden = false
        section.classList.remove('is-collapsed')
        const roles = $('.ai-role-list', section)
        if (roles) roles.hidden = false
      })
      if (level === 'employees') {
        $$('.ai-role-team, .ai-employee-details').forEach(panel => { panel.hidden = false })
        $$('.ai-role-card').forEach(card => card.classList.remove('is-collapsed'))
      }
    }
    button.setAttribute('aria-expanded', 'true')
    return
  }
  if (button.matches('[data-task-label]')) {
    dialog('暂时没有可用员工', '<p>未查询到合法的 AI 员工。请联系运营官确认权限。</p>')
    return
  }
  if (button.matches('[data-department]') && button.classList.contains('ai-department-filter')) {
    const department = button.dataset.department
    $$('section.ai-department-section').forEach(panel => { panel.hidden = department !== 'all' && panel.dataset.department !== department })
    $$('.ai-department-filter').forEach(item => item.setAttribute('aria-pressed', String(item === button)))
    return
  }
  if (button.matches('[data-module]') && currentKey === 'library-required') {
    const module = button.dataset.module
    $$('.required-module-section').forEach(panel => { panel.hidden = module !== 'all' && panel.dataset.module !== module; if (!panel.hidden) panel.classList.remove('is-collapsed') })
    return
  }
  if (button.matches('.ai-department-header')) {
    const panel = button.closest('.ai-department-section')
    panel?.classList.toggle('is-collapsed')
    const roles = $('.ai-role-list', panel)
    if (roles) roles.hidden = panel.classList.contains('is-collapsed')
    button.setAttribute('aria-expanded', String(!panel?.classList.contains('is-collapsed')))
    return
  }
  if (button.classList.contains('ai-role-toggle')) {
    const card = button.closest('.ai-role-card')
    card.classList.toggle('is-collapsed')
    toggle(button, $('.ai-role-team', card))
    return
  }
  if (button.classList.contains('ai-employee-info-toggle')) {
    toggle(button, $('.ai-employee-details', button.closest('.ai-employee-card')))
    return
  }
  if (button.classList.contains('ai-tool-group-header')) {
    const group = button.closest('.ai-tool-group')
    toggle(button, $('.ai-tools-grid', group))
    group.classList.toggle('is-collapsed')
    return
  }
  if (/先关注|已关注/.test(text) || button.matches('.card-favorite-btn')) {
    const cardLink = $('a[href]', button.closest('.content-card') || button.parentElement)
    const linkedPage = cardLink ? pageKey(new URL(cardLink.href)) : null
    const favorite = button.closest('[data-employee-id]')?.dataset.employeeId || linkedPage || currentKey
    state.favorites = state.favorites.includes(favorite) ? state.favorites.filter(item => item !== favorite) : [...state.favorites, favorite]
    persist()
    button.textContent = state.favorites.includes(favorite) ? '★ 已关注' : '☆ 我先关注'
    updateFavorites()
    return
  }
  if (button.matches('[data-bm-tab]')) {
    const tab = button.dataset.bmTab
    await variant(tab === 'topics' ? 'benchmark-topics' : tab === 'stats' ? 'benchmark-results' : 'benchmark')
    return
  }
  if (button.closest('#bm-videos')) {
    if (button.textContent.includes('《匆匆》')) await variant('benchmark-detail')
    else toast('这条内容的拆解正文尚未采集，可查看已保存的《匆匆》拆解样本')
    return
  }
  if (button.matches('[data-bm-detail-close]')) { await variant('benchmark'); return }
  if (button.closest('[aria-label="对标内容分页"]')) {
    const next = text === '2' || text === '下一页' ? 'benchmark-page-2' : 'benchmark'
    await variant(next)
    return
  }
  if (button.matches('[data-expand-questions]')) {
    const open = !$$('.journey-question').every(question => question.open)
    $$('.journey-question').forEach(question => { question.open = open })
    button.textContent = open ? '收起全部问题' : '展开全部问题'
    return
  }
  if (text === '保存为经营笔记' || text === '加入本周行动' && !button.closest('form')) {
    const input = $('[aria-label="课程实践动作"]')
    const action = input?.value.trim()
    if (!action) { toast('先写下一件准备实践的事'); return }
    if (text === '保存为经营笔记') {
      state.notes.unshift({ id: crypto.randomUUID(), title: currentPage.title.split('｜')[0], body: action, updated: new Date().toISOString(), category: '内容' })
    } else state.actions.unshift({ id: crypto.randomUUID(), title: action, created: new Date().toISOString() })
    persist()
    toast('已保存到本机')
    return
  }
  if (currentKey === 'founder-role' && /^(看看我的经营角色|继续上次测评|重新测评)$/.test(text)) { await variant('founder-role-questions'); return }
  if (currentKey === 'founder-role-questions' && text === '返回介绍') { await variant('founder-role'); return }
  if (button.closest('.role-options')) {
    $$('button', button.parentElement).forEach(option => option.setAttribute('aria-pressed', String(option === button)))
    state.roleSampleAnswer = text
    persist()
    toast('已保存这道题的本机选择，其余题目与报告算法待接入')
    return
  }
  if (button.matches('[data-inbox-id]')) {
    state.readMessages ||= []
    if (!state.readMessages.includes(button.dataset.inboxId)) state.readMessages.push(button.dataset.inboxId)
    persist()
    const entry = catalog.messages?.[button.dataset.inboxId]
    if (entry) {
      const source = cleanDocument(await getPage(entry))
      $('#message-detail').replaceWith($('#message-detail', source))
      hydrateMessages()
      return
    }
    const title = $('strong', button)?.textContent || ''
    const body = $('small', button)?.textContent || ''
    $('[data-message-title]')?.replaceChildren(title)
    $('[data-message-summary]')?.replaceChildren(body)
    hydrateMessages()
    return
  }
  if (button.matches('[data-message-filter]')) { hydrateMessages(button.dataset.messageFilter); return }
  if (button.matches('[data-source-filter]')) { hydrateMessages('all', button.dataset.sourceFilter); return }
  if (text === '全部标为已读') {
    state.readMessages = $$('[data-inbox-id]').map(item => item.dataset.inboxId)
    persist()
    hydrateMessages()
    return
  }
  if (button.matches('[data-copy-short]')) {
    const link = state.shortLinks.find(item => item.id === button.dataset.copyShort)
    await copyText(location.origin + '/creator-workbench/s/' + link.slug)
    return
  }
  if (button.matches('[data-event-key]')) {
    await variant('activity-' + button.dataset.eventKey)
    return
  }
  if (button.classList.contains('salon-card') || button.getAttribute('aria-label')?.endsWith('，查看活动详情')) {
    const cards = $$('button[aria-label$="，查看活动详情"]')
    const index = cards.indexOf(button)
    if (index >= 0) await variant('activity-' + (index + 1))
    return
  }
  if (button.getAttribute('aria-label') === '关闭活动详情') { await variant('library-activities'); return }
  if (button.matches('[data-card-open]')) { await variant('achievements-card'); return }
  if (button.matches('[data-card-close]')) { $('[data-card-mask]').hidden = true; return }
  if (button.matches('[data-card-range]')) { await variant('achievements-card-' + button.dataset.cardRange); return }
  if (button.matches('[data-card-save]')) {
    const image = $('[data-card-image]')
    if (image?.src) { const anchor = document.createElement('a'); anchor.href = image.src; anchor.download = '经营战绩卡.svg'; anchor.click() }
    return
  }
  if (button.matches('[data-card-copy]')) { await copyText('我的经营战绩\n' + ($('[data-card-mask]')?.innerText || '')); return }
  if (button.matches('[data-scope]')) { await variant('achievements-' + button.dataset.scope); return }
  if (button.matches('[data-open-digest]')) { toast('完整总结已显示在当前卡片中'); return }
  if (button.matches('[data-open-service-account]')) { await variant('settings-service-account'); return }
  if (button.matches('[data-close-service-account]')) { await variant('settings'); return }
  if (button.matches('[data-help-toggle]')) { await variant(currentKey === 'settings-help' ? 'settings' : 'settings-help'); return }
  if (button.closest('.desk-preset-card') && /预览/.test(text)) {
    const index = $$('.desk-preset-card').indexOf(button.closest('.desk-preset-card'))
    await variant('settings-layout-preview-' + index)
    return
  }
  if (button.closest('.coupon-page-controls')) { await variant(text === '2' || text === '下一页' ? 'settings-coupons-2' : 'settings'); return }
  if (button.closest('.coupon-item') && /复制/.test(text)) { await copyText($('.coupon-code', button.closest('.coupon-item'))?.textContent || ''); return }
  if (id === 'theme-switch-btn') { await variant('settings-themes'); return }
  if (button.matches('.theme-picker-option[data-theme]')) {
    state.theme = button.dataset.theme
    persist()
    document.documentElement.setAttribute('data-theme', state.theme)
    document.documentElement.className = document.documentElement.className.replace(/theme-[\w-]+/g, '') + ' ' + state.theme
    return
  }
  if (button.classList.contains('theme-picker-close')) { $('#theme-picker-modal')?.close(); return }
  if (id === 'text-save') { saveText(); return }
  if (id === 'text-copy') { await copyText($('#text-body').value); $('#text-publication').hidden = false; return }
  if (id === 'text-new') {
    activeDraftId = null
    const url = new URL(location.href)
    url.searchParams.delete('draft')
    history.replaceState({}, '', url)
    $('#text-form').reset()
    updatePreviews()
    return
  }
  if (button.matches('[data-open-draft]')) {
    const draft = state.drafts.find(item => item.id === button.dataset.openDraft)
    activeDraftId = draft.id
    const url = new URL(location.href)
    url.searchParams.set('draft', draft.id)
    history.replaceState({}, '', url)
    if (draft.type === 'video') { await navigate('/creator-workbench/member/video-studio.html?draft=' + draft.id); return }
    if (draft.type === 'article') {
      $('#text-title').value = draft.title
      $('#text-body').value = draft.body
      $('#text-reflection').value = draft.reflection || ''
      updatePreviews()
    } else if (draft.type === 'moments') {
      $('#ms-output').hidden = false
      $('#ms-draft').hidden = false
      $('#ms-body').value = draft.body
      updatePreviews()
    }
    return
  }
  if (id === 'ms-manual') {
    $('#ms-output').hidden = false
    $('#ms-draft').hidden = false
    $('#ms-body').focus()
    $('#ms-output').scrollIntoView({ behavior: 'smooth' })
    return
  }
  if (id === 'ms-save') { saveText('moments'); return }
  if (id === 'ms-copy') { await copyText($('#ms-body').value); return }
  if (id === 'ms-publish-step') { $('#ms-publishing').hidden = false; $('#ms-published').disabled = false; return }
  if (['text-publish', 'ms-published', 'studio-publish-confirm'].includes(id)) {
    const draft = state.drafts.find(item => item.id === activeDraftId)
    if (!draft) { toast('请先保存这份内容'); return }
    draft.published = true
    persist()
    toast('已在本机记录“已发布”状态')
    return
  }
  if (id === 'studio-new' || id === 'studio-make-another') {
    const draft = { id: crypto.randomUUID(), type: 'video', title: '我的视频草稿', body: '', brief: '', step: 1, updated: new Date().toISOString() }
    state.drafts.unshift(draft)
    activeDraftId = draft.id
    persist()
    hydrateVideo()
    const container = $('[data-studio-panel="1"]')
    if (container) container.hidden = false
    $('#studio-brief')?.focus()
    return
  }
  if (button.closest('figure') && $('img', button.closest('figure'))) {
    const image = $('img', button.closest('figure'))
    dialog(image.alt || '图片预览', `<img src="${escapeHTML(image.src)}" style="max-width:100%;height:auto">`)
    return
  }
  if (button.matches('[data-studio-step], [data-studio-next]')) { showVideoStep(button.dataset.studioStep || button.dataset.studioNext); return }
  if (id === 'studio-save') { saveVideo(); return }
  if (id === 'studio-copy' || id === 'studio-copy-script' || id === 'studio-copy-preview') { await copyText($('#studio-script')?.value); return }
  if (id === 'studio-copy-title') { await copyText($('#studio-topic-final')?.value || $('#studio-topic')?.value); return }
  if (button.matches('[data-studio-fold]')) { toggle(button, document.getElementById(button.getAttribute('aria-controls'))); return }
  if (button.matches('[data-vss="toggle"]')) { toggle(button, $('#vss-body')); return }
  if (button.matches('[data-notes-max], [data-portrait-expand]') || /最大化/.test(text)) {
    const panel = button.closest('section, [data-notes-editor-panel], .portrait-editor, .text-editor') || button.parentElement
    panel.classList.toggle('replica-fullscreen')
    return
  }
  if (button.matches('[data-md-insert]')) {
    const textarea = $('[data-notes-content]')
    if (textarea) { textarea.setRangeText(button.dataset.mdInsert || text, textarea.selectionStart, textarea.selectionEnd, 'end'); textarea.dispatchEvent(new Event('input', { bubbles: true })) }
    return
  }
  if (button.getAttribute('aria-controls')) {
    toggle(button, document.getElementById(button.getAttribute('aria-controls')))
    return
  }
  if (button.closest('.replica-chat')) return
  if (/复制/.test(text)) {
    const value = button.closest('article, section')?.querySelector('textarea, pre, code')
    await copyText(value?.value || value?.textContent || '')
    return
  }
  if (/AI|生成|验证|绑定|授权|推送|报名|提醒|邀请|保存新密码/.test(text)) {
    dialog('服务连接状态', '<p>当前是本地前端复刻。这个动作需要独立的服务端、账号授权或 AI 接口。</p><p>可以先使用本机笔记、内容编辑、客户资料和行动记录。</p>')
    return
  }
})

// 弹窗内的本地数据操作独立处理，避免影响其他表单。
document.addEventListener('click', event => {
  if (event.target.closest('[data-export-local]')) exportLocal()
})

window.addEventListener('popstate', () => render(pageKey(new URL(location.href))))

try {
  catalog = await (await fetch('/creator-workbench/data/catalog.json')).json()
  if (location.pathname.startsWith('/creator-workbench/s/')) {
    const slug = decodeURIComponent(location.pathname.slice(21))
    const link = state.shortLinks.find(item => item.slug === slug)
    if (link) {
      const target = new URL(link.target)
      if (/^(www\.)?wxgaochu\.com$/.test(target.hostname) || target.origin === location.origin) {
        history.replaceState({}, '', target.pathname + target.search + target.hash)
        await render(pageKey(new URL(location.href)))
      } else {
        await render('main')
        dialog('本机短链接目标', `<a href="${escapeHTML(target.href)}" target="_blank" rel="noopener noreferrer">打开 ${escapeHTML(target.hostname)}</a>`)
      }
    } else { await render('main'); toast('当前浏览器没有这条本机短链接') }
  } else await render(pageKey(new URL(location.href)))
} catch (error) {
  document.body.innerHTML = `<main class="replica-loading"><h1>工作台暂时没有打开</h1><p>${escapeHTML(error.message)}</p><p>在项目目录运行 npm run build 后重新打开。</p></main>`
}
