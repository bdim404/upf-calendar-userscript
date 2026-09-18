// ==UserScript==
// @name         UPF Calendar Exporter
// @namespace    https://github.com/bdim404/upf-calendar-exporter
// @version      1.0.0
// @description  Export your UPF timetable to a Google Calendar CSV in one click
// @author       bdim404
// @match        https://secretariavirtual.upf.edu/pds/control/PubliHoraAlumCalendario*
// @license      MIT
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const AJAX = '/pds/control/[Ajax]selecionarRangoHorarios?rnd=8298.0&start=__S__&end=__E__';
  const HEADERS = ['Subject', 'Start Date', 'Start Time', 'End Date', 'End Time',
                   'All Day Event', 'Description', 'Location', 'Private'];

  const epoch = s => Math.floor(new Date(s + 'T00:00:00').getTime() / 1000);
  const pad = n => String(n).padStart(2, '0');
  const parse = s => new Date(s.replace(' ', 'T'));
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;

  function fmtDate(d) {
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
  }

  function fmtTime(d) {
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${pad(h)}:${pad(d.getMinutes())} ${ampm}`;
  }

  async function fetchSessions(start, end) {
    const url = AJAX.replace('__S__', epoch(start)).replace('__E__', epoch(end));
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Session expired. Reload the page and try again.');
    }
  }

  function toRows(sessions, exclude, keepHolidays) {
    const rows = [HEADERS];

    for (const s of sessions) {
      if (!s.title || !s.start || !s.end) continue;
      if (!keepHolidays && s.festivoNoLectivo === true) continue;

      const title = s.title.toLowerCase();
      if (exclude.some(p => title.includes(p))) continue;

      const start = parse(s.start);
      const end = parse(s.end);
      const full = s.tipologia ? `${s.title} [${s.tipologia}]` : s.title;
      const desc = [full, '', s.grup, (s.profesores || []).join(', '), s.codAsignatura]
        .filter(x => x !== undefined && String(x).trim() !== '')
        .join('\n');

      rows.push([full, fmtDate(start), fmtTime(start), fmtDate(end), fmtTime(end),
                 'False', desc, s.aula || 'unknown', 'True']);
    }

    return rows;
  }

  function download(rows) {
    const csv = rows.map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'upf_calendar.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function ui() {
    const now = new Date();
    const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;

    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;background:#fff;' +
      'border:1px solid #ccc;border-radius:6px;padding:12px;width:215px;' +
      'font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#222;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.18)';

    const field = 'width:100%;box-sizing:border-box;padding:3px;margin-top:2px';
    box.innerHTML = `
      <div style="font-weight:600;margin-bottom:8px">Export calendar</div>
      <label>From<input id="ce-a" type="date" value="${year}-09-01" style="${field}"></label>
      <label style="display:block;margin-top:6px">To
        <input id="ce-b" type="date" value="${year + 1}-07-31" style="${field}"></label>
      <label style="display:block;margin-top:6px">Exclude subjects
        <input id="ce-x" type="text" placeholder="e.g. Master Thesis" style="${field}"></label>
      <label style="display:block;margin-top:8px;font-size:12px">
        <input id="ce-h" type="checkbox"> Include holidays</label>
      <button id="ce-go" style="margin-top:10px;width:100%;padding:6px;cursor:pointer;
        border:1px solid #888;border-radius:4px;background:#f5f5f5">Download CSV</button>
      <div id="ce-msg" style="margin-top:7px;font-size:12px;color:#666;min-height:15px"></div>`;

    document.body.appendChild(box);

    const msg = box.querySelector('#ce-msg');
    const btn = box.querySelector('#ce-go');

    btn.onclick = async () => {
      btn.disabled = true;
      msg.style.color = '#666';
      msg.textContent = 'Fetching...';

      try {
        const from = box.querySelector('#ce-a').value;
        const to = box.querySelector('#ce-b').value;
        if (!from || !to) throw new Error('Pick both dates.');
        if (epoch(to) <= epoch(from)) throw new Error('"To" must be after "From".');

        const exclude = box.querySelector('#ce-x').value.split(',')
          .map(s => s.trim().toLowerCase()).filter(Boolean);

        const data = await fetchSessions(from, to);
        const rows = toRows(data, exclude, box.querySelector('#ce-h').checked);

        if (rows.length < 2) {
          msg.textContent = 'No events in that range.';
          return;
        }

        download(rows);
        msg.style.color = '#0a0';
        msg.textContent = `${rows.length - 1} events exported.`;
      } catch (e) {
        msg.style.color = '#c00';
        msg.textContent = e.message;
      } finally {
        btn.disabled = false;
      }
    };
  }

  ui();
})();
