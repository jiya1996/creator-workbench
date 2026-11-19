const moduleNames = { map: '经营地图', today: '今日经营', review: '成果与复盘', featured: '本期精选' }
const defaultOrder = Object.keys(moduleNames)
const focusTargets = { customers: '[data-overview-followups]', actions: '[data-desk-pulse]', progress: '[data-overview-week]' }
const shortcuts = {
  assessment: { label: '商业体检', href: '/creator-workbench/member/journey.html' },
  portrait: { label: '商业定位', href: '/creator-workbench/member/portrait.html' },
  customers: { label: '客户跟进', href: '/creator-workbench/member/workspaces.html' },
  achievements: { label: '成长记录', href: '/creator-workbench/member/achievements.html' },
  featured: { label: '经营百宝箱', href: '/creator-workbench/member/library.html?section=featured' }
}

// 预设取自原站 defaults 与两份布局预览，常用入口按原站约定保留。
const presets = [
  { name: '引导布局', primaryFocus: 'balanced', moduleOrder: defaultOrder, compactSections: [], onboardingDismissed: false },
  { name: '工作布局', primaryFocus: 'actions', moduleOrder: ['today', 'map', 'featured', 'review'], compactSections: ['review'], onboardingDismissed: true }
]

function normalizePreferences(value = {}) {
  value ||= {}
  const order = Array.isArray(value.moduleOrder) ? value.moduleOrder.filter(key => Object.hasOwn(moduleNames, key)) : []
  return {
    ...value,
    primaryFocus: ['balanced', ...Object.keys(focusTargets)].includes(value.primaryFocus) ? value.primaryFocus : 'balanced',
    moduleOrder: [...new Set([...order, ...defaultOrder])],
    compactSections: Array.isArray(value.compactSections) ? [...new Set(value.compactSections.filter(key => Object.hasOwn(moduleNames, key)))] : [],
    favoriteLinks: Array.isArray(value.favoriteLinks) ? [...new Set(value.favoriteLinks.filter(key => Object.hasOwn(shortcuts, key)))].slice(0, 4) : [],
    onboardingDismissed: Boolean(value.onboardingDismissed)
  }
}

function makeElement(tag, text, className) {
  const node = document.createElement(tag)
  if (text !== undefined) node.textContent = text
  if (className) node.className = className
  return node
}

function applyDashboard(preferences, state, persist) {
  const root = document.querySelector('[data-cockpit="home"]')
  if (!root) return
  const modulesHost = root.querySelector('[data-module-key]')?.parentElement
  for (const key of preferences.moduleOrder) {
    const section = root.querySelector(`[data-module-key="${key}"]`)
    if (section && modulesHost) modulesHost.append(section)
  }
  // 与原站一致，商业数字分身和本周行动跟随经营地图。
  const map = root.querySelector('[data-module-key="map"]')
  const founder = root.querySelector('[data-founder-role-home]')
  const weekly = root.querySelector('#desk-weekly')
  if (map && founder && map.parentElement === founder.parentElement) map.after(founder)
  const weeklyAnchor = founder?.previousElementSibling === map ? founder : map
  if (weekly && weeklyAnchor && weekly.parentElement === weeklyAnchor.parentElement) weeklyAnchor.after(weekly)

  root.querySelectorAll('[data-module-key]').forEach(section => {
    const compact = preferences.compactSections.includes(section.dataset.moduleKey)
    section.classList.toggle('is-preference-compact', compact)
    const heading = section.querySelector(':scope > .desk-heading')
    heading?.querySelector('[data-expand-preference-section]')?.remove()
    if (compact && heading) {
      const button = makeElement('button', '展开', 'desk-button')
      button.type = 'button'
      button.dataset.expandPreferenceSection = ''
      button.addEventListener('click', event => {
        event.stopPropagation()
        section.classList.remove('is-preference-compact')
        button.remove()
      })
      heading.append(button)
    }
  })
  root.querySelectorAll('.is-primary-focus').forEach(node => node.classList.remove('is-primary-focus'))
  const focusSelector = focusTargets[preferences.primaryFocus]
  if (focusSelector) root.querySelector(focusSelector)?.classList.add('is-primary-focus')
  const links = root.querySelector('[data-preference-shortcuts]')
  if (links) {
    links.replaceChildren()
    preferences.favoriteLinks.forEach(key => {
      const item = shortcuts[key]
      const link = makeElement('a', item.label)
      link.href = item.href
      links.append(link)
    })
    links.hidden = preferences.favoriteLinks.length === 0
  }
  const onboarding = root.querySelector('[data-onboarding]')
  const forced = new URLSearchParams(location.search).get('show-onboarding') === '1'
  if (onboarding) onboarding.hidden = !forced && preferences.onboardingDismissed
  root.querySelector('[data-dismiss-onboarding]')?.addEventListener('click', event => {
    event.stopPropagation()
    if (onboarding) onboarding.hidden = true
    state.workspacePreferences = { ...preferences, onboardingDismissed: true }
    persist()
  })
}

export function mountPreferences({ state, persist, toast }) {
  let preferences = normalizePreferences(state.workspacePreferences)
  applyDashboard(preferences, state, persist)
  const root = document.querySelector('[data-settings-preferences]')
  const form = root?.querySelector('[data-preferences-form]')
  if (!form) return
  if (form.dataset.localPreferencesMounted) return
  form.dataset.localPreferencesMounted = 'true'
  const find = name => root.querySelector(`[data-${name}]`)
  const cards = [...root.querySelectorAll('.desk-preset-card')]
  let editedOrder = [...preferences.moduleOrder]
  let previewedPreset = null

  function setStatus(message, preset = false) {
    const status = find(preset ? 'preset-status' : 'preferences-status')
    if (status) status.textContent = message
    toast(message)
  }

  function renderOrder() {
    const host = find('module-order')
    if (!host) return
    host.replaceChildren()
    editedOrder.forEach((key, index) => {
      const row = makeElement('div', undefined, 'desk-module-order-row')
      const controls = makeElement('div')
      for (const [label, delta] of [['上移', -1], ['下移', 1]]) {
        const button = makeElement('button', label)
        button.type = 'button'
        button.disabled = index + delta < 0 || index + delta >= editedOrder.length
        button.addEventListener('click', event => {
          event.stopPropagation()
          const movedKey = editedOrder[index]
          editedOrder[index] = editedOrder[index + delta]
          editedOrder[index + delta] = movedKey
          renderOrder()
        })
        controls.append(button)
      }
      row.append(makeElement('strong', `${index + 1}. ${moduleNames[key]}`), controls)
      host.append(row)
    })
  }

  function renderForm() {
    form.elements.primaryFocus.value = preferences.primaryFocus
    form.querySelectorAll('input[name="favoriteLinks"]').forEach(input => { input.checked = preferences.favoriteLinks.includes(input.value) })
    form.querySelectorAll('input[name="compactSections"]').forEach(input => { input.checked = preferences.compactSections.includes(input.value) })
    editedOrder = [...preferences.moduleOrder]
    renderOrder()
  }

  function renderPresets() {
    cards.forEach(card => {
      const preset = presets.find(item => item.name === card.querySelector('strong')?.textContent)
      if (!preset) return
      card.querySelectorAll('.desk-preset-badge, .desk-preset-changes, .desk-preset-empty').forEach(node => node.remove())
      const row = card.querySelector('.desk-button-row')
      const previewButton = row?.querySelector('button')
      const applyButton = row?.querySelector('button:last-child')
      const active = preferences.primaryFocus === preset.primaryFocus && preferences.moduleOrder.join() === preset.moduleOrder.join() && preferences.compactSections.join() === preset.compactSections.join() && preferences.onboardingDismissed === preset.onboardingDismissed
      card.classList.toggle('is-active', active)
      if (applyButton) applyButton.disabled = active
      if (previewButton) previewButton.textContent = previewedPreset === preset.name ? '收起预览' : '预览'
      if (active || previewedPreset === preset.name) {
        card.insertBefore(makeElement('span', active ? '当前布局' : '正在预览', 'desk-preset-badge'), row)
        const changes = makeElement('ul', undefined, 'desk-preset-changes')
        const focusLabels = { balanced: '经营全貌', actions: '今日行动' }
        for (const text of [
          '模块顺序：' + preset.moduleOrder.map(key => moduleNames[key]).join(' → '),
          '最先关注：' + focusLabels[preset.primaryFocus],
          '默认收起：' + (preset.compactSections.map(key => moduleNames[key]).join('、') || '无'),
          preset.onboardingDismissed ? '不再显示使用引导' : '重新显示使用引导'
        ]) changes.append(makeElement('li', text))
        card.insertBefore(changes, row)
      }
    })
    const undo = find('preset-undo')
    if (undo) undo.hidden = !state.workspacePreferencesUndo
  }

  function save(next, message, undo = null) {
    preferences = normalizePreferences(next)
    state.workspacePreferences = structuredClone(preferences)
    state.workspacePreferencesUndo = undo
    persist()
    previewedPreset = null
    renderForm()
    renderPresets()
    setStatus(message)
  }

  form.addEventListener('submit', event => {
    event.preventDefault()
    event.stopPropagation()
    if (!form.reportValidity()) return
    save({
      ...preferences,
      primaryFocus: form.elements.primaryFocus.value,
      moduleOrder: editedOrder,
      compactSections: [...form.querySelectorAll('input[name="compactSections"]:checked')].map(input => input.value),
      favoriteLinks: [...form.querySelectorAll('input[name="favoriteLinks"]:checked')].map(input => input.value)
    }, '工作台偏好已保存到本机，返回高级工作台可查看效果')
  })
  form.addEventListener('change', event => {
    const input = event.target
    if (input.matches('input[name="favoriteLinks"]') && form.querySelectorAll('input[name="favoriteLinks"]:checked').length > 4) {
      input.checked = false
      setStatus('常用入口最多选择 4 个')
    }
  })
  find('reset-preferences')?.addEventListener('click', event => {
    event.stopPropagation()
    save({}, '已在本机恢复默认布局')
  })
  find('show-onboarding')?.addEventListener('click', event => {
    event.stopPropagation()
    save({ ...preferences, onboardingDismissed: false }, '本机使用引导已重新打开')
    location.href = '/creator-workbench/member/main.html?mode=advanced&show-onboarding=1#desk-onboarding'
  })
  cards.forEach(card => {
    const preset = presets.find(item => item.name === card.querySelector('strong')?.textContent)
    if (!preset) return
    const buttons = card.querySelectorAll('.desk-button-row button')
    buttons[0]?.addEventListener('click', event => {
      event.stopPropagation()
      previewedPreset = previewedPreset === preset.name ? null : preset.name
      renderPresets()
    })
    buttons[1]?.addEventListener('click', event => {
      event.stopPropagation()
      const previous = structuredClone(preferences)
      const { name, ...values } = preset
      save({ ...preferences, ...values }, `已在本机应用${name}，返回高级工作台可查看效果`, previous)
    })
  })
  find('preset-undo')?.addEventListener('click', event => {
    event.stopPropagation()
    if (state.workspacePreferencesUndo) save(state.workspacePreferencesUndo, '已在本机撤销上一次布局应用')
  })
  find('accept-layout-recommendation')?.addEventListener('click', event => {
    event.stopPropagation()
    setStatus('个性化布局建议需要原站服务结果，当前可使用手动偏好和布局预设')
  })
  find('dismiss-layout-recommendation')?.addEventListener('click', event => {
    event.stopPropagation()
    const recommendation = find('layout-recommendation')
    if (recommendation) recommendation.hidden = true
    setStatus('本次布局建议已在当前页面收起')
  })
  renderForm()
  renderPresets()
  const intro = root.querySelector('.settings-card-heading p')
  if (intro) intro.textContent = '按你的习惯工作，偏好保存在当前浏览器'
  const layoutIntro = root.querySelector('[data-dashboard-preferences] > p')
  if (layoutIntro) layoutIntro.textContent = '选择最先关注的内容、常用入口和模块顺序。偏好保存在当前浏览器。'
}
