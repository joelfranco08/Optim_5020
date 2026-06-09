/* ═══════════════════════════════════════════════════════════
   OptimAl 5020 – Frontend Engine
   Arquitectura: módulos lógicos separados por responsabilidad
═══════════════════════════════════════════════════════════ */

// ─── CONSTANTES ───────────────────────────────────────────
const BARRA_LEN = 6000;
const PALETA_COLORES = [
  '#6EB5E8', '#3DD68C', '#F5A623', '#C084FC',
  '#FB923C', '#F472B6', '#38BDF8', '#A3E635',
];

// Colores por tipo de componente SVG (para leyenda y barras)
const COLOR_POR_COMPONENTE = {
  'svg-cabezal':         PALETA_COLORES[0],
  'svg-sillar':          PALETA_COLORES[1],
  'svg-jamba':           PALETA_COLORES[2],
  'svg-zocalo':          PALETA_COLORES[3],
  'svg-gancho':          PALETA_COLORES[4],
  'svg-traslape':        PALETA_COLORES[5],
  'svg-horizontal-hoja': PALETA_COLORES[6],
};

// ─── MÓDULO: Estado de la aplicación ────────────────────
const AppState = (() => {
  let _estado = {
    resultado: null,
    piezaActiva: null,
    cargando: false,
  };

  return {
    get: () => _estado,
    set: (parcial) => { _estado = { ..._estado, ...parcial }; },
    getPiezaMap: () => {
      if (!_estado.resultado) return {};
      return _estado.resultado.piezas.reduce((map, p) => {
        map[p.componente_svg] = p;
        return map;
      }, {});
    },
  };
})();

// ─── MÓDULO: API ─────────────────────────────────────────
const API = {
  /**
   * Intenta parsear el body de la respuesta como JSON.
   * Si el servidor devuelve HTML (error de Flask en modo debug, crash, proxy, etc.)
   * en lugar de JSON, captura la excepción y devuelve null sin romper el flujo.
   */
  async _parseJson(res) {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // El servidor respondió con HTML u otro formato — no intentar parsear
      return null;
    }
    try {
      return await res.json();
    } catch {
      return null;
    }
  },

  async optimizar(anchoMm, altoMm) {
    let res;
    try {
      res = await fetch('/api/optimizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ancho_mm: anchoMm, alto_mm: altoMm }),
      });
    } catch (networkErr) {
      throw new Error('No se pudo conectar con el servidor. Verifica que Flask esté en ejecución.');
    }

    const data = await this._parseJson(res);

    if (!res.ok) {
      // Tenemos JSON de error estructurado → usar su mensaje
      if (data && data.mensaje) {
        const det = data.detalles ? Object.values(data.detalles).join(' ') : '';
        throw new Error(det ? `${data.mensaje} ${det}` : data.mensaje);
      }
      // Fallback: el servidor devolvió HTML o body vacío
      throw new Error(`Error del servidor (HTTP ${res.status}). Revisa la consola de Flask.`);
    }

    if (!data) {
      throw new Error('La respuesta del servidor no es JSON válido.');
    }

    return data;
  },
};

// ─── MÓDULO: SVG Generator ───────────────────────────────
const SvgGenerator = {
  /**
   * Genera el SVG proporcional de la ventana corredera 2 hojas.
   * El viewBox se ajusta para representar las proporciones reales.
   */
  render(anchoMm, altoMm, piezaActivaId = null) {
    const SVG_W = 500;
    const MARGIN = 40;
    const LABEL_H = 24;

    const escala = Math.min(
      (SVG_W - MARGIN * 2) / anchoMm,
      (340 - MARGIN * 2) / altoMm,
    );

    const W = Math.round(anchoMm * escala);
    const H = Math.round(altoMm * escala);
    const SVG_H = H + MARGIN * 2 + LABEL_H;

    const ox = Math.round((SVG_W - W) / 2);
    const oy = MARGIN + LABEL_H;

    // Grosor proporcional del perfil (mínimo 8, máximo 18 px)
    const T = Math.max(8, Math.min(18, Math.round(W * 0.03)));
    const HOJA_OVERLAP = Math.round(W * 0.015); // traslape central entre hojas

    const W2 = Math.round(W / 2); // mitad para cada hoja
    const GH = H - T * 2;         // alto de ganchos (descontando cabezal y sillar)
    const HH_W = Math.round(W2 * 0.95); // ancho horizontal de hoja

    const isActive = (id) => piezaActivaId === id;
    const fillMarco = (id) => isActive(id) ? '#6EB5E8' : '#3D5A7A';
    const fillHoja  = (id) => isActive(id) ? '#4A8CAD' : '#2D4A5E';
    const strokeSel = (id) => isActive(id) ? '#6EB5E8' : '#4A7FA5';

    // Cotas (dimensiones)
    const cotaColor = '#4A5568';
    const cotaText  = '#6EB5E8';

    return `
<svg id="ventana-svg" viewBox="0 0 ${SVG_W} ${SVG_H}"
     xmlns="http://www.w3.org/2000/svg"
     style="max-width:100%;height:auto;filter:drop-shadow(0 8px 32px rgba(0,0,0,0.5))">
  <defs>
    <pattern id="vidrio-pat" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
      <path d="M0 12 L12 0" stroke="rgba(110,181,232,0.06)" stroke-width="1"/>
    </pattern>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Cota ancho -->
  <line x1="${ox}" y1="${oy - 12}" x2="${ox + W}" y2="${oy - 12}" stroke="${cotaColor}" stroke-width="1"/>
  <line x1="${ox}" y1="${oy - 16}" x2="${ox}" y2="${oy - 8}" stroke="${cotaColor}" stroke-width="1"/>
  <line x1="${ox + W}" y1="${oy - 16}" x2="${ox + W}" y2="${oy - 8}" stroke="${cotaColor}" stroke-width="1"/>
  <text x="${ox + W/2}" y="${oy - 16}" text-anchor="middle" font-family="JetBrains Mono,monospace"
        font-size="10" fill="${cotaText}">${anchoMm} mm</text>

  <!-- Cota alto -->
  <line x1="${ox - 12}" y1="${oy}" x2="${ox - 12}" y2="${oy + H}" stroke="${cotaColor}" stroke-width="1"/>
  <line x1="${ox - 16}" y1="${oy}" x2="${ox - 8}" y2="${oy}" stroke="${cotaColor}" stroke-width="1"/>
  <line x1="${ox - 16}" y1="${oy + H}" x2="${ox - 8}" y2="${oy + H}" stroke="${cotaColor}" stroke-width="1"/>
  <text x="${ox - 18}" y="${oy + H/2}" text-anchor="middle" font-family="JetBrains Mono,monospace"
        font-size="10" fill="${cotaText}" transform="rotate(-90,${ox - 18},${oy + H/2})">${altoMm} mm</text>

  <!-- ── MARCO FIJO ── -->
  <!-- Cabezal -->
  <rect class="svg-piece" data-id="svg-cabezal"
        x="${ox}" y="${oy}" width="${W}" height="${T}"
        fill="${fillMarco('svg-cabezal')}" stroke="${strokeSel('svg-cabezal')}" stroke-width="1.5" rx="2"
        ${isActive('svg-cabezal') ? 'filter="url(#glow)"' : ''}/>
  <text x="${ox + W/2}" y="${oy + T/2 + 4}" text-anchor="middle"
        font-family="JetBrains Mono,monospace" font-size="8" fill="rgba(255,255,255,0.6)"
        pointer-events="none">CABEZAL</text>

  <!-- Sillar -->
  <rect class="svg-piece" data-id="svg-sillar"
        x="${ox}" y="${oy + H - T}" width="${W}" height="${T}"
        fill="${fillMarco('svg-sillar')}" stroke="${strokeSel('svg-sillar')}" stroke-width="1.5" rx="2"
        ${isActive('svg-sillar') ? 'filter="url(#glow)"' : ''}/>
  <text x="${ox + W/2}" y="${oy + H - T/2 + 4}" text-anchor="middle"
        font-family="JetBrains Mono,monospace" font-size="8" fill="rgba(255,255,255,0.6)"
        pointer-events="none">SILLAR</text>

  <!-- Jamba izquierda -->
  <rect class="svg-piece" data-id="svg-jamba"
        x="${ox}" y="${oy}" width="${T}" height="${H}"
        fill="${fillMarco('svg-jamba')}" stroke="${strokeSel('svg-jamba')}" stroke-width="1.5" rx="2"
        ${isActive('svg-jamba') ? 'filter="url(#glow)"' : ''}/>
  <!-- Jamba derecha -->
  <rect class="svg-piece" data-id="svg-jamba"
        x="${ox + W - T}" y="${oy}" width="${T}" height="${H}"
        fill="${fillMarco('svg-jamba')}" stroke="${strokeSel('svg-jamba')}" stroke-width="1.5" rx="2"
        ${isActive('svg-jamba') ? 'filter="url(#glow)"' : ''}/>

  <!-- Zócalo central -->
  <rect class="svg-piece" data-id="svg-zocalo"
        x="${ox + W2 - Math.round(T * 0.6)}" y="${oy + T}" width="${Math.round(T * 1.2)}" height="${H - T * 2}"
        fill="${fillMarco('svg-zocalo')}" stroke="${strokeSel('svg-zocalo')}" stroke-width="1.5"
        ${isActive('svg-zocalo') ? 'filter="url(#glow)"' : ''}/>
  <text x="${ox + W2}" y="${oy + H/2 + 4}" text-anchor="middle"
        font-family="JetBrains Mono,monospace" font-size="7" fill="rgba(255,255,255,0.5)"
        transform="rotate(-90,${ox + W2},${oy + H/2})" pointer-events="none">ZÓCALO</text>

  <!-- ── HOJA IZQUIERDA ── -->
  <!-- Vidrio hoja izq -->
  <rect x="${ox + T + 1}" y="${oy + T + 1}" width="${W2 - T - 2}" height="${GH - 2}"
        fill="url(#vidrio-pat)" stroke="rgba(110,181,232,0.1)" stroke-width="1" rx="1"/>

  <!-- Ganchos hoja izq (verticales) -->
  <rect class="svg-piece" data-id="svg-gancho"
        x="${ox + T + 2}" y="${oy + T}" width="${Math.round(T * 0.8)}" height="${GH}"
        fill="${fillHoja('svg-gancho')}" stroke="${strokeSel('svg-gancho')}" stroke-width="1"
        ${isActive('svg-gancho') ? 'filter="url(#glow)"' : ''}/>
  <rect class="svg-piece" data-id="svg-gancho"
        x="${ox + W2 - Math.round(T * 0.8) - HOJA_OVERLAP}" y="${oy + T}" width="${Math.round(T * 0.8)}" height="${GH}"
        fill="${fillHoja('svg-gancho')}" stroke="${strokeSel('svg-gancho')}" stroke-width="1"
        ${isActive('svg-gancho') ? 'filter="url(#glow)"' : ''}/>

  <!-- Traslapes hoja izq -->
  <rect class="svg-piece" data-id="svg-traslape"
        x="${ox + T}" y="${oy + T}" width="${Math.round(T * 0.6)}" height="${GH}"
        fill="${fillHoja('svg-traslape')}" stroke="${strokeSel('svg-traslape')}" stroke-width="1"
        ${isActive('svg-traslape') ? 'filter="url(#glow)"' : ''}/>
  <rect class="svg-piece" data-id="svg-traslape"
        x="${ox + W2 - Math.round(T * 0.6)}" y="${oy + T}" width="${Math.round(T * 0.6)}" height="${GH}"
        fill="${fillHoja('svg-traslape')}" stroke="${strokeSel('svg-traslape')}" stroke-width="1"
        ${isActive('svg-traslape') ? 'filter="url(#glow)"' : ''}/>

  <!-- Horizontales hoja izq (sup e inf) -->
  <rect class="svg-piece" data-id="svg-horizontal-hoja"
        x="${ox + T + 2}" y="${oy + T}" width="${W2 - T - 4}" height="${Math.round(T * 0.7)}"
        fill="${fillHoja('svg-horizontal-hoja')}" stroke="${strokeSel('svg-horizontal-hoja')}" stroke-width="1"
        ${isActive('svg-horizontal-hoja') ? 'filter="url(#glow)"' : ''}/>
  <rect class="svg-piece" data-id="svg-horizontal-hoja"
        x="${ox + T + 2}" y="${oy + H - T - Math.round(T * 0.7)}" width="${W2 - T - 4}" height="${Math.round(T * 0.7)}"
        fill="${fillHoja('svg-horizontal-hoja')}" stroke="${strokeSel('svg-horizontal-hoja')}" stroke-width="1"
        ${isActive('svg-horizontal-hoja') ? 'filter="url(#glow)"' : ''}/>

  <!-- ── HOJA DERECHA ── -->
  <!-- Vidrio hoja der -->
  <rect x="${ox + W2 + 1}" y="${oy + T + 1}" width="${W2 - T - 2}" height="${GH - 2}"
        fill="url(#vidrio-pat)" stroke="rgba(110,181,232,0.1)" stroke-width="1" rx="1"/>

  <!-- Ganchos hoja der -->
  <rect class="svg-piece" data-id="svg-gancho"
        x="${ox + W2 + HOJA_OVERLAP}" y="${oy + T}" width="${Math.round(T * 0.8)}" height="${GH}"
        fill="${fillHoja('svg-gancho')}" stroke="${strokeSel('svg-gancho')}" stroke-width="1"
        ${isActive('svg-gancho') ? 'filter="url(#glow)"' : ''}/>
  <rect class="svg-piece" data-id="svg-gancho"
        x="${ox + W - T - Math.round(T * 0.8) - 2}" y="${oy + T}" width="${Math.round(T * 0.8)}" height="${GH}"
        fill="${fillHoja('svg-gancho')}" stroke="${strokeSel('svg-gancho')}" stroke-width="1"
        ${isActive('svg-gancho') ? 'filter="url(#glow)"' : ''}/>

  <!-- Traslapes hoja der -->
  <rect class="svg-piece" data-id="svg-traslape"
        x="${ox + W2}" y="${oy + T}" width="${Math.round(T * 0.6)}" height="${GH}"
        fill="${fillHoja('svg-traslape')}" stroke="${strokeSel('svg-traslape')}" stroke-width="1"
        ${isActive('svg-traslape') ? 'filter="url(#glow)"' : ''}/>
  <rect class="svg-piece" data-id="svg-traslape"
        x="${ox + W - T - Math.round(T * 0.6)}" y="${oy + T}" width="${Math.round(T * 0.6)}" height="${GH}"
        fill="${fillHoja('svg-traslape')}" stroke="${strokeSel('svg-traslape')}" stroke-width="1"
        ${isActive('svg-traslape') ? 'filter="url(#glow)"' : ''}/>

  <!-- Horizontales hoja der (sup e inf) -->
  <rect class="svg-piece" data-id="svg-horizontal-hoja"
        x="${ox + W2 + 2}" y="${oy + T}" width="${W2 - T - 4}" height="${Math.round(T * 0.7)}"
        fill="${fillHoja('svg-horizontal-hoja')}" stroke="${strokeSel('svg-horizontal-hoja')}" stroke-width="1"
        ${isActive('svg-horizontal-hoja') ? 'filter="url(#glow)"' : ''}/>
  <rect class="svg-piece" data-id="svg-horizontal-hoja"
        x="${ox + W2 + 2}" y="${oy + H - T - Math.round(T * 0.7)}" width="${W2 - T - 4}" height="${Math.round(T * 0.7)}"
        fill="${fillHoja('svg-horizontal-hoja')}" stroke="${strokeSel('svg-horizontal-hoja')}" stroke-width="1"
        ${isActive('svg-horizontal-hoja') ? 'filter="url(#glow)"' : ''}/>

  <!-- Etiquetas de hojas -->
  <text x="${ox + W2 / 2 + T/2}" y="${oy + H/2 + 5}" text-anchor="middle"
        font-family="JetBrains Mono,monospace" font-size="9" fill="rgba(110,181,232,0.25)"
        pointer-events="none">HOJA A</text>
  <text x="${ox + W2 + W2 / 2}" y="${oy + H/2 + 5}" text-anchor="middle"
        font-family="JetBrains Mono,monospace" font-size="9" fill="rgba(110,181,232,0.25)"
        pointer-events="none">HOJA B</text>
</svg>`.trim();
  },
};

// ─── MÓDULO: Renderizado de Barras ───────────────────────
const BarrasRenderer = {
  /**
   * Construye el HTML de la visualización lineal de barras.
   * Cada segmento tiene ancho proporcional a su longitud respecto a 6000 mm.
   */
  renderBarra(barra, piezaMap) {
    const chips = barra.cortes.map((corte, i) => {
      const color = COLOR_POR_COMPONENTE[corte.componente_svg] || PALETA_COLORES[i % PALETA_COLORES.length];
      return `<div class="pieza-chip">
        <span class="chip-dot" style="background:${color}"></span>
        <span>${corte.nombre}</span>
        <span class="chip-val">${corte.longitud_mm} mm</span>
      </div>`;
    }).join('');

    const segmentos = [];
    barra.cortes.forEach((corte, i) => {
      // Disco de corte (excepto en el primero)
      if (i > 0) {
        const discoPct = (4 / BARRA_LEN * 100).toFixed(3);
        segmentos.push(`<div class="barra-segmento disco" style="width:${discoPct}%" title="Disco sierra: 4mm"></div>`);
      }
      const pct = (corte.longitud_mm / BARRA_LEN * 100).toFixed(2);
      const color = COLOR_POR_COMPONENTE[corte.componente_svg] || PALETA_COLORES[i % PALETA_COLORES.length];
      const label = pct > 5 ? `<span class="seg-label">${corte.nombre.substring(0, 8)}</span>` : '';
      segmentos.push(
        `<div class="barra-segmento" style="width:${pct}%;background:${color}" title="${corte.nombre}: ${corte.longitud_mm} mm">${label}</div>`
      );
    });

    // Sobrante
    if (barra.sobrante_mm > 0) {
      const sobrantePct = (barra.sobrante_mm / BARRA_LEN * 100).toFixed(2);
      segmentos.push(
        `<div class="barra-segmento sobrante" style="flex:1" title="Sobrante: ${barra.sobrante_mm} mm"></div>`
      );
    }

    return `
      <div class="barra-card">
        <div class="barra-card-header">
          <span class="barra-numero">BARRA #${String(barra.numero).padStart(2,'0')}</span>
          <div class="barra-stats">
            <span class="barra-stat">
              <span class="label">Uso </span>
              <span class="val eficiencia">${barra.porcentaje_uso}%</span>
            </span>
            <span class="barra-stat">
              <span class="label">Sobrante </span>
              <span class="val sobrante">${barra.sobrante_mm} mm</span>
            </span>
            <span class="barra-stat">
              <span class="label">Cortes </span>
              <span class="val">${barra.cortes.length}</span>
            </span>
          </div>
        </div>
        <div class="barra-visual">${segmentos.join('')}</div>
        <div class="barra-piezas">${chips}</div>
      </div>`;
  },
};

// ─── MÓDULO: UI Controller ───────────────────────────────
const UI = {
  // Referencias al DOM
  $inputAncho:     document.getElementById('input-ancho'),
  $inputAlto:      document.getElementById('input-alto'),
  $btnCalcular:    document.getElementById('btn-calcular'),
  $errorBanner:    document.getElementById('error-banner'),
  $errorMsg:       document.getElementById('error-msg'),
  $infoPanel:      document.getElementById('info-panel'),
  $infoEmpty:      document.getElementById('info-empty'),
  $infoContent:    document.getElementById('info-content'),
  $infoNombre:     document.getElementById('info-nombre'),
  $infoRef:        document.getElementById('info-ref'),
  $infoLongitud:   document.getElementById('info-longitud'),
  $infoAngulo:     document.getElementById('info-angulo'),
  $infoCantidad:   document.getElementById('info-cantidad'),
  $infoDesc:       document.getElementById('info-desc'),
  $resumenSection: document.getElementById('resumen-section'),
  $resumenGrid:    document.getElementById('resumen-grid'),
  $visorMeta:      document.getElementById('visor-meta'),
  $ventanaSvg:     document.getElementById('ventana-svg'),
  $leyenda:        document.getElementById('leyenda'),
  $barrasPlaceholder: document.getElementById('barras-state-placeholder'),
  $barrasLoading:  document.getElementById('barras-state-loading'),
  $barrasList:     document.getElementById('barras-list'),

  setLoading(estado) {
    this.$btnCalcular.disabled = estado;
    this.$btnCalcular.innerHTML = estado
      ? `<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Calculando…`
      : `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 9-14 9V3z"/></svg> Calcular Optimización`;

    this.$barrasPlaceholder.classList.add('hidden');
    if (estado) {
      this.$barrasLoading.classList.remove('hidden');
      this.$barrasList.innerHTML = '';
    } else {
      this.$barrasLoading.classList.add('hidden');
    }
  },

  showError(msg) {
    this.$errorBanner.classList.remove('hidden');
    this.$errorMsg.textContent = msg;
  },

  hideError() {
    this.$errorBanner.classList.add('hidden');
    this.$errorMsg.textContent = '';
  },

  updateInfoPanel(pieza) {
    if (!pieza) {
      this.$infoEmpty.classList.remove('hidden');
      this.$infoContent.classList.add('hidden');
      this.$infoPanel.classList.remove('highlighted');
      return;
    }
    this.$infoEmpty.classList.add('hidden');
    this.$infoContent.classList.remove('hidden');
    this.$infoPanel.classList.add('highlighted');
    this.$infoNombre.textContent  = pieza.nombre;
    this.$infoRef.textContent     = `PERFIL ${pieza.referencia}`;
    this.$infoLongitud.textContent = `${pieza.longitud_mm} mm`;
    this.$infoAngulo.textContent  = pieza.angulo_corte;
    this.$infoCantidad.textContent = `${pieza.cantidad} ud${pieza.cantidad !== 1 ? 's' : ''}`;
    this.$infoDesc.textContent    = pieza.descripcion;
  },

  renderResumen(resumen) {
    const items = [
      { label: 'Barras usadas',     val: resumen.total_barras_usadas,      unit: 'u.',   cls: 'blue'  },
      { label: 'Eficiencia',        val: `${resumen.eficiencia_porcentaje}%`, unit: '',  cls: resumen.eficiencia_porcentaje >= 85 ? 'green' : 'amber' },
      { label: 'Total piezas',      val: resumen.total_piezas_individuales, unit: 'uds.', cls: ''      },
      { label: 'Sobrante total',    val: `${resumen.total_sobrante_mm}`,   unit: 'mm',   cls: 'amber' },
    ];

    this.$resumenGrid.innerHTML = items.map(item => `
      <div class="resumen-card">
        <div class="resumen-label">${item.label}</div>
        <div class="resumen-val ${item.cls}">${item.val}<span class="resumen-unit">${item.unit}</span></div>
      </div>`).join('');

    this.$resumenSection.classList.remove('hidden');
  },

  renderLeyenda(piezas) {
    const vistos = new Set();
    const items = piezas
      .filter(p => { if (vistos.has(p.componente_svg)) return false; vistos.add(p.componente_svg); return true; })
      .map(p => {
        const color = COLOR_POR_COMPONENTE[p.componente_svg] || '#888';
        return `<div class="leyenda-item" data-id="${p.componente_svg}">
          <div class="leyenda-dot" style="background:${color}"></div>
          <span>${p.nombre}</span>
        </div>`;
      }).join('');
    this.$leyenda.innerHTML = items;
  },

  renderSvg(anchoMm, altoMm, piezaActivaId = null) {
    // Reemplaza el SVG existente por el nuevo generado
    const contenedor = this.$ventanaSvg.parentElement;
    contenedor.innerHTML = SvgGenerator.render(anchoMm, altoMm, piezaActivaId);
    // Re-vincular referencia tras reemplazar el DOM
    this.$ventanaSvg = document.getElementById('ventana-svg');
    this._bindSvgEvents();
  },

  renderBarras(barras, piezaMap) {
    this.$barrasList.innerHTML = barras.map(b =>
      BarrasRenderer.renderBarra(b, piezaMap)
    ).join('');
  },

  _bindSvgEvents() {
    if (!this.$ventanaSvg) return;
    const piezas = this.$ventanaSvg.querySelectorAll('.svg-piece');
    piezas.forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('mouseenter', () => {
        const id = el.getAttribute('data-id');
        const pieza = AppState.getPiezaMap()[id];
        this.updateInfoPanel(pieza || null);
        AppState.set({ piezaActiva: id });
      });
      el.addEventListener('mouseleave', () => {
        this.updateInfoPanel(null);
        AppState.set({ piezaActiva: null });
      });
    });

    // Leyenda también dispara highlight
    document.querySelectorAll('.leyenda-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        const pieza = AppState.getPiezaMap()[id];
        UI.updateInfoPanel(pieza || null);
      });
    });
  },
};

// ─── MÓDULO: Controlador principal ──────────────────────
const Controller = {
  async onCalcular() {
    UI.hideError();

    const anchoRaw = parseFloat(UI.$inputAncho.value);
    const altoRaw  = parseFloat(UI.$inputAlto.value);

    // Validación frontend básica
    if (isNaN(anchoRaw) || isNaN(altoRaw)) {
      UI.showError('Por favor ingresa valores numéricos válidos para Ancho y Alto.');
      return;
    }

    const anchoMm = Math.round(anchoRaw);
    const altoMm  = Math.round(altoRaw);

    UI.setLoading(true);

    try {
      const resultado = await API.optimizar(anchoMm, altoMm);
      AppState.set({ resultado });

      // Actualizar meta del visor
      UI.$visorMeta.textContent = `5020 · ${anchoMm} × ${altoMm} mm`;

      // Renderizar SVG con las dimensiones reales
      UI.renderSvg(anchoMm, altoMm);

      // Leyenda
      UI.renderLeyenda(resultado.piezas);

      // Barras
      UI.renderBarras(resultado.barras, AppState.getPiezaMap());

      // Resumen
      UI.renderResumen(resultado.resumen);

    } catch (err) {
      UI.showError(err.message || 'Error al conectar con el servidor.');
      UI.$barrasPlaceholder.classList.remove('hidden');
    } finally {
      UI.setLoading(false);
    }
  },

  init() {
    UI.$btnCalcular.addEventListener('click', () => this.onCalcular());

    // Calcular también al presionar Enter en los inputs
    [UI.$inputAncho, UI.$inputAlto].forEach(el => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.onCalcular();
      });
    });
  },
};

// ─── ARRANQUE ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Controller.init();
});