/* 两个爆款页面共用的搜索与分页。远程列表由服务端分页，本地小列表用同一交互。 */
(function () {
  'use strict';
  const node = (tag, text, cls) => { const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el; };
  window.WxgcBenchmarkList = {
    create({ target, label, placeholder = '输入关键词搜索', load, render, searchText, pageSize = 10, beforeSearch, afterActions }) {
      const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
      const form = node('form', '', 'bm-searchbar'); form.setAttribute('role', 'search');
      const field = node('label', '', 'pm-field'); field.append(node('span', `搜索${label}`));
      const input = node('input'); input.type = 'search'; input.maxLength = 100; input.placeholder = placeholder; field.append(input);
      const submit = node('button', '搜索', 'pm-btn pm-primary'); submit.type = 'submit';
      const clear = node('button', '清空', 'pm-btn'); clear.type = 'button';
      if (beforeSearch) { form.classList.add('bm-list-toolbar'); form.append(beforeSearch); }
      form.append(field);
      if (afterActions) {
        const actions = node('div', '', 'bm-search-actions'); actions.append(submit, clear, afterActions); form.append(actions);
      } else form.append(submit, clear);
      const status = node('p', '', 'pm-status'); status.setAttribute('role', 'status');
      const nav = node('nav', '', 'bm-pagination'); nav.setAttribute('aria-label', `${label}分页`);
      const summary = node('span', '', 'bm-page-summary'); const controls = node('div', '', 'bm-page-controls');
      nav.append(summary, controls); target.before(form, status); target.after(nav);
      let page = 1, q = '', total = 0, local = [], epoch = 0, timer;
      const button = (text, go, disabled, active) => {
        const el = node('button', text, `pm-btn${active ? ' pm-primary' : ''}`); el.type = 'button'; el.disabled = disabled;
        if (active) el.setAttribute('aria-current', 'page');
        el.addEventListener('click', () => { page = go; refresh(); }); return el;
      };
      async function refresh() {
        const seq = ++epoch; status.textContent = '正在加载…'; status.classList.remove('is-error');
        try {
          let result;
          if (load) result = await load({ page, q, pageSize: size });
          else {
            const term = q.toLocaleLowerCase();
            const all = local.filter(item => !term || String(searchText ? searchText(item) : JSON.stringify(item)).toLocaleLowerCase().includes(term));
            page = Math.min(page, Math.max(1, Math.ceil(all.length / size)));
            result = { items: all.slice((page - 1) * size, page * size), total: all.length, page };
          }
          if (seq !== epoch) return;
          if (result.ok === false) throw new Error(result.message || '列表没有加载成功，请重试。');
          total = Number(result.total || 0); page = result.page || page;
          const pages = Math.max(1, Math.ceil(total / size));
          if (page > pages) { page = pages; return refresh(); }
          render(result.items || [], { ...result, query: q }); status.textContent = '';
          summary.textContent = total ? `共 ${total} 条 · 每页 ${size} 条 · 当前 ${((page - 1) * size) + 1}–${Math.min(page * size, total)} 条` : q ? '没有找到匹配内容，试试其他关键词' : '暂时没有内容';
          controls.replaceChildren(button('上一页', page - 1, page <= 1));
          const start = Math.max(1, Math.min(page - 2, pages - 4));
          for (let n = start; n <= Math.min(pages, start + 4); n++) controls.append(button(String(n), n, n === page, n === page));
          controls.append(button('下一页', page + 1, page >= pages));
          nav.hidden = total === 0;
          if (!total) status.textContent = summary.textContent;
        } catch (error) {
          if (seq !== epoch) return;
          status.textContent = error.message || '暂时没有加载成功，请重新搜索。'; status.classList.add('is-error');
        }
      }
      const search = () => { q = input.value.trim(); page = 1; refresh(); };
      form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); search(); });
      input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 250); });
      clear.addEventListener('click', () => { clearTimeout(timer); input.value = ''; search(); input.focus(); });
      return { refresh, reset({ clearSearch = false } = {}) { page = 1; if (clearSearch) { clearTimeout(timer); q = ''; input.value = ''; } return refresh(); }, setItems(items) { local = items; return refresh(); }, get page() { return page; } };
    }
  };
})();
