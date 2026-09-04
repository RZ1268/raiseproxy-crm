(() => {
  if (window.__rpSafeExportPatch) return;
  window.__rpSafeExportPatch = true;

  function findLeadTable() {
    return [...document.querySelectorAll('table')].find(table => {
      const head = (table.querySelector('thead')?.innerText || '').replace(/\s+/g, ' ');
      return /Email/i.test(head) && /Owner|状态/.test(head);
    }) || null;
  }

  function cleanText(value) {
    return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function csvCell(value) {
    const s = String(value ?? '');
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function downloadCsv(filename, csv) {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportVisibleLeads() {
    const table = findLeadTable();
    if (!table) {
      if (typeof toast === 'function') toast('没有找到当前客户列表');
      else alert('没有找到当前客户列表');
      return;
    }

    const headerCells = [...table.querySelectorAll('thead th')];
    const includeIndexes = [];
    const headers = [];
    headerCells.forEach((th, index) => {
      const name = cleanText(th.innerText || th.textContent);
      if (!name) return;
      if (/^操作$/.test(name)) return;
      includeIndexes.push(index);
      headers.push(name.replace(/[⇅↕↑↓]+/g, '').trim());
    });

    const allRows = [...table.querySelectorAll('tbody tr')].filter(row => row.offsetParent !== null);
    const selectedRows = allRows.filter(row => !!row.querySelector('input[type="checkbox"]:checked'));
    const rows = selectedRows.length ? selectedRows : allRows;

    if (!rows.length) {
      if (typeof toast === 'function') toast('当前没有可导出的客户');
      else alert('当前没有可导出的客户');
      return;
    }

    const lines = [headers.map(csvCell).join(',')];
    for (const row of rows) {
      const cells = [...row.querySelectorAll('td')];
      const values = includeIndexes.map(index => cleanText(cells[index]?.innerText || cells[index]?.textContent || ''));
      lines.push(values.map(csvCell).join(','));
    }

    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '_',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0')
    ].join('');
    const mode = selectedRows.length ? `selected_${rows.length}` : `current_page_${rows.length}`;
    downloadCsv(`raiseproxy_${mode}_${stamp}.csv`, lines.join('\r\n'));

    const msg = selectedRows.length
      ? `已导出勾选的 ${rows.length} 条客户`
      : `未勾选客户，已导出当前页 ${rows.length} 条`;
    if (typeof toast === 'function') toast(msg);
  }

  function relabelExportButton() {
    for (const el of document.querySelectorAll('button,a')) {
      const text = cleanText(el.textContent);
      if (text === '导出当前结果') {
        el.textContent = '导出已选 / 当前页';
        el.title = '有勾选时只导出勾选客户；没有勾选时只导出当前页。不会扫描整个客户库。';
      }
    }
  }

  document.addEventListener('click', event => {
    const target = event.target?.closest?.('button,a');
    if (!target) return;
    const text = cleanText(target.textContent);
    if (text !== '导出当前结果' && text !== '导出已选 / 当前页') return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    exportVisibleLeads();
  }, true);

  const observer = new MutationObserver(relabelExportButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  relabelExportButton();
})();
