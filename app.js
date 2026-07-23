(() => {
  "use strict";

  const seed = window.MILHANO_SEED || { dataset: {}, dailyHistory: [] };
  const MANUAL_KEY = "milhano-eod-demo";
  const app = document.getElementById("view-container");
  const pageTitle = document.getElementById("page-title");
  const periodSelect = document.getElementById("period-select");
  const toast = document.getElementById("toast");

  const state = {
    currentView: "summary",
    period: "30",
    manualEntries: [],
    followupTab: "all",
    followupSearch: "",
    followupOwner: "all",
    followupStatus: "all",
  };

  const fieldLabels = {
    paidLeads: "Leads de Ads",
    organicLeads: "Leads orgánicos",
    contactWhatsApp: "Contactados por WhatsApp",
    calls: "Llamadas",
    responses: "Respuestas",
    qualified: "Qualified",
    noQualified: "No Qualified",
    tourBooked: "Tours agendados",
    tourAttended: "Tours atendidos",
    passDayBooked: "Pasadías agendadas",
    passDayAttended: "Pasadías atendidas",
    feedbacks: "Retroalimentaciones",
    enrolled: "Inscritos",
    pendingEnd: "Pendientes al cierre",
    weekendBacklogStart: "Backlog al iniciar",
  };

  const pageTitles = {
    summary: "Resumen de admisiones",
    followup: "Seguimiento operativo",
    funnel: "Embudo y conversiones",
    acquisition: "Adquisición y calidad",
    eod: "Captura EOD",
  };

  function n(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function uid() {
    return `eod-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value);

    if (typeof value === "number" || /^\d{5}(?:\.\d+)?$/.test(String(value))) {
      const serial = Number(value);
      if (serial > 20000 && serial < 80000) {
        const excelEpoch = new Date(1899, 11, 30);
        excelEpoch.setDate(excelEpoch.getDate() + Math.floor(serial));
        return excelEpoch;
      }
    }

    const text = String(value).trim();
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

    const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) return new Date(Number(slash[3]), Number(slash[1]) - 1, Number(slash[2]));

    const fallback = new Date(text);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  function isoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatDate(value, options = {}) {
    const date = parseDate(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: options.short ? "short" : "2-digit",
      year: options.year === false ? undefined : "numeric",
    }).format(date);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("es-MX").format(n(value));
  }

  function pct(num, den, digits = 1) {
    if (!den) return 0;
    return Number(((num / den) * 100).toFixed(digits));
  }

  function sum(entries, field) {
    return entries.reduce((total, entry) => total + n(entry[field]), 0);
  }

  function totalLeads(entry) {
    return n(entry.paidLeads) + n(entry.organicLeads);
  }

  function maxEntryDate(entries) {
    const dates = entries.map((e) => parseDate(e.date)).filter(Boolean);
    if (!dates.length) return new Date();
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }

  function allEntries() {
    // A manual EOD replaces the aggregate histórico de la misma fecha para evitar doble conteo.
    const manualDates = new Set(state.manualEntries.map((entry) => entry.date));
    const historical = (seed.dailyHistory || []).filter((entry) => !manualDates.has(entry.date));
    return [...historical, ...state.manualEntries].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function periodWindow(days, entries = allEntries()) {
    const end = maxEntryDate(entries);
    if (days === "all") return { start: null, end };
    const start = new Date(end);
    start.setDate(start.getDate() - Number(days) + 1);
    return { start, end };
  }

  function entriesForPeriod(days = state.period) {
    const entries = allEntries();
    if (days === "all") return entries;
    const { start, end } = periodWindow(days, entries);
    return entries.filter((entry) => {
      const date = parseDate(entry.date);
      return date && date >= start && date <= end;
    });
  }

  function previousEntriesForPeriod(days = state.period) {
    if (days === "all") return [];
    const entries = allEntries();
    const { start } = periodWindow(days, entries);
    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - Number(days) + 1);
    return entries.filter((entry) => {
      const date = parseDate(entry.date);
      return date && date >= previousStart && date <= previousEnd;
    });
  }

  function periodRangeText(days = state.period) {
    const entries = allEntries();
    const { start, end } = periodWindow(days, entries);
    if (!end) return "Sin datos";
    if (days === "all" || !start) return `${formatDate(entries[0]?.date, { short: true })} – ${formatDate(end, { short: true })}`;
    return `${formatDate(start, { short: true })} – ${formatDate(end, { short: true })}`;
  }

  function daysSince(value, reference = maxEntryDate(allEntries())) {
    const date = parseDate(value);
    if (!date || !reference) return null;
    return Math.max(0, Math.floor((reference.getTime() - date.getTime()) / 86400000));
  }

  function aggregate(entries) {
    return {
      leads: entries.reduce((t, e) => t + totalLeads(e), 0),
      organicLeads: sum(entries, "organicLeads"),
      contacts: sum(entries, "contactWhatsApp") + sum(entries, "calls"),
      whatsapp: sum(entries, "contactWhatsApp"),
      calls: sum(entries, "calls"),
      responses: sum(entries, "responses"),
      qualified: sum(entries, "qualified"),
      noQualified: sum(entries, "noQualified"),
      tourBooked: sum(entries, "tourBooked"),
      tourAttended: sum(entries, "tourAttended"),
      passDayBooked: sum(entries, "passDayBooked"),
      passDayAttended: sum(entries, "passDayAttended"),
      feedbacks: sum(entries, "feedbacks"),
      enrolled: sum(entries, "enrolled"),
      pendingEnd: sum(entries, "pendingEnd"),
    };
  }

  function delta(current, previous) {
    if (!previous) return current ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  function latestWeekend(entries = allEntries()) {
    const maxDate = maxEntryDate(entries);
    const day = maxDate.getDay();
    const saturday = new Date(maxDate);
    const back = day === 6 ? 0 : day === 0 ? 1 : day + 1;
    saturday.setDate(maxDate.getDate() - back);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    const saturdayIso = isoDate(saturday);
    const sundayIso = isoDate(sunday);
    const weekendEntries = entries.filter((e) => e.date === saturdayIso || e.date === sundayIso);
    const received = weekendEntries.reduce((t, e) => t + totalLeads(e), 0);
    const handled = weekendEntries.reduce((t, e) => t + n(e.responses), 0);
    const monday = new Date(sunday);
    monday.setDate(sunday.getDate() + 1);
    const mondayEntries = entries.filter((e) => e.date === isoDate(monday));
    const explicitBacklog = mondayEntries.reduce((t, e) => t + n(e.weekendBacklogStart), 0);
    return {
      saturday: saturdayIso,
      sunday: sundayIso,
      monday: isoDate(monday),
      received,
      pending: explicitBacklog || Math.max(received - handled, 0),
    };
  }

  function showToast(message, type = "success") {
    toast.textContent = message;
    toast.className = `toast show${type === "error" ? " error" : ""}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.className = "toast";
    }, 3200);
  }

  function loadLocalEntries() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MANUAL_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveLocalEntries() {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(state.manualEntries));
  }

  async function persistEntry(entry) {
    const existingIndex = state.manualEntries.findIndex((e) => e.id === entry.id);
    if (existingIndex >= 0) state.manualEntries[existingIndex] = entry;
    else state.manualEntries.push(entry);
    saveLocalEntries();
    return true;
  }

  async function deleteEntry(id) {
    state.manualEntries = state.manualEntries.filter((e) => e.id !== id);
    saveLocalEntries();
    renderCurrentView();
    showToast("Registro eliminado.");
  }

  function metricCard(label, value, current, previous, icon, tone = "") {
    const d = delta(current, previous);
    const sign = d > 0 ? "+" : "";
    const comparison = previous === undefined || state.period === "all"
      ? "Histórico cargado"
      : `<span class="delta ${d >= 0 ? "positive" : "negative"}">${sign}${d.toFixed(0)}%</span> vs periodo anterior`;
    return `
      <article class="kpi-card ${tone}">
        <div class="kpi-label"><span>${esc(label)}</span><span class="kpi-icon">${icon}</span></div>
        <div class="kpi-value">${formatNumber(value)}</div>
        <div class="kpi-meta">${comparison}</div>
      </article>`;
  }

  function lineChart(entries) {
    const grouped = new Map();
    entries.forEach((entry) => {
      if (!grouped.has(entry.date)) grouped.set(entry.date, { date: entry.date, leads: 0, tours: 0, enrolled: 0 });
      const row = grouped.get(entry.date);
      row.leads += totalLeads(entry);
      row.tours += n(entry.tourAttended);
      row.enrolled += n(entry.enrolled);
    });
    const points = [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (!points.length) return `<div class="empty-state"><strong>Sin datos para graficar</strong>Captura un EOD para comenzar.</div>`;

    const width = 760;
    const height = 250;
    const pad = { left: 34, right: 12, top: 14, bottom: 30 };
    const maxValue = Math.max(1, ...points.flatMap((p) => [p.leads, p.tours, p.enrolled]));
    const x = (i) => pad.left + (i * (width - pad.left - pad.right)) / Math.max(points.length - 1, 1);
    const y = (v) => height - pad.bottom - (v / maxValue) * (height - pad.top - pad.bottom);

    const pathFor = (field) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[field]).toFixed(1)}`).join(" ");
    const areaPath = `${pathFor("leads")} L${x(points.length - 1)},${height - pad.bottom} L${x(0)},${height - pad.bottom} Z`;
    const yTicks = [0, .25, .5, .75, 1].map((q) => Math.round(maxValue * q));
    const xTickEvery = Math.max(1, Math.ceil(points.length / 6));

    return `
      <svg class="line-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Tendencia de leads, tours e inscritos">
        <defs>
          <linearGradient id="leadArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#0b6b55" stop-opacity=".5" />
            <stop offset="100%" stop-color="#0b6b55" stop-opacity="0" />
          </linearGradient>
        </defs>
        ${yTicks.map((tick) => `<line class="chart-grid-line" x1="${pad.left}" y1="${y(tick)}" x2="${width - pad.right}" y2="${y(tick)}"/><text class="chart-axis-label" x="2" y="${y(tick) + 3}">${tick}</text>`).join("")}
        <path d="${areaPath}" fill="url(#leadArea)" />
        <path class="chart-line" d="${pathFor("leads")}" stroke="#0b6b55" />
        <path class="chart-line" d="${pathFor("tours")}" stroke="#d5a93e" />
        <path class="chart-line" d="${pathFor("enrolled")}" stroke="#3e6e9d" />
        ${points.map((p, i) => i % xTickEvery === 0 || i === points.length - 1 ? `<text class="chart-axis-label" x="${x(i)}" y="${height - 7}" text-anchor="middle">${formatDate(p.date, { short: true, year: false })}</text>` : "").join("")}
      </svg>`;
  }

  function renderSummary() {
    const currentEntries = entriesForPeriod();
    const previousEntries = previousEntriesForPeriod();
    const current = aggregate(currentEntries);
    const previous = aggregate(previousEntries);
    const weekend = latestWeekend();
    const active = seed.dataset.activeLeads || [];
    const countStatus = (status) => active.filter((lead) => lead.status === status).length;
    const funnelStages = [
      ["Leads", current.leads],
      ["Respondieron", current.responses],
      ["Qualified", current.qualified],
      ["Tour atendido", current.tourAttended],
      ["Pasadía", current.passDayAttended],
      ["Inscritos", current.enrolled],
    ];

    app.innerHTML = `
      <section class="view-header">
        <div>
          <h2>Panorama del pipeline</h2>
          <p>Una lectura rápida de volumen, atención y avance desde WhatsApp hasta inscripción.</p><span class="period-chip">${periodRangeText()}</span>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary" data-view-link="followup">Abrir seguimiento</button>
          <button class="btn btn-primary" data-view-link="eod">+ Capturar EOD</button>
        </div>
      </section>

      <section class="kpi-grid">
        ${metricCard("Leads recibidos", current.leads, current.leads, previous.leads, "↘")}
        ${metricCard("Respuestas", current.responses, current.responses, previous.responses, "↩")}
        ${metricCard("Qualified", current.qualified, current.qualified, previous.qualified, "✓")}
        ${metricCard("Tours atendidos", current.tourAttended, current.tourAttended, previous.tourAttended, "⌂")}
        ${metricCard("Inscritos", current.enrolled, current.enrolled, previous.enrolled, "★")}
        ${metricCard("Backlog fin de semana", weekend.pending, weekend.pending, undefined, "◷", weekend.pending ? "warning" : "")}
      </section>

      <section class="dashboard-grid">
        <article class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Actividad diaria</h3>
              <p class="card-subtitle">Leads recibidos, tours atendidos e inscritos.</p>
            </div>
            <div class="chart-legend">
              <span class="legend-item"><i class="legend-dot leads"></i>Leads</span>
              <span class="legend-item"><i class="legend-dot tours"></i>Tours</span>
              <span class="legend-item"><i class="legend-dot enrolled"></i>Inscritos</span>
            </div>
          </div>
          ${lineChart(currentEntries)}
        </article>

        <article class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Atención requerida</h3>
              <p class="card-subtitle">Cola operativa según el estatus actual.</p>
            </div>
            <button class="card-action" data-view-link="followup">Abrir cola →</button>
          </div>
          <div class="action-list">
            ${[
              ["!", "Leads nuevos", "Esperan preguntas de calificación", countStatus("Lead Nuevo")],
              ["☎", "Seguimiento 5 intentos", "Llamada + WhatsApp pendiente", countStatus("Contactado")],
              ["✓", "Qualified sin tour", "Siguiente paso: School Tour", countStatus("Qualified")],
              ["⌂", "Tours por confirmar", "Confirmar o reagendar", countStatus("Tour Agendado")],
              ["→", "Post-tour / pasadía", "Avanzar la experiencia", countStatus("Tour Realizado") + countStatus("Pasadía Agendado")],
            ].map(([icon, title, subtitle, count]) => `
              <div class="action-row">
                <span class="action-icon">${icon}</span>
                <div><strong>${title}</strong><small>${subtitle}</small></div>
                <span class="action-count">${count}</span>
              </div>`).join("")}
          </div>
        </article>
      </section>

      <section class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Embudo del periodo</h3>
            <p class="card-subtitle">Actividad registrada entre ${periodRangeText()}.</p>
          </div>
          <button class="card-action" data-view-link="funnel">Analizar conversiones →</button>
        </div>
        <div class="funnel-strip">
          ${funnelStages.map(([label, value], index) => {
            const previousValue = index ? funnelStages[index - 1][1] : value;
            return `<div class="funnel-node"><strong>${formatNumber(value)}</strong><span>${label}</span><em>${index ? pct(value, previousValue) : 100}%</em></div>`;
          }).join("")}
        </div>
      </section>`;
  }

  const followupTabs = [
    ["all", "Todos"],
    ["new", "Sin contactar"],
    ["contact", "5 intentos"],
    ["qualified", "Qualified"],
    ["tour", "Tours"],
    ["post", "Post-tour"],
    ["passday", "Pasadía"],
  ];

  function leadMatchesTab(lead, tab) {
    if (tab === "all") return true;
    if (tab === "new") return lead.status === "Lead Nuevo";
    if (tab === "contact") return lead.status === "Contactado";
    if (tab === "qualified") return lead.status === "Qualified";
    if (tab === "tour") return lead.status === "Tour Agendado";
    if (tab === "post") return lead.status === "Tour Realizado" || lead.status === "En Proceso";
    if (tab === "passday") return lead.status === "Pasadía Agendado" || lead.status === "Pasadía Realizado";
    return true;
  }

  function statusBadge(status) {
    const cls = {
      "Lead Nuevo": "badge-red",
      Contactado: "badge-yellow",
      Qualified: "badge-green",
      "Tour Agendado": "badge-blue",
      "Tour Realizado": "badge-green",
      "Pasadía Agendado": "badge-blue",
      "Pasadía Realizado": "badge-green",
      "En Proceso": "badge-yellow",
    }[status] || "badge-gray";
    return `<span class="badge ${cls}">${esc(status)}</span>`;
  }

  function renderFollowup() {
    const leads = seed.dataset.activeLeads || [];
    const owners = [...new Set(leads.map((l) => l.owner))].sort();
    const statuses = [...new Set(leads.map((l) => l.status))].sort();
    const search = state.followupSearch.trim().toLowerCase();
    const filtered = leads.filter((lead) => {
      const matchesTab = leadMatchesTab(lead, state.followupTab);
      const matchesOwner = state.followupOwner === "all" || lead.owner === state.followupOwner;
      const matchesStatus = state.followupStatus === "all" || lead.status === state.followupStatus;
      const haystack = `${lead.id} ${lead.family} ${lead.student} ${lead.level} ${lead.grade} ${lead.source}`.toLowerCase();
      return matchesTab && matchesOwner && matchesStatus && (!search || haystack.includes(search));
    });

    app.innerHTML = `
      <section class="view-header">
        <div>
          <h2>¿A quién hay que contactar ahora?</h2>
          <p>Cola priorizada por etapa, tiempo sin interacción y siguiente acción disponible.</p>
        </div>
        <button class="btn btn-primary" data-view-link="eod">Registrar actividad EOD</button>
      </section>

      <div class="tabs">
        ${followupTabs.map(([key, label]) => {
          const count = leads.filter((lead) => leadMatchesTab(lead, key)).length;
          return `<button class="tab ${state.followupTab === key ? "active" : ""}" data-followup-tab="${key}">${label}<span class="count">${count}</span></button>`;
        }).join("")}
      </div>

      <div class="filters-bar">
        <div class="search-box"><input id="followup-search" type="search" placeholder="Buscar ID, alumno, grado o fuente…" value="${esc(state.followupSearch)}"></div>
        <select id="followup-owner" class="filter-select">
          <option value="all">Todos los responsables</option>
          ${owners.map((owner) => `<option ${state.followupOwner === owner ? "selected" : ""}>${esc(owner)}</option>`).join("")}
        </select>
        <select id="followup-status" class="filter-select">
          <option value="all">Todos los estatus</option>
          ${statuses.map((status) => `<option ${state.followupStatus === status ? "selected" : ""}>${esc(status)}</option>`).join("")}
        </select>
      </div>

      <div class="table-card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Lead</th><th>Estatus</th><th>Responsable</th><th>Intentos</th><th>Última interacción</th><th>Tiempo</th><th>Siguiente acción</th><th></th></tr></thead>
            <tbody>
              ${filtered.length ? filtered.map((lead) => {
                const inactiveDays = daysSince(lead.lastInteraction);
                const urgency = inactiveDays === null || inactiveDays >= 3 ? "high" : "medium";
                return `
                <tr>
                  <td><div class="table-title"><span class="table-avatar">${esc(String(lead.id).slice(-2))}</span><div><strong>${esc(lead.family)} · ${esc(lead.id)}</strong><small>${esc(lead.grade)} · ${esc(lead.source)}</small></div></div></td>
                  <td>${statusBadge(lead.status)}</td>
                  <td>${esc(lead.owner)}</td>
                  <td>${lead.status === "Contactado" ? `${lead.calls}/5` : "—"}</td>
                  <td>${formatDate(lead.lastInteraction)}</td>
                  <td><span class="priority-dot ${urgency}"></span>${inactiveDays === null ? "Sin fecha" : `${inactiveDays} días`}</td>
                  <td><strong>${esc(lead.nextAction)}</strong></td>
                  <td><button class="btn btn-secondary btn-small" data-lead-action="${esc(lead.id)}">Registrar</button></td>
                </tr>`;
              }).join("") : `<tr><td colspan="8"><div class="empty-state"><strong>No hay resultados</strong>Ajusta los filtros o la búsqueda.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;

    document.getElementById("followup-search")?.addEventListener("input", (e) => {
      state.followupSearch = e.target.value;
      renderFollowup();
      requestAnimationFrame(() => {
        const input = document.getElementById("followup-search");
        input?.focus();
        input?.setSelectionRange(input.value.length, input.value.length);
      });
    });
    document.getElementById("followup-owner")?.addEventListener("change", (e) => { state.followupOwner = e.target.value; renderFollowup(); });
    document.getElementById("followup-status")?.addEventListener("change", (e) => { state.followupStatus = e.target.value; renderFollowup(); });
  }

  function renderFunnel() {
    const f = seed.dataset.funnel || {};
    const stages = [
      ["Leads", f.Leads],
      ["Contactados", f.Contactados],
      ["Respondieron", f.Respondieron],
      ["Qualified", f.Qualified],
      ["Tour agendado", f["Tour agendado"]],
      ["Tour atendido", f["Tour atendido"]],
      ["Pasadía agendada", f["Pasadía agendada"]],
      ["Pasadía atendida", f["Pasadía atendida"]],
      ["Retroalimentación", f.Retroalimentación],
      ["Inscritos", f.Inscritos],
    ].map(([label, value]) => [label, n(value)]);
    const max = stages[0][1] || 1;
    const losses = stages.slice(1).map((stage, i) => ({
      from: stages[i][0],
      to: stage[0],
      previous: stages[i][1],
      current: stage[1],
      lost: Math.max(stages[i][1] - stage[1], 0),
      rate: pct(stage[1], stages[i][1]),
    })).sort((a, b) => b.lost - a.lost);
    const missing = seed.dataset.missingCounts || {};

    app.innerHTML = `
      <section class="view-header">
        <div>
          <h2>Embudo acumulado de admisiones</h2>
          <p>Conversión por milestone registrado. Esta lectura evita depender únicamente del estatus final del lead.</p>
        </div>
        <button class="btn btn-secondary" data-view-link="followup">Abrir seguimiento</button>
      </section>

      <section class="funnel-page-grid">
        <article class="card">
          <div class="card-header"><div><h3 class="card-title">Conversión por etapa</h3><p class="card-subtitle">De entrada por WhatsApp a inscripción.</p></div></div>
          <div class="vertical-funnel">
            ${stages.map(([label, value], index) => `
              <div class="vertical-stage">
                <div class="stage-bar-wrap"><div class="stage-bar" style="width:${Math.max((value / max) * 100, 5)}%">${label}</div></div>
                <div class="stage-value">${formatNumber(value)}</div>
                <div class="stage-rate">${index ? pct(value, stages[index - 1][1]) : 100}%</div>
              </div>`).join("")}
          </div>
        </article>

        <div>
          <article class="card" style="margin-bottom:18px">
            <div class="card-header"><div><h3 class="card-title">Mayores fugas</h3><p class="card-subtitle">Transiciones con más leads que no avanzaron.</p></div></div>
            <div class="metric-list">
              ${losses.slice(0, 6).map((row) => `<div class="metric-row"><div><strong>${row.from} → ${row.to}</strong><small>${row.rate}% de conversión</small></div><span class="metric-number">-${formatNumber(row.lost)}</span></div>`).join("")}
            </div>
          </article>

          <article class="card">
            <div class="card-header"><div><h3 class="card-title">Calidad de datos</h3><p class="card-subtitle">Campos que necesitan completarse para obtener métricas más confiables.</p></div></div>
            <div class="progress-list">
              ${Object.entries(missing).map(([label, value]) => `
                <div><div class="progress-row-header"><span>${esc(label)}</span><strong>${formatNumber(value)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${pct(value, seed.dataset.totalLeads)}%"></div></div></div>`).join("")}
            </div>
          </article>
        </div>
      </section>`;
  }

  function renderAcquisition() {
    const sources = [...(seed.dataset.sources || [])].sort((a, b) => b.leads - a.leads);
    const reasons = seed.dataset.lostReasons || [];
    const maxReason = Math.max(1, ...reasons.map((r) => r.count));
    app.innerHTML = `
      <section class="view-header">
        <div>
          <h2>¿Qué fuentes generan familias que avanzan?</h2>
          <p>Volumen y calidad por fuente. La conversión se calcula contra inscripciones registradas.</p>
        </div>
      </section>

      <section class="source-grid">
        <article class="table-card">
          <div class="card-header" style="padding:20px 20px 0"><div><h3 class="card-title">Rendimiento por fuente</h3><p class="card-subtitle">Datos acumulados del Excel actual.</p></div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Fuente</th><th>Leads</th><th>Qualified</th><th>Tour atendido</th><th>Inscritos</th><th>Lead → inscrito</th></tr></thead>
              <tbody>
                ${sources.map((source) => {
                  const conversion = pct(source.enrolled, source.leads);
                  return `<tr><td><div class="table-title"><span class="source-icon">${esc(source.source.slice(0,1))}</span><strong>${esc(source.source)}</strong></div></td><td>${formatNumber(source.leads)}</td><td>${formatNumber(source.qualified)}</td><td>${formatNumber(source.tourAttended)}</td><td><strong>${formatNumber(source.enrolled)}</strong></td><td><div class="conversion-cell"><div class="mini-track"><span style="width:${Math.min(conversion * 1.5, 100)}%"></span></div><strong>${conversion}%</strong></div></td></tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </article>

        <article class="card">
          <div class="card-header"><div><h3 class="card-title">Motivos de pérdida</h3><p class="card-subtitle">Lost registrados en el archivo actual.</p></div></div>
          <div class="progress-list">
            ${reasons.slice(0, 9).map((reason) => `<div><div class="progress-row-header"><span>${esc(reason.reason)}</span><strong>${formatNumber(reason.count)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${(reason.count / maxReason) * 100}%"></div></div></div>`).join("")}
          </div>
          <div class="notice warning" style="margin-top:18px;margin-bottom:0"><strong>Acción:</strong> reducir el uso de “Otro” y registrar un motivo específico para que el dashboard pueda distinguir problemas de precio, distancia, nivel o ciclo futuro.</div>
        </article>
      </section>`;
  }

  function inputField(name, label, value = 0, options = {}) {
    return `<div class="form-field ${options.full ? "full" : ""}"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${options.type || "number"}" min="0" value="${esc(value)}" ${options.required ? "required" : ""}><span class="form-helper">${options.helper || ""}</span></div>`;
  }

  function renderEod() {
    const entries = [...state.manualEntries].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const todayIso = isoDate(new Date());
    const weekend = latestWeekend();

    app.innerHTML = `
      <section class="view-header">
        <div>
          <h2>Cierre diario de admisiones</h2>
          <p>Cinthia y Paty registran su actividad, los leads recibidos y lo que queda pendiente para el siguiente día.</p>
        </div>
        <div class="view-header-actions"><button class="btn btn-secondary" id="export-eod">Exportar CSV</button></div>
      </section>

      <div class="notice warning">
        Esta captura es demostrativa. Necesito hacer una V2 para almacenar los EOD y compartirlos entre Cinthia y Paty.
      </div>

      <section class="form-layout">
        <article class="card">
          <form id="eod-form">
            <div class="form-section">
              <h3>Responsable y fecha</h3>
              <p>Cada persona registra sus propios números. “Equipo” se reserva para un consolidado único.</p>
              <div class="form-grid two">
                <div class="form-field"><label for="eod-date">Fecha</label><input id="eod-date" name="date" type="date" value="${todayIso}" required></div>
                <div class="form-field"><label for="eod-owner">Responsable</label><select id="eod-owner" name="owner" required><option>Cinthia</option><option>Paty</option><option>Lucía</option><option>Equipo</option><option>Sin asignar</option></select></div>
              </div>
            </div>

            <div class="form-section">
              <h3>Leads recibidos</h3>
              <p>Registra los leads del día aunque hayan entrado sábado o domingo y todavía no se hayan contactado.</p>
              <div class="form-grid">
                ${inputField("paidLeads", "Leads de Ads")}
                ${inputField("organicLeads", "Leads orgánicos")}
                ${inputField("weekendBacklogStart", "Backlog al iniciar", 0, { helper: "Úsalo el lunes para el cúmulo del fin de semana." })}
              </div>
            </div>

            <div class="form-section">
              <h3>Actividad de contacto</h3>
              <p>Separar WhatsApp y llamadas permite medir la carga real de seguimiento.</p>
              <div class="form-grid">
                ${inputField("contactWhatsApp", "Contactados por WhatsApp")}
                ${inputField("calls", "Llamadas realizadas")}
                ${inputField("responses", "Respuestas obtenidas")}
                ${inputField("qualified", "Qualified")}
                ${inputField("noQualified", "No Qualified")}
                ${inputField("pendingEnd", "Pendientes al cierre")}
              </div>
            </div>

            <div class="form-section">
              <h3>Avance del pipeline</h3>
              <p>Los movimientos pueden corresponder a leads de días anteriores.</p>
              <div class="form-grid">
                ${inputField("tourBooked", "School Tours agendados")}
                ${inputField("tourAttended", "School Tours atendidos")}
                ${inputField("passDayBooked", "Pass Days agendados")}
                ${inputField("passDayAttended", "Pass Days atendidos")}
                ${inputField("feedbacks", "Retroalimentaciones")}
                ${inputField("enrolled", "Inscritos")}
              </div>
            </div>

            <div class="form-section">
              <div class="form-field full"><label for="notes">Situaciones, bloqueos o contexto</label><textarea id="notes" name="notes" placeholder="Ej. 5 leads entraron el sábado; se contactarán el lunes. Dos familias pidieron ciclo 27/28…"></textarea></div>
            </div>

            <div class="form-summary" id="eod-form-summary">
              <div class="form-summary-item"><span>Leads recibidos</span><strong id="summary-leads">0</strong></div>
              <div class="form-summary-item"><span>Intentos</span><strong id="summary-attempts">0</strong></div>
              <div class="form-summary-item"><span>Avances</span><strong id="summary-progress">0</strong></div>
              <div class="form-summary-item"><span>Pendientes</span><strong id="summary-pending">0</strong></div>
            </div>

            <div class="form-actions"><button type="reset" class="btn btn-secondary">Limpiar</button><button type="submit" class="btn btn-primary">Guardar EOD</button></div>
          </form>
        </article>

        <aside>
          <article class="card weekend-card">
            <div class="weekend-hero"><div><strong>Leads recibidos en fin de semana</strong><p>Registra aquí lo que entró sábado y domingo, aunque el seguimiento comience el lunes.</p></div><div class="weekend-number">${weekend.pending}</div></div>
            <form id="weekend-form">
              <div class="weekend-fields">
                <div class="form-field"><label>Sábado</label><input name="saturdayDate" type="date" value="${weekend.saturday}"><input name="saturdayLeads" type="number" min="0" value="0" aria-label="Leads del sábado"></div>
                <div class="form-field"><label>Domingo</label><input name="sundayDate" type="date" value="${weekend.sunday}"><input name="sundayLeads" type="number" min="0" value="0" aria-label="Leads del domingo"></div>
              </div>
              <div class="form-field" style="margin-top:10px"><label>¿Quién recibirá el backlog?</label><select name="owner"><option>Sin asignar</option><option>Cinthia</option><option>Paty</option><option>Equipo</option></select></div>
              <button class="btn btn-secondary" type="submit" style="width:100%;margin-top:12px">Guardar cúmulo</button>
            </form>
          </article>

          <article class="card weekend-guide-card" style="margin-top:18px">
            <div class="card-header"><div><h3 class="card-title">Cómo registrar el fin de semana</h3><p class="card-subtitle">La idea es separar los leads que llegan fuera de horario de la actividad que realiza el equipo el lunes.</p></div></div>
            <div class="weekend-guide">
              <div class="weekend-step"><span>1</span><div><strong>Sábado y domingo</strong><p>Registra únicamente cuántos leads llegaron. Si nadie pudo atenderlos, deja WhatsApp, llamadas y respuestas en cero. Quedarán identificados como pendientes para el siguiente día hábil.</p></div></div>
              <div class="weekend-step"><span>2</span><div><strong>Al comenzar el lunes</strong><p>Coloca el total acumulado en <b>Backlog al iniciar</b>. Después registra normalmente los contactos, llamadas, respuestas y avances que se lograron durante el día.</p></div></div>
              <div class="weekend-step"><span>3</span><div><strong>Al cerrar el lunes</strong><p>En <b>Pendientes al cierre</b> indica cuántas familias todavía faltan por atender. Así se ve claramente cuánto llegó, cuánto resolvió el equipo y qué quedó para el martes.</p></div></div>
            </div>
            <div class="weekend-example"><strong>Ejemplo:</strong> entraron 8 leads entre sábado y domingo. El lunes se contactaron 6 y quedaron 2 pendientes. El EOD del lunes mostraría backlog inicial 8 y pendientes al cierre 2.</div>
          </article>
        </aside>
      </section>

      <section class="eod-history">
        <div class="eod-history-head"><h3>Capturas manuales</h3><span class="badge badge-gray">${entries.length} registros</span></div>
        <div class="table-card"><div class="table-wrap"><table>
          <thead><tr><th>Fecha</th><th>Responsable</th><th>Leads</th><th>WhatsApp</th><th>Llamadas</th><th>Respuestas</th><th>Qualified</th><th>Tours</th><th>Inscritos</th><th>Pendientes</th><th></th></tr></thead>
          <tbody>${entries.length ? entries.map((entry) => `<tr><td>${formatDate(entry.date)}</td><td>${esc(entry.owner)}</td><td><strong>${totalLeads(entry)}</strong></td><td>${n(entry.contactWhatsApp)}</td><td>${n(entry.calls)}</td><td>${n(entry.responses)}</td><td>${n(entry.qualified)}</td><td>${n(entry.tourBooked)} / ${n(entry.tourAttended)}</td><td>${n(entry.enrolled)}</td><td>${n(entry.pendingEnd)}</td><td><button class="btn btn-danger btn-small" data-delete-eod="${esc(entry.id)}">Eliminar</button></td></tr>`).join("") : `<tr><td colspan="11"><div class="empty-state"><strong>Aún no hay capturas manuales</strong>El histórico del Excel sí alimenta las gráficas; aquí aparecerán los EOD nuevos.</div></td></tr>`}</tbody>
        </table></div></div>
      </section>`;

    const form = document.getElementById("eod-form");
    form?.addEventListener("input", updateEodSummary);
    form?.addEventListener("reset", () => setTimeout(updateEodSummary, 0));
    form?.addEventListener("submit", handleEodSubmit);
    document.getElementById("weekend-form")?.addEventListener("submit", handleWeekendSubmit);
    document.getElementById("export-eod")?.addEventListener("click", exportEodCsv);
    updateEodSummary();
  }

  function formNumber(form, name) {
    return n(new FormData(form).get(name));
  }

  function updateEodSummary() {
    const form = document.getElementById("eod-form");
    if (!form) return;
    const leads = formNumber(form, "paidLeads") + formNumber(form, "organicLeads");
    const attempts = formNumber(form, "contactWhatsApp") + formNumber(form, "calls");
    const progress = formNumber(form, "qualified") + formNumber(form, "tourBooked") + formNumber(form, "passDayBooked") + formNumber(form, "enrolled");
    document.getElementById("summary-leads").textContent = leads;
    document.getElementById("summary-attempts").textContent = attempts;
    document.getElementById("summary-progress").textContent = progress;
    document.getElementById("summary-pending").textContent = formNumber(form, "pendingEnd");
  }

  async function handleEodSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const numericFields = Object.keys(fieldLabels);
    numericFields.forEach((field) => { data[field] = n(data[field]); });
    const duplicate = state.manualEntries.find((e) => e.date === data.date && e.owner === data.owner && e.source !== "Captura fin de semana");
    const entry = {
      id: duplicate?.id || uid(),
      ...data,
      source: "Captura EOD",
      updatedAt: new Date().toISOString(),
    };
    await persistEntry(entry);
    showToast(duplicate ? "EOD actualizado." : "EOD guardado correctamente.");
    renderEod();
  }

  async function handleWeekendSubmit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const batches = [
      { date: data.saturdayDate, leads: n(data.saturdayLeads) },
      { date: data.sundayDate, leads: n(data.sundayLeads) },
    ].filter((row) => row.date && row.leads > 0);
    if (!batches.length) {
      showToast("Ingresa al menos un lead de sábado o domingo.", "error");
      return;
    }
    for (const batch of batches) {
      const duplicate = state.manualEntries.find((e) => e.date === batch.date && e.owner === data.owner && e.source === "Captura fin de semana");
      await persistEntry({
        id: duplicate?.id || uid(),
        date: batch.date,
        owner: data.owner,
        paidLeads: batch.leads,
        organicLeads: 0,
        contactWhatsApp: 0,
        calls: 0,
        responses: 0,
        qualified: 0,
        noQualified: 0,
        tourBooked: 0,
        tourAttended: 0,
        passDayBooked: 0,
        passDayAttended: 0,
        feedbacks: 0,
        enrolled: 0,
        pendingEnd: batch.leads,
        weekendBacklogStart: 0,
        notes: "Leads recibidos durante el fin de semana; pendientes de contacto en el siguiente día hábil.",
        source: "Captura fin de semana",
        updatedAt: new Date().toISOString(),
      });
    }
    showToast("Cúmulo de fin de semana guardado.");
    renderEod();
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  }

  function exportEodCsv() {
    const entries = state.manualEntries;
    if (!entries.length) {
      showToast("No hay capturas manuales para exportar.", "error");
      return;
    }
    const fields = ["date", "owner", ...Object.keys(fieldLabels), "notes", "source", "updatedAt"];
    const rows = [fields.map(csvCell).join(","), ...entries.map((entry) => fields.map((field) => csvCell(entry[field])).join(","))];
    const blob = new Blob(["\ufeff" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `milhano-eod-${isoDate(maxEntryDate(allEntries()))}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function resetFollowupFilters() {
    state.followupTab = "all";
    state.followupSearch = "";
    state.followupOwner = "all";
    state.followupStatus = "all";
  }

  function updatePeriodControlVisibility() {
    const control = document.querySelector(".period-control");
    if (control) control.hidden = state.currentView !== "summary";
  }

  function renderCurrentView() {
    pageTitle.textContent = pageTitles[state.currentView];
    document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === state.currentView));
    updatePeriodControlVisibility();
    if (state.currentView === "summary") renderSummary();
    if (state.currentView === "followup") renderFollowup();
    if (state.currentView === "funnel") renderFunnel();
    if (state.currentView === "acquisition") renderAcquisition();
    if (state.currentView === "eod") renderEod();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigate(view) {
    if (view === "followup" && state.currentView !== "followup") resetFollowupFilters();
    state.currentView = view;
    document.getElementById("sidebar")?.classList.remove("open");
    renderCurrentView();
  }

  app.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view-link]");
    if (viewButton) {
      navigate(viewButton.dataset.viewLink);
      return;
    }

    const tabButton = event.target.closest("[data-followup-tab]");
    if (tabButton) {
      state.followupTab = tabButton.dataset.followupTab;
      renderFollowup();
      return;
    }

    const leadButton = event.target.closest("[data-lead-action]");
    if (leadButton) {
      showToast(`Actividad de ${leadButton.dataset.leadAction}: regístrala en el EOD.`);
      setTimeout(() => navigate("eod"), 450);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-eod]");
    if (deleteButton) deleteEntry(deleteButton.dataset.deleteEod);
  });

  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view)));
  document.getElementById("mobile-menu")?.addEventListener("click", () => document.getElementById("sidebar")?.classList.toggle("open"));
  periodSelect?.addEventListener("change", (event) => {
    state.period = event.target.value;
    renderCurrentView();
  });

  function init() {
    state.manualEntries = loadLocalEntries();
    periodSelect.value = state.period;
    renderCurrentView();
  }

  init();
})();
