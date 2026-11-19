import { mountOriginalFounder } from './founder-runtime.js'
import { mountOriginalFounderGrowth } from './founder-growth-runtime.js'

let capturedPromise
const loadCaptured = () => capturedPromise ||= fetch('/creator-workbench/data/founder-report.json').then(response => {
  if (!response.ok) throw new Error('测评报告资料读取失败，请重新构建工作台')
  return response.json()
})

export async function hydrateFounderSummary({ state }) {
  const card = document.querySelector('[data-founder-role-home]')
  if (!card) return
  try {
    const captured = await loadCaptured()
    if (!card.isConnected) return
    const data = captured.summary
    const completed = data.completed && !state.founderReportHidden
    card.hidden = false
    card.querySelector('[data-role-names]').textContent = completed ? data.roleNames.join(' × ') : '先认识自己，再找到合适的分工'
    card.querySelector('[data-role-summary]').textContent = completed ? data.summary : '完成测评后，可以查看经营角色与协作建议。'
    const states = card.querySelector('[data-role-profile-states]')
    states.replaceChildren()
    for (const [label, done] of [['商业定位与自画像', data.positioning], ['创始人经营角色', completed], ['经营阶段', data.stage]]) {
      const item = document.createElement('span')
      item.textContent = `${label} ${done ? '已完善' : '待完善'}`
      states.append(item)
    }
    card.querySelector('[data-role-open]').textContent = completed ? '查看我的经营角色' : '看看我的经营角色'
  } catch { /* 摘要读取失败时保留已有首页入口。 */ }
}

export async function mountFounder({ state, persist, toast, key }) {
  const owner = document.querySelector('#role-app')
  const captured = await loadCaptured()
  if (!owner?.isConnected) return
  const source = captured.state
  const originalRun = source.latest
  state.founderAnswers ||= {}

  function draft() {
    if (!state.founderDraft) return null
    return {
      ...state.founderDraft,
      config: originalRun.config,
      answers: state.founderAnswers
    }
  }

  function start(body = {}) {
    state.founderDraft ||= { id: crypto.randomUUID(), revision: 0, createdAt: Date.now() }
    state.founderDraft.shareContext = Boolean(body.shareContext)
    persist()
    return draft()
  }

  function sourceState() {
    const result = structuredClone(source)
    result.draft = draft()
    result.latest = state.founderReportHidden ? null : result.latest
    result.contextEnabled = state.founderContextEnabled ?? result.contextEnabled
    return result
  }

  function growthState() {
    const result = structuredClone(captured.growth)
    if (state.founderProfile) {
      result.profile.data = { ...result.profile.data, ...state.founderProfile.data }
      result.context.business = { ...result.context.business, ...state.founderProfile.business }
      result.context.notice = '这里显示本机保存的业务草稿，阶段判断与报告生成服务待接入。'
    }
    return result
  }

  async function request(value, options = {}) {
    const url = new URL(value, location.origin)
    const route = url.pathname.replace('/api/member/founder-role', '')
    const method = (options.method || 'GET').toUpperCase()
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body || {}
    if (method === 'GET') {
      if (!route) return sourceState()
      if (route === '/growth') return growthState()
      if (route === '/employees') return structuredClone(captured.employees)
      if (route === '/summary') return structuredClone(captured.summary)
      throw new Error('当前没有采集到这份历史或共享报告')
    }
    if (route === '/start' && method === 'POST') return { ok: true, run: start(body) }
    const answer = route.match(/^\/([^/]+)\/answer$/)
    if (answer && method === 'POST') {
      const active = draft()
      if (!active || active.id !== answer[1]) throw new Error('请返回测评首页，重新打开本机草稿')
      const question = active.config.questions.find(item => item.id === body.questionId)
      const value = Number(body.value)
      if (!question || !Number.isInteger(value) || value < 1 || value > 5) throw new Error('请选择当前题目的一项答案')
      if (body.revision !== active.revision) throw new Error('答题草稿已更新，请刷新后继续')
      state.founderAnswers[question.id] = value
      state.founderDraft.revision++
      persist()
      return { ok: true, run: draft() }
    }
    if (/^\/[^/]+\/complete$/.test(route)) {
      const completed = originalRun.config.questions.filter(question => state.founderAnswers[question.id]).length
      if (completed !== originalRun.config.questions.length) throw new Error(`已保存 ${completed} / ${originalRun.config.questions.length} 题，请先完成全部题目`)
      throw new Error('回答已保存到本机。新测评的评分服务待接入，可返回首页查看已采集的原站报告。')
    }
    if (route === '/context' && method === 'PUT') {
      state.founderContextEnabled = Boolean(body.enabled)
      persist()
      return { ok: true }
    }
    if (route === '/growth/profile' && method === 'PUT') {
      state.founderProfile = {
        data: { publishing: body.publishing, consulting: body.consulting, timeBudget: body.timeBudget },
        business: { service: body.business?.service || '', audience: body.business?.audience || '', problem: body.business?.problem || '' }
      }
      persist()
      return { ok: true, savedLocally: true, profile: growthState().profile }
    }
    if (!route && method === 'DELETE') {
      state.founderAnswers = {}
      state.founderDraft = null
      state.founderReportHidden = true
      state.founderContextEnabled = false
      delete state.founderProfile
      persist()
      return { ok: true }
    }
    if (route === '/sharing') throw new Error('会员报告分享服务待接入，当前报告保存在本机项目中')
    throw new Error('报告生成与在线服务尚未接入，已采集的真实报告可以继续阅读')
  }

  if (key === 'founder-role-questions') start()
  window.WxgcMember = {
    request,
    showToast: toast,
    confirm: async message => window.confirm(message.includes('删除') ? '删除当前浏览器中的测评回答、报告显示和关联设置？' : message)
  }
  mountOriginalFounderGrowth()
  const reportView = key.startsWith('founder-role-report') || location.hash.startsWith('#growth-')
  const view = key === 'founder-role-report-legacy' ? 'legacy' : reportView ? 'report' : key === 'founder-role-questions' ? 'questions' : 'home'
  await mountOriginalFounder({ view })
  if (!owner.isConnected) return
  if (key === 'founder-role-report-expanded') owner.querySelectorAll('details').forEach(detail => { detail.open = true })
  const trait = key.split('founder-role-report-trait-')[1]
  if (trait) owner.querySelector(`[data-trait-row="${CSS.escape(trait)}"]`)?.click()

  const notice = document.createElement('p')
  notice.className = 'role-small replica-founder-source'
  notice.textContent = '本页报告来自原站已完成的测评记录。新答题与业务草稿保存在本机，评分和报告生成服务待接入。'
  document.querySelector('#role-status')?.after(notice)
}
