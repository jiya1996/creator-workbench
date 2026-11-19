import { mountOriginalBenchmark } from './benchmark-runtime.js'

let corpusPromise
const detailCache = new Map()
const loadCorpus = () => corpusPromise ||= fetch('/creator-workbench/data/benchmark.json').then(response => {
  if (!response.ok) throw new Error('爆款资料尚未生成，请重新构建工作台')
  return response.json()
})

export async function mountBenchmark({ state, persist, toast, key }) {
  const owner = document.querySelector('#bm-app')
  const corpus = await loadCorpus()
  if (!owner?.isConnected) return
  state.benchmark ||= { topics: [], scripts: [] }
  const local = state.benchmark
  const videos = corpus.items
  const byId = new Map(videos.map(video => [video.videoId, video]))
  const snapshot = structuredClone(corpus.bootstrap)
  const nicheMatches = (video, code) => (snapshot.rawIndustries[video.niche] || []).includes(code)

  function filtered(params, includeHook = true) {
    const search = (params.get('q') || '').toLocaleLowerCase()
    return videos.filter(video => {
      if (params.get('niche') && video.niche !== params.get('niche')) return false
      if (params.get('track') && params.get('track') !== '__all__' && !nicheMatches(video, params.get('track'))) return false
      if (params.get('sub') && !(snapshot.rawSubtracks[video.niche] || []).includes(params.get('sub'))) return false
      if (params.get('accountId') && video.accountId !== params.get('accountId')) return false
      if (includeHook && params.get('hookType') && video.hookType !== params.get('hookType')) return false
      return !search || [video.title, video.accountName, video.niche, ...(video.hashtags || [])].join(' ').toLocaleLowerCase().includes(search)
    })
  }

  function responseVideos(params) {
    const rows = filtered(params)
    const metrics = { engagement: 'engagementIndex', like: 'likeCount', collect: 'collectCount', share: 'shareCount', comment: 'commentCount' }
    rows.sort((first, second) => Number(second[metrics[params.get('sortBy')] || 'engagementIndex']) - Number(first[metrics[params.get('sortBy')] || 'engagementIndex']) || first.videoId.localeCompare(second.videoId))
    const allHooks = filtered(params, false)
    const hookCounts = Object.fromEntries(snapshot.hookTypes.map(hook => [hook.id, allHooks.filter(video => video.hookType === hook.id).length]))
    const offset = Math.max(0, Number(params.get('offset')) || 0)
    const size = Math.max(1, Number(params.get('limit')) || 9)
    return { ok: true, total: rows.length, totalNoHook: allHooks.length, hookCounts, items: rows.slice(offset, offset + size) }
  }

  async function request(value, options = {}) {
    const url = new URL(value, location.origin)
    const route = url.pathname.replace('/api/member/benchmark', '')
    const method = options.method || 'GET'
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body || {}
    if (route === '/bootstrap') {
      return structuredClone(snapshot)
    }
    if (route === '/videos') return responseVideos(url.searchParams)
    if (route.startsWith('/videos/')) {
      const id = decodeURIComponent(route.slice('/videos/'.length))
      const file = corpus.detailFiles[id]
      if (!file) throw new Error('未找到这份已采集的拆解资料')
      if (!detailCache.has(id)) {
        const response = await fetch(file)
        if (!response.ok) throw new Error('拆解资料暂时没有读取成功，请重试')
        detailCache.set(id, await response.json())
      }
      return detailCache.get(id)
    }
    if (route === '/accounts') {
      const grouped = new Map()
      for (const video of filtered(url.searchParams, false)) {
        const account = grouped.get(video.accountId) || { id: video.accountId, accountId: video.accountId, name: video.accountName, videoCount: 0 }
        account.videoCount++
        grouped.set(video.accountId, account)
      }
      return { ok: true, items: [...grouped.values()].sort((first, second) => second.videoCount - first.videoCount).slice(0, 50) }
    }
    if (route === '/baseline') return corpus.baseline
    if (route === '/topics' && method === 'GET') return { ok: true, items: local.topics }
    if (route === '/scripts' && method === 'GET') return { ok: true, items: local.scripts.filter(script => script.topicId === url.searchParams.get('topicId')) }
    if (route === '/topics' && method === 'POST') {
      if (!body.ownEvidence?.trim()) throw new Error('请先填写自己的论据')
      const topicId = crypto.randomUUID()
      const source = byId.get(body.sourceVideoId)
      local.topics.unshift({ ...body, topicId, sourceTitle: source?.title, sourceAccountName: source?.accountName, status: 'candidate', createdAt: Date.now(), updatedAt: Date.now() })
      persist()
      return { ok: true, topicId }
    }
    const topicRoute = route.match(/^\/topics\/([^/]+)(\/stats)?$/)
    if (topicRoute) {
      const topic = local.topics.find(item => item.topicId === decodeURIComponent(topicRoute[1]))
      if (!topic) throw new Error('这份本机选题已不存在')
      if (method === 'DELETE') local.topics = local.topics.filter(item => item !== topic)
      else if (method === 'PATCH') Object.assign(topic, body, { updatedAt: Date.now() })
      else if (method === 'PUT' && topicRoute[2]) Object.assign(topic, { stats: body, status: 'reviewed', updatedAt: Date.now() })
      persist()
      return { ok: true, topic }
    }
    throw new Error('这一步需要接入模型或服务端，当前材料和选题已保存在本机')
  }

  window.WxgcMember = { request, showToast: toast, confirm: async message => window.confirm(message) }
  document.querySelectorAll('#bm-detail[open],#bm-topic[open],#bm-draft[open],#bm-stats[open],#bm-confirm[open]').forEach(dialog => dialog.removeAttribute('open'))
  const box = document.querySelector('#bm-videos')
  if (box.previousElementSibling?.classList.contains('pm-status')) box.previousElementSibling.remove()
  if (box.nextElementSibling?.classList.contains('bm-pagination')) box.nextElementSibling.remove()
  const ready = new Promise(resolve => document.addEventListener('replica:benchmark-ready', resolve, { once: true }))
  mountOriginalBenchmark()
  await ready
  if (key === 'benchmark-topics') document.querySelector('[data-bm-tab="topics"]').click()
  if (key === 'benchmark-results') document.querySelector('[data-bm-tab="stats"]').click()
  if (key === 'benchmark-page-2') [...document.querySelectorAll('[aria-label="对标内容分页"] button')].find(button => button.textContent === '2')?.click()
  if (key === 'benchmark-detail') document.querySelector('.bm-video-card')?.click()
}
