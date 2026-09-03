(() => {
  if (window.__rpFriendlyCloudflareErrors) return;
  window.__rpFriendlyCloudflareErrors = true;

  const originalAlert = window.alert.bind(window);

  function friendlyCloudflareMessage(value) {
    const text = String(value ?? '');
    const lower = text.toLowerCase();
    const looksHtml = lower.includes('<!doctype html') || lower.includes('<html') || lower.includes('<head>');
    const looksCloudflare = lower.includes('cloudflare') || lower.includes('durable object') || lower.includes('rows_written') || lower.includes('service requests are temporarily blocked');
    const looksQuota = lower.includes('rows_written') || lower.includes('durable object') || lower.includes('100000') || lower.includes('temporarily blocked');

    if (looksHtml && (looksCloudflare || text.includes('无法连接 CRM 服务器'))) {
      if (looksQuota) {
        return 'Cloudflare 今日数据库写入额度已用完。现有数据安全，写入功能将在额度重置后恢复。\n\n当前仍可能可以查看已有数据；请暂时不要继续批量迁移或大量写入。';
      }
      return 'Cloudflare 暂时拒绝了这次 CRM 请求。现有数据不会因此丢失。请稍后刷新再试；如果今天已经收到 Durable Objects 配额提醒，请等额度重置后再继续写入。';
    }

    if (looksQuota && looksCloudflare) {
      return 'Cloudflare 今日数据库写入额度已用完。现有数据安全，写入功能将在额度重置后恢复。';
    }
    return null;
  }

  window.__rpFormatCloudflareError = function (value) {
    return friendlyCloudflareMessage(value) || String(value ?? '未知错误');
  };

  window.alert = function (message) {
    const friendly = friendlyCloudflareMessage(message);
    return originalAlert(friendly || message);
  };
})();

(() => {
  if (window.__rpOneClickMigration) return;
  window.__rpOneClickMigration = true;
  const previousRenderAdmin = typeof renderAdmin === 'function' ? renderAdmin : null;
  if (!previousRenderAdmin) return;

  async function postMigration(path, body) {
    return api(path, { method: 'POST', body });
  }

  async function runMigrationPack(file) {
    const pack = JSON.parse(await file.text());
    if (pack.format !== 'raiseproxy-cloud-migration-v1') throw new Error('这不是 Raiseproxy 云端迁移整包');
    const leads = Array.isArray(pack.leads) ? pack.leads : [];
    const users = Array.isArray(pack.users) ? pack.users : [];
    const claims = Array.isArray(pack.claims) ? pack.claims : [];
    const tracking = Array.isArray(pack.tracking) ? pack.tracking : [];

    await postMigration('/api/admin/import_begin', { mode: 'replace' });
    let added = 0, skipped = 0;
    for (let i = 0; i < leads.length; i += 500) {
      const items = leads.slice(i, i + 500);
      $('loadingText').textContent = `迁移客户 ${Math.min(i + items.length, leads.length).toLocaleString()} / ${leads.length.toLocaleString()}…`;
      const d = await postMigration('/api/admin/import_chunk', { items });
      added += d.added || 0; skipped += d.skipped || 0;
    }

    $('loadingText').textContent = '迁移团队账号…';
    const ud = await postMigration('/api/admin/legacy_users', { users });

    let claimImported = 0;
    for (let i = 0; i < claims.length; i += 500) {
      const items = claims.slice(i, i + 500);
      $('loadingText').textContent = `迁移客户归属 ${Math.min(i + items.length, claims.length)} / ${claims.length}…`;
      const d = await postMigration('/api/admin/legacy_claims', { items });
      claimImported += d.imported || 0;
    }

    let trackImported = 0;
    const expectedTracking = Number(pack.counts?.tracking_latest || 0);
    for (const group of tracking) {
      const arr = Array.isArray(group.items) ? group.items : [];
      for (let i = 0; i < arr.length; i += 200) {
        const items = arr.slice(i, i + 200);
        $('loadingText').textContent = `迁移跟进状态 ${Math.min(trackImported + items.length, expectedTracking || 999999)} / ${expectedTracking || '…'}…`;
        const d = await postMigration('/api/admin/legacy_tracking', { legacy_user_id: group.legacy_user_id, items });
        trackImported += d.imported || 0;
      }
    }
    return { added, skipped, users: ud.imported || 0, claims: claimImported, tracking: trackImported, total: leads.length };
  }

  renderAdmin = async function () {
    await previousRenderAdmin();
    if (state.adminTab !== 'data') return;
    const body = $('adminBody');
    if (!body || $('legacyMigrationPack')) return;
    const notice = document.createElement('div');
    notice.innerHTML = `
      <div class="sep"></div>
      <div class="notice"><b>⚡ 一键迁移旧 CRM</b><br>把旧版客户库、团队账号、客户归属和跟进状态一次性搬到公网版。迁移会替换当前云端客户库。</div>
      <div class="actions">
        <label class="btn primary" style="cursor:pointer">选择迁移整包
          <input id="legacyMigrationPack" type="file" accept=".json,application/json" class="hidden">
        </label>
      </div>
      <div id="oneClickMigrationStatus" class="small-note">迁移包不会上传到 GitHub，只会从你的浏览器分批写入当前 Cloudflare CRM 数据库。</div>`;
    body.appendChild(notice);
    $('legacyMigrationPack').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      if (!confirm('将用这个整包替换当前云端客户库，并迁移旧账号、归属和跟进记录。确定继续？')) return;
      try {
        loading(true, '正在读取迁移整包…');
        const d = await runMigrationPack(f);
        $('oneClickMigrationStatus').textContent = `迁移完成：客户 ${d.added}/${d.total}，账号 ${d.users}，归属 ${d.claims}，跟进状态 ${d.tracking}。`;
        toast('旧 CRM 已完整迁移');
        state.category = ''; state.domain = ''; state.page = 1;
        const b = await api('/api/bootstrap'); state.bootstrap = b;
        await Promise.all([loadSummary(), loadCategories()]);
        await loadDomains(); await loadLeads();
      } catch (err) {
        const msg = window.__rpFormatCloudflareError ? window.__rpFormatCloudflareError(err?.message || err) : (err?.message || String(err));
        toast(msg);
      }
      finally { loading(false); }
    };
  };
})();
