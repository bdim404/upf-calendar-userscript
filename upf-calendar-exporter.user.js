// ==UserScript==
// @name         UPF Calendar Exporter
// @namespace    https://github.com/bdim404/upf-calendar-exporter
// @version      1.1.0
// @description  Export your UPF timetable to an .ics or Google Calendar .csv file in one click
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

  function toIcs(sessions, exclude, keepHolidays) {
    const stamp = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
    const fold = s => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//upf-calendar-exporter//EN',
                   'CALSCALE:GREGORIAN'];
    let n = 0;

    for (const s of sessions) {
      if (!s.title || !s.start || !s.end) continue;
      if (!keepHolidays && s.festivoNoLectivo === true) continue;

      const title = s.title.toLowerCase();
      if (exclude.some(p => title.includes(p))) continue;

      const start = parse(s.start);
      const end = parse(s.end);
      const full = s.tipologia ? `${s.title} [${s.tipologia}]` : s.title;
      const desc = [s.grup, (s.profesores || []).join(', '), s.codAsignatura]
        .filter(x => x !== undefined && String(x).trim() !== '')
        .join(' · ');

      lines.push('BEGIN:VEVENT',
                 `UID:${start.getTime()}-${n++}@upf-calendar-exporter`,
                 `DTSTART;TZID=Europe/Madrid:${stamp(start)}`,
                 `DTEND;TZID=Europe/Madrid:${stamp(end)}`,
                 `SUMMARY:${fold(full)}`);
      if (s.aula) lines.push(`LOCATION:${fold(s.aula)}`);
      if (desc) lines.push(`DESCRIPTION:${fold(desc)}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return n ? lines.join('\r\n') : null;
  }

  function save(content, name, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadCsv(rows) {
    const csv = rows.map(r => r.map(esc).join(',')).join('\n');
    save('﻿' + csv, 'upf_calendar.csv', 'text/csv;charset=utf-8');
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
    const btnCss = 'flex:1;padding:6px;cursor:pointer;border:1px solid #888;' +
      'border-radius:4px;background:#f5f5f5;font:inherit';
    box.innerHTML = `
      <div style="font-weight:600;margin-bottom:8px">Export calendar</div>
      <label>From<input id="ce-a" type="date" value="${year}-09-01" style="${field}"></label>
      <label style="display:block;margin-top:6px">To
        <input id="ce-b" type="date" value="${year + 1}-07-31" style="${field}"></label>
      <label style="display:block;margin-top:6px">Exclude subjects
        <input id="ce-x" type="text" placeholder="e.g. Master Thesis" style="${field}"></label>
      <label style="display:block;margin-top:8px;font-size:12px">
        <input id="ce-h" type="checkbox"> Include holidays</label>
      <div style="display:flex;gap:6px;margin-top:10px">
        <button id="ce-ics" style="${btnCss}">.ics</button>
        <button id="ce-csv" style="${btnCss}">.csv</button>
      </div>
      <div style="margin-top:5px;font-size:11px;color:#888">
        .ics for Apple Calendar · .csv for Google</div>
      <div id="ce-msg" style="margin-top:6px;font-size:12px;color:#666;min-height:15px"></div>`;

    document.body.appendChild(box);

    const msg = box.querySelector('#ce-msg');
    const buttons = [box.querySelector('#ce-ics'), box.querySelector('#ce-csv')];

    async function run(format) {
      buttons.forEach(b => b.disabled = true);
      msg.style.color = '#666';
      msg.textContent = 'Fetching...';

      try {
        const from = box.querySelector('#ce-a').value;
        const to = box.querySelector('#ce-b').value;
        if (!from || !to) throw new Error('Pick both dates.');
        if (epoch(to) <= epoch(from)) throw new Error('"To" must be after "From".');

        const exclude = box.querySelector('#ce-x').value.split(',')
          .map(s => s.trim().toLowerCase()).filter(Boolean);
        const holidays = box.querySelector('#ce-h').checked;

        const data = await fetchSessions(from, to);
        let count;

        if (format === 'ics') {
          const ics = toIcs(data, exclude, holidays);
          if (!ics) { msg.textContent = 'No events in that range.'; return; }
          count = (ics.match(/BEGIN:VEVENT/g) || []).length;
          save(ics, 'upf_calendar.ics', 'text/calendar;charset=utf-8');
        } else {
          const rows = toRows(data, exclude, holidays);
          if (rows.length < 2) { msg.textContent = 'No events in that range.'; return; }
          count = rows.length - 1;
          downloadCsv(rows);
        }

        msg.style.color = '#0a0';
        msg.textContent = `${count} events exported.`;
      } catch (e) {
        msg.style.color = '#c00';
        msg.textContent = e.message;
      } finally {
        buttons.forEach(b => b.disabled = false);
      }
    }

    box.querySelector('#ce-ics').onclick = () => run('ics');
    box.querySelector('#ce-csv').onclick = () => run('csv');
  }

  ui();
})();
