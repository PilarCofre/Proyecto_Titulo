<script setup>
import AppLayout from '../components/AppLayout.vue'
import '../assets/styles/simulador.css'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth   = useAuthStore()

const paso         = ref('A')
const pieMode      = ref('minimo')
const otroMonto    = ref('')
const nCuotas      = ref(10)
const loadingForm  = ref(true)
const loadingDeuda = ref(true)
const errorForm    = ref(null)
const errorDeuda   = ref(null)
const guardando    = ref(false)
const enviando     = ref(false)
const mensajeOk    = ref(false)
const mensajeError = ref(null)

// ── VALIDACIÓN TELÉFONO ──────────────────────
const celularError = ref(null)

function validarCelular(valor) {
  const limpio = valor.replace(/\D/g, '')
  if (!limpio) {
    return false
  }
  if (!/^9\d{8}$/.test(limpio)) {
    celularError.value = 'Ingrese un número válido (ej: 9 12345678 — 9 dígitos empezando con 9)'
    return false
  }
  celularError.value = null
  return true
}

function handleCelularInput(e) {
  form.value.celular = e.target.value
  validarCelular(e.target.value)
}

const idDireccion = ref(null)
const idCelular   = ref(null)

const modalExito = ref(false)

const form = ref({
  apellidoPat: '', apellidoMat: '', nombres: '',
  direccion: '', comuna: '', region: '', celular: '', email: '',
})

// ── Los valores de la BD ya vienen en UTM (igual que usuario.vue) ──
const datosDeuda = ref({
  capital: 0, intereses: 0, cuotasMorosas: 0,
  totalGeneral: 0, utm: 68310, codigo_deuda: '',
})

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function cargarPersona() {
  try {
    const res = await fetch(`http://localhost:3000/api/persona/${auth.rut}`)
    if (!res.ok) throw new Error('No se pudieron cargar los datos personales')
    const data = await res.json()
    form.value = {
      apellidoPat: data.apellido_pat, apellidoMat: data.apellido_mat,
      nombres: data.nombres, email: data.email,
      direccion: data.direccion, comuna: data.comuna,
      region: data.region, celular: data.celular,
    }
    idDireccion.value = data.id_direccion
    idCelular.value   = data.id_celular
  } catch (e) {
    errorForm.value = e.message
  } finally {
    loadingForm.value = false
  }
}

async function cargarDeuda() {
  try {
    const res  = await fetch(`http://localhost:3000/api/deudas/${auth.rut}`)
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error ?? 'No se pudo cargar la deuda')
    const r = data.resumen?.[0]
    if (!r) throw new Error('No se encontraron deudas asociadas a su RUT')
    const det = data.detalle?.[0] ?? {}
    // Los valores vienen en UTM directamente desde la BD
    datosDeuda.value = {
      capital:       num(r.DEUDA_CAPITAL        ?? r.deuda_capital),
      intereses:     num(r.SALDO_PENAL          ?? r.saldo_penal),
      cuotasMorosas: num(r.TOTAL_SALDO_CUOTAS   ?? r.total_saldo_cuotas),
      totalGeneral:  num(r.TOTAL_DEUDA_GENERAL  ?? r.total_deuda_general),
      utm:           num(data.utm) || 68310,
      codigo_deuda:  String(det.CODIGO_DEUDA ?? det.codigo_deuda ?? ''),
    }
  } catch (e) {
    errorDeuda.value = e.message
  } finally {
    loadingDeuda.value = false
  }
}

onMounted(() => { cargarPersona(); cargarDeuda() })

// ── CONSTANTES DE CONDONACIÓN ─────────────────
const COND_PCT_PARCIAL = 0.20
const COND_PCT_TOTAL   = 0.80

// ── PIE MÍNIMO en UTM: 10% capital, clampado entre 4 y 20 UTM ──
const minPie = computed(() => {
  const diez = datosDeuda.value.capital * 0.10
  if (diez < 4)  return 4    // piso 4 UTM
  if (diez > 20) return 20   // techo 20 UTM
  return Math.round(diez * 1000) / 1000
})

const pie20utm = computed(() => 20)   // siempre 20 UTM

const deudaTotalOrigen = computed(
  () => datosDeuda.value.capital + datosDeuda.value.intereses + datosDeuda.value.cuotasMorosas
)

// Pago total = capital + 20% intereses (todo en UTM)
const pieTotal    = computed(() =>
  datosDeuda.value.capital +
  Math.round(datosDeuda.value.intereses * (1 - COND_PCT_TOTAL) * 1000) / 1000
)
const pagoEsTotal = computed(() => pieMode.value === 'total')

// ── VALIDACIÓN OTRO MONTO ────────────────────
const otroMontoError = ref(null)

const minPiePesos = computed(() => Math.round(minPie.value * datosDeuda.value.utm))

function validarOtroMonto(pesos) {
  if (!pesos || pesos <= 0) {
    otroMontoError.value = 'Ingrese un monto'
    return false
  }
  if (pesos < minPiePesos.value) {
    otroMontoError.value = `El monto mínimo es ${fmtPesos(minPiePesos.value)} (${fmt(minPie.value)} UTM)`
    return false
  }
  otroMontoError.value = null
  return true
}

const pieAmount = computed(() => {
  if (pieMode.value === 'minimo') return minPie.value
  if (pieMode.value === '20utm')  return pie20utm.value
  if (pieMode.value === 'total')  return pieTotal.value
  if (pieMode.value === 'otro') {
    // El usuario ingresa pesos, convertimos a UTM
    const pesos = parseInt(otroMonto.value.replace(/\D/g, '')) || 0
    return datosDeuda.value.utm > 0
      ? Math.round((pesos / datosDeuda.value.utm) * 1000) / 1000
      : 0
  }
  return minPie.value
})

const clampedPie = computed(() =>
  pagoEsTotal.value
    ? pieTotal.value
    : Math.min(pieAmount.value, datosDeuda.value.capital)
)

const nuevoCapital = computed(() =>
  pagoEsTotal.value ? 0 : Math.round((datosDeuda.value.capital - clampedPie.value) * 1000) / 1000
)

const condPct     = computed(() => pagoEsTotal.value ? COND_PCT_TOTAL : COND_PCT_PARCIAL)
const condonacion = computed(() =>
  Math.round(datosDeuda.value.intereses * condPct.value * 1000) / 1000
)
const saldoInt = computed(() =>
  Math.round((datosDeuda.value.intereses - condonacion.value) * 1000) / 1000
)

const totalReprogram = computed(() =>
  pagoEsTotal.value
    ? datosDeuda.value.cuotasMorosas
    : Math.round((nuevoCapital.value + saldoInt.value + datosDeuda.value.cuotasMorosas) * 1000) / 1000
)

const cuotaAnual = computed(() =>
  nCuotas.value > 0 && totalReprogram.value > 0
    ? Math.round((totalReprogram.value / nCuotas.value) * 1000) / 1000
    : 0
)

// Pie en pesos (para enviar al backend y mostrar subtexto)
const clampedPiePesos = computed(() =>
  Math.round(clampedPie.value * datosDeuda.value.utm)
)

const sliderPct     = computed(() => ((nCuotas.value - 1) / 14 * 100).toFixed(1))
const utmFormateada = computed(() =>
  datosDeuda.value.utm.toLocaleString('es-CL', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  })
)
const anioActual  = new Date().getFullYear()

// ── FECHA LÍMITE: último día del mes actual ──
const fechaLimite = computed(() => {
  const hoy = new Date()
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  const dd  = String(ultimoDia.getDate()).padStart(2, '0')
  const mm  = String(ultimoDia.getMonth() + 1).padStart(2, '0')
  const aaaa = ultimoDia.getFullYear()
  return `${dd}/${mm}/${aaaa}`
})

// ── FORMATO — igual que usuario.vue ──────────
// Valores en UTM con 3 decimales
function fmt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('es-CL', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}
// Pesos enteros como subtexto
function fmtPesos(n) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}
// Convierte UTM → pesos para mostrar subtexto
function utmAPesos(utm) {
  return Math.round(utm * datosDeuda.value.utm)
}

function stepClass(s) {
  const order = { A: 0, B: 1, C: 2 }
  const diff  = order[paso.value] - order[s]
  if (diff > 0)   return 'done'
  if (diff === 0) return 'active'
  return ''
}
function lineClass(to) {
  const order = { A: 0, B: 1, C: 2 }
  return order[to] <= order[paso.value] ? 'done' : ''
}
function irAPaso(p) {
  paso.value = p
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function handleOtroInput(e) {
  const raw = e.target.value.replace(/\D/g, '')
  otroMonto.value = raw
  e.target.value  = raw ? '$' + parseInt(raw).toLocaleString('es-CL') : ''
  const pesos = parseInt(raw) || 0
  validarOtroMonto(pesos)
}

async function actualizarDatos() {
  if (!validarCelular(form.value.celular)) return
  guardando.value = true; mensajeOk.value = false; mensajeError.value = null
  try {
    const res = await fetch(`http://localhost:3000/api/persona/${auth.rut}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direccion: form.value.direccion, comuna: form.value.comuna,
        region: form.value.region, celular: form.value.celular,
        email: form.value.email,
        id_direccion: idDireccion.value, id_celular: idCelular.value,
      }),
    })
    if (!res.ok) throw new Error('No se pudieron guardar los cambios')
    mensajeOk.value = true
    setTimeout(() => { mensajeOk.value = false }, 3000)
  } catch (e) {
    mensajeError.value = e.message
  } finally {
    guardando.value = false
  }
}

// ── ENVIAR SOLICITUD ──────────────────────────
async function enviarSolicitud() {
  enviando.value = true
  try {
    const res = await fetch('http://localhost:3000/api/solicitud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rut_deudor:               auth.rut,
        codigo_deuda:             datosDeuda.value.codigo_deuda,
        deuda_capital:            utmAPesos(datosDeuda.value.capital),
        intereses_penales:        utmAPesos(datosDeuda.value.intereses),
        deuda_total:              utmAPesos(deudaTotalOrigen.value),
        modalidad_pago:           pagoEsTotal.value ? 'total' : 'parcial',
        monto_pago_inicial_pesos: clampedPiePesos.value,
        monto_pago_inicial_utm:   clampedPie.value,
        porcentaje_pago_inicial:  parseFloat(
          (datosDeuda.value.capital > 0
            ? (clampedPie.value / datosDeuda.value.capital) * 100
            : 0).toFixed(2)
        ),
        porcentaje_condonacion:   condPct.value * 100,
        monto_condonado:          utmAPesos(condonacion.value),
        saldo_reprogramar:        utmAPesos(totalReprogram.value),
        plazo_anios:              nCuotas.value,
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Error al enviar la solicitud')
    }
    modalExito.value = true   // ← muestra el modal
  } catch (e) {
    alert('⚠️ ' + e.message)
  } finally {
    enviando.value = false
  }
}

function cerrarModalYRedirigir() {
  modalExito.value = false
  router.push('/solicitud')
}

// ── IMPRIMIR ──────────────────────────────────
function imprimirFormulario() {
  const nombreCompleto = `${form.value.nombres} ${form.value.apellidoPat} ${form.value.apellidoMat}`.trim()
  const fecha          = new Date().toLocaleDateString('es-CL')
  const esPagoTotal    = pagoEsTotal.value
  const pctCondonacion = (condPct.value * 100).toFixed(0)

  const fila = (label, utmVal, cls = '') =>
    `<tr class="${cls}"><td>${label}</td>
     <td>${fmt(utmVal)} UTM<br><small>${fmtPesos(utmAPesos(utmVal))}</small></td></tr>`

  const filasSimulacion = esPagoTotal ? `
    ${fila('Capital adeudado (pago total)', datosDeuda.value.capital)}
    ${fila('Intereses penales', datosDeuda.value.intereses)}
    <tr><td>Condonación (${pctCondonacion}%)</td>
        <td class="neg">−${fmt(condonacion.value)} UTM<br>
        <small>−${fmtPesos(utmAPesos(condonacion.value))}</small></td></tr>
    ${fila('Intereses penales a pagar (20%)', saldoInt.value)}
    ${fila('Total a pagar al contado', clampedPie.value, 'total-row')}
    ${datosDeuda.value.cuotasMorosas > 0
      ? fila('Cuotas morosas (se reprograman)', datosDeuda.value.cuotasMorosas)
      : ''}
  ` : `
    ${fila('Capital adeudado', datosDeuda.value.capital)}
    ${fila('Intereses penales', datosDeuda.value.intereses)}
    ${fila('Total cuotas morosas', datosDeuda.value.cuotasMorosas)}
    ${fila('Total deuda (referencia)', datosDeuda.value.totalGeneral)}
    <tr><td>UTM de referencia</td><td>$${utmFormateada.value}</td></tr>
    ${fila('Pie a pagar', clampedPie.value)}
    ${fila('Nuevo saldo capital', nuevoCapital.value)}
    <tr><td>Condonación (${pctCondonacion}%)</td>
        <td class="neg">−${fmt(condonacion.value)} UTM<br>
        <small>−${fmtPesos(utmAPesos(condonacion.value))}</small></td></tr>
    ${fila('Saldo intereses penales', saldoInt.value)}
    ${fila('Total a reprogramar', totalReprogram.value, 'total-row')}
  `

  const filasCuotas = esPagoTotal && datosDeuda.value.cuotasMorosas === 0 ? `
    <tr><td colspan="2" style="color:#2a7a4b;font-weight:bold">Sin pagaré — pago total al contado</td></tr>
  ` : `
    <tr><td>Número de cuotas</td><td>${nCuotas.value} anuales</td></tr>
    <tr><td>Inicio de cobro</td><td>${anioActual + 1}</td></tr>
    ${fila('Cuota anual estimada', cuotaAnual.value)}
  `

  const avisoFirma = esPagoTotal
    ? `<strong>Modalidad sin pagaré:</strong> Al pagar el 100% del capital + 20% de los intereses
       penales, se condona el 80% de los intereses y no se requiere firma de pagaré ante notario.`
    : `<strong>Importante:</strong> Debe completar el pago del pie y entregar el pagaré firmado
       ante notario antes del ${fechaLimite.value}. Si no lo hace, la solicitud será rechazada.`

  const filasFooter = esPagoTotal
    ? `<div class="firma-box">Timbre y firma FSCU</div>`
    : `<div class="firma-box">Firma del deudor</div><div class="firma-box">Timbre y firma FSCU</div>`

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>Resumen Simulación Reprogramación</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a18;padding:32px 40px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;
              border-bottom:2px solid #1a1a18;padding-bottom:12px;margin-bottom:20px}
      .header h1{font-size:16px;font-weight:bold}
      .header p{font-size:11px;color:#666;margin-top:3px}
      .fecha{font-size:11px;color:#666;text-align:right}
      h2{font-size:13px;font-weight:bold;background:#f5f5f3;padding:6px 10px;
         border-left:3px solid #1a1a18;margin:18px 0 8px}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}
      td{padding:6px 10px;border-bottom:1px solid #e4e4e0;vertical-align:top}
      td:first-child{color:#6b6b65;width:50%}
      td:last-child{font-weight:500;text-align:right}
      td small{display:block;color:#999;font-weight:400;font-size:10px}
      .total-row td{font-weight:bold;background:#eff4ff;color:#2563eb}
      .neg{color:#2a7a4b}
      .aviso{margin-top:20px;padding:10px 14px;border:1px solid #fde68a;
             background:#fefce8;color:#92400e;font-size:11px;border-radius:4px}
      .footer{margin-top:32px;display:flex;justify-content:space-between;gap:40px}
      .firma-box{flex:1;border-top:1px solid #1a1a18;padding-top:6px;
                 font-size:11px;color:#666;text-align:center}
    </style></head><body>
    <div class="header">
      <div>
        <h1>Resumen de Simulación de Reprogramación</h1>
        <p>Art. 17 bis Ley 19.287 — Fondo Solidario de Crédito Universitario</p>
      </div>
      <div class="fecha">Fecha: ${fecha}</div>
    </div>
    <h2>Datos del deudor</h2>
    <table>
      <tr><td>Nombre completo</td><td>${nombreCompleto}</td></tr>
      <tr><td>RUT</td><td>${auth.rut}</td></tr>
      <tr><td>Dirección</td><td>${form.value.direccion}, ${form.value.comuna}, ${form.value.region}</td></tr>
      <tr><td>Celular</td><td>${form.value.celular}</td></tr>
      <tr><td>Correo electrónico</td><td>${form.value.email}</td></tr>
    </table>
    <h2>Condiciones de la simulación</h2>
    <table>${filasSimulacion}</table>
    <h2>Plan de cuotas</h2>
    <table>
      ${filasCuotas}
      <tr><td>Fecha límite proceso</td><td>${fechaLimite.value}</td></tr>
      <tr><td>Notificaciones a</td><td>${form.value.email}</td></tr>
    </table>
    <div class="aviso">${avisoFirma}</div>
    <div class="footer">${filasFooter}</div>
    </body></html>`

  const ventana = window.open('', '_blank', 'width=800,height=900')
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => ventana.print(), 500)
}
</script>

<template>
  <AppLayout>
    <main class="sim-main">
      <h1 class="page-title">Simulador de reprogramación</h1>
      <p class="page-subtitle">Art. 17 bis Ley 19.287 — UTM {{ anioActual }}: ${{ utmFormateada }}</p>

      <!-- STEPS -->
      <div class="steps">
        <div class="step" :class="stepClass('A')">
          <div class="step-circle">{{ stepClass('A') === 'done' ? '✓' : 'A' }}</div>
          <span class="step-label">Confirmar datos</span>
        </div>
        <div class="step-line" :class="lineClass('B')"></div>
        <div class="step" :class="stepClass('B')">
          <div class="step-circle">{{ stepClass('B') === 'done' ? '✓' : 'B' }}</div>
          <span class="step-label">Simular</span>
        </div>
        <div class="step-line" :class="lineClass('C')"></div>
        <div class="step" :class="stepClass('C')">
          <div class="step-circle">C</div>
          <span class="step-label">Confirmar y enviar</span>
        </div>
      </div>

      <!-- ══ SECCIÓN A ══════════════════════════ -->
      <div class="step-section" :class="{ active: paso === 'A' }">
        <div v-if="loadingForm" class="state-box">
          <div class="spinner"></div><p>Cargando datos personales...</p>
        </div>
        <div v-else-if="errorForm" class="state-box">
          <p class="state-error">⚠️ {{ errorForm }}</p>
        </div>
        <template v-else>
          <div class="box">
            <div class="box-header">
              Datos personales <span class="update-badge">Actualice si hay cambios</span>
            </div>
            <div class="form-grid form-grid-3">
              <div class="form-group"><label>Apellido paterno</label>
                <input :value="form.apellidoPat" disabled class="input-readonly" /></div>
              <div class="form-group"><label>Apellido materno</label>
                <input :value="form.apellidoMat" disabled class="input-readonly" /></div>
              <div class="form-group"><label>Nombres</label>
                <input :value="form.nombres" disabled class="input-readonly" /></div>
            </div>
            <div class="form-grid form-grid-3b">
              <div class="form-group"><label>Dirección</label>
                <input v-model="form.direccion" /></div>
              <div class="form-group"><label>Comuna</label>
                <input v-model="form.comuna" /></div>
              <div class="form-group"><label>Región</label>
                <input v-model="form.region" /></div>
            </div>
            <div class="form-grid form-grid-2" style="padding-bottom:20px">
              <!-- CELULAR CON VALIDACIÓN -->
              <div class="form-group">
                <label>Celular</label>
                <input
                  :value="form.celular"
                  placeholder="9 12345678"
                  maxlength="12"
                  @input="handleCelularInput"
                  :class="{ 'input-error': celularError }"
                />
                <span v-if="celularError" class="field-error">{{ celularError }}</span>
              </div>
              <div class="form-group"><label>Correo electrónico</label>
                <input v-model="form.email" /></div>
            </div>
            <div v-if="mensajeOk"    class="feedback-ok">✓ Datos actualizados correctamente</div>
            <div v-if="mensajeError" class="feedback-error">⚠️ {{ mensajeError }}</div>
            <div class="form-actions">
              <button class="btn-actualizar" :disabled="guardando" @click="actualizarDatos">
                <span v-if="guardando">Guardando...</span><span v-else>Actualizar datos</span>
              </button>
            </div>
          </div>
          <button class="cta-btn" @click="irAPaso('B')">
            Datos correctos — continuar a simular <span class="arrow">→</span>
          </button>
        </template>
      </div>

      <!-- ══ SECCIÓN B ══════════════════════════ -->
      <div class="step-section" :class="{ active: paso === 'B' }">
        <div v-if="loadingDeuda" class="state-box">
          <div class="spinner"></div><p>Cargando datos financieros...</p>
        </div>
        <div v-else-if="errorDeuda" class="state-box">
          <p class="state-error">⚠️ {{ errorDeuda }}</p>
        </div>
        <template v-else>

          <!-- Mini-resumen: igual que usuario.vue, valores en UTM con 3 decimales -->
          <div class="mini-summary">
            <div class="mini-card">
              <div class="lbl">Capital adeudado</div>
              <div class="val">{{ fmt(datosDeuda.capital) }}</div>
            </div>
            <div class="mini-card">
              <div class="lbl">Intereses penales</div>
              <div class="val red">{{ fmt(datosDeuda.intereses) }}</div>
            </div>
            <div class="mini-card">
              <div class="lbl">Total cuotas morosas</div>
              <div class="val">{{ fmt(datosDeuda.cuotasMorosas) }}</div>
            </div>
            <div class="mini-card">
              <div class="lbl">Total deuda</div>
              <div class="val bold">{{ fmt(datosDeuda.totalGeneral) }}</div>
            </div>
          </div>

          <!-- PIE -->
          <div class="box">
            <div class="box-header">Pago inicial (pie) — se descuenta del capital</div>
            <div class="pie-section">
              <div class="pie-options">
                <button class="pie-btn" :class="{ selected: pieMode==='minimo' }" @click="pieMode='minimo'">
                  Mínimo<br>
                  <small>{{ fmt(minPie) }} UTM</small>
                  <small>{{ fmtPesos(utmAPesos(minPie)) }}</small>
                </button>
                <button class="pie-btn" :class="{ selected: pieMode==='20utm' }" @click="pieMode='20utm'">
                  20 UTM<br>
                  <small>20,000 UTM</small>
                  <small>{{ fmtPesos(utmAPesos(20)) }}</small>
                </button>
                <button class="pie-btn" :class="{ selected: pieMode==='total' }" @click="pieMode='total'">
                  Pago total<br>
                  <small>{{ fmt(pieTotal) }} UTM</small>
                  <small>{{ fmtPesos(utmAPesos(pieTotal)) }}</small>
                </button>
                <button class="pie-btn" :class="{ selected: pieMode==='otro' }" @click="pieMode='otro'">
                  Otro monto
                </button>
              </div>
              <div class="otro-input-wrap" :class="{ visible: pieMode==='otro' }">
                <input type="text" placeholder="$0" @input="handleOtroInput" />
                <span class="hint">
                  Ingrese el monto en pesos — mínimo {{ fmtPesos(minPiePesos) }} ({{ fmt(minPie) }} UTM)
                </span>
                <span v-if="otroMontoError" class="field-error">{{ otroMontoError }}</span>
              </div>
              <div class="pie-result">
                <span class="lbl">Pie a pagar</span>
                <span class="val">
                  {{ fmt(clampedPie) }} UTM
                  <small class="val-sub">{{ fmtPesos(clampedPiePesos) }}</small>
                </span>
              </div>
            </div>
          </div>

          <!-- BALANCE -->
          <div class="box">
            <div class="box-header">Nuevo saldo a reprogramar</div>

            <div class="balance-section">
              <div class="balance-section-title">Capital</div>
              <div class="balance-row">
                <span class="lbl">Capital adeudado</span>
                <span class="val">{{ fmt(datosDeuda.capital) }} UTM
                  <small class="val-sub">{{ fmtPesos(utmAPesos(datosDeuda.capital)) }}</small></span>
              </div>
              <div class="balance-row">
                <span class="lbl">Menos pago del pie inicial</span>
                <span class="val neg">−{{ fmt(clampedPie) }} UTM
                  <small class="val-sub">{{ fmtPesos(clampedPiePesos) }}</small></span>
              </div>
              <div class="balance-row total">
                <span class="lbl">Nuevo saldo capital</span>
                <span class="val">{{ fmt(nuevoCapital) }} UTM
                  <small class="val-sub">{{ fmtPesos(utmAPesos(nuevoCapital)) }}</small></span>
              </div>
            </div>

            <div class="balance-section">
              <div class="balance-section-title">Intereses penales</div>
              <div class="balance-row">
                <span class="lbl">Intereses penales</span>
                <span class="val">{{ fmt(datosDeuda.intereses) }} UTM
                  <small class="val-sub">{{ fmtPesos(utmAPesos(datosDeuda.intereses)) }}</small></span>
              </div>
              <div class="balance-row">
                <span class="lbl">Condonación ({{ (condPct * 100).toFixed(0) }}%)</span>
                <span class="val neg">−{{ fmt(condonacion) }} UTM
                  <small class="val-sub">{{ fmtPesos(utmAPesos(condonacion)) }}</small></span>
              </div>
              <div class="balance-row total">
                <span class="lbl">Saldo int. penales</span>
                <span class="val">{{ fmt(saldoInt) }} UTM
                  <small class="val-sub">{{ fmtPesos(utmAPesos(saldoInt)) }}</small></span>
              </div>
            </div>

            <div v-if="pagoEsTotal" class="info-box blue" style="margin:0 0 12px">
              <strong>Sin pagaré:</strong> Al pagar el 100% del capital + 20% de los intereses
              penales (condonación del 80%), no se requiere firma de pagaré ante notario.
            </div>

            <div class="balance-total-row">
              <div class="lbl">
                {{ pagoEsTotal
                   ? 'Total al contado (capital + 20% intereses)'
                   : 'Nuevo capital + saldo int. penales + cuotas morosas' }}<br>
                {{ pagoEsTotal ? 'Total a pagar' : 'Total a reprogramar' }}
              </div>
              <div class="val">
                {{ pagoEsTotal ? fmt(clampedPie) : fmt(totalReprogram) }} UTM<br>
                <small class="val-sub">
                  {{ pagoEsTotal
                     ? fmtPesos(clampedPiePesos)
                     : fmtPesos(utmAPesos(totalReprogram)) }}
                </small>
              </div>
            </div>
          </div>

          <!-- CUOTAS — se oculta si es pago total sin cuotas morosas -->
<div
  class="box"
  :class="{ disabledBox: pagoEsTotal }"
>
  <div class="box-header">
    Plan de cuotas — inicio cobro {{ anioActual + 1 }}
  </div>

  <div
    v-if="pagoEsTotal"
    class="disabled-message"
  >
    Al seleccionar pago total, el plan de cuotas queda deshabilitado.
  </div>

  <div class="slider-section">
    <div class="slider-header">
      <span class="lbl">Número de cuotas</span>
      <span class="val">{{ nCuotas }} cuotas</span>
    </div>

    <input
      type="range"
      min="1"
      max="15"
      v-model.number="nCuotas"
      :disabled="pagoEsTotal"
      :style="`background: linear-gradient(to right, var(--blue) ${sliderPct}%, var(--border) ${sliderPct}%)`"
    />

    <div class="cuota-result">
      <span class="lbl">Cuota anual estimada</span>
      <span class="val">
        {{ fmt(cuotaAnual) }} UTM
        <small class="val-sub">
          {{ fmtPesos(utmAPesos(cuotaAnual)) }}
        </small>
      </span>
    </div>
  </div>
</div>

          <!-- BOTONES: primero CTA, luego imprimir -->
          <button class="cta-btn" @click="irAPaso('C')">
            Continuar a confirmar y enviar solicitud <span class="arrow">→</span>
          </button>
          <button class="print-btn" @click="imprimirFormulario">
            ↓ &nbsp;Imprimir formulario con resumen de simulación y datos confirmados
          </button>
        </template>
      </div>

      <!-- ══ SECCIÓN C ══════════════════════════ -->
      <div class="step-section" :class="{ active: paso === 'C' }">
        <div class="box">
          <div class="box-header">Resumen de su solicitud</div>

          <template v-if="pagoEsTotal">
            <div class="summary-row">
              <span class="lbl">Capital adeudado (pago total)</span>
              <span class="val">{{ fmt(datosDeuda.capital) }} UTM
                <small class="val-sub">{{ fmtPesos(utmAPesos(datosDeuda.capital)) }}</small></span>
            </div>
            <div class="summary-row">
              <span class="lbl">Intereses penales</span>
              <span class="val">{{ fmt(datosDeuda.intereses) }} UTM
                <small class="val-sub">{{ fmtPesos(utmAPesos(datosDeuda.intereses)) }}</small></span>
            </div>
            <div class="summary-row">
              <span class="lbl">Condonación int. penales ({{ (condPct * 100).toFixed(0) }}%)</span>
              <span class="val neg">−{{ fmt(condonacion) }} UTM
                <small class="val-sub">{{ fmtPesos(utmAPesos(condonacion)) }}</small></span>
            </div>
            <div class="summary-row">
              <span class="lbl">Intereses penales a pagar (20%)</span>
              <span class="val">{{ fmt(saldoInt) }} UTM
                <small class="val-sub">{{ fmtPesos(utmAPesos(saldoInt)) }}</small></span>
            </div>
            <div class="summary-row">
              <span class="lbl">Total a pagar al contado</span>
              <span class="val bold">{{ fmt(clampedPie) }} UTM
                <small class="val-sub">{{ fmtPesos(clampedPiePesos) }}</small></span>
            </div>
            <template v-if="datosDeuda.cuotasMorosas > 0">
              <div class="summary-row">
                <span class="lbl">Saldo cuotas morosas (se reprograman)</span>
                <span class="val">{{ fmt(datosDeuda.cuotasMorosas) }} UTM
                  <small class="val-sub">{{ fmtPesos(utmAPesos(datosDeuda.cuotasMorosas)) }}</small></span>
              </div>
              <div class="summary-row">
                <span class="lbl">Plan cuotas morosas</span>
                <span class="val">{{ nCuotas }} cuotas anuales desde {{ anioActual + 1 }}<br>
                  {{ fmt(cuotaAnual) }} UTM/año
                  <small class="val-sub">{{ fmtPesos(utmAPesos(cuotaAnual)) }}/año</small></span>
              </div>
            </template>
          </template>

          <template v-else>
            <div class="summary-row">
              <span class="lbl">Pie a pagar (descuento sobre capital)</span>
              <span class="val">{{ fmt(clampedPie) }} UTM
                <small class="val-sub">{{ fmtPesos(clampedPiePesos) }}</small></span>
            </div>
            <div class="summary-row">
              <span class="lbl">Nuevo saldo capital</span>
              <span class="val">{{ fmt(nuevoCapital) }} UTM
                <small class="val-sub">{{ fmtPesos(utmAPesos(nuevoCapital)) }}</small></span>
            </div>
            <div class="summary-row">
              <span class="lbl">Intereses penales</span>
              <span class="val">{{ fmt(datosDeuda.intereses) }} UTM
                <small class="val-sub">{{ fmtPesos(utmAPesos(datosDeuda.intereses)) }}</small></span>
            </div>
            <div class="summary-row">
              <span class="lbl">Condonación int. penales ({{ (condPct * 100).toFixed(0) }}%)</span>
              <span class="val neg">−{{ fmt(condonacion) }} UTM
                <small class="val-sub">{{ fmtPesos(utmAPesos(condonacion)) }}</small></span>
            </div>
            <div class="summary-row">
              <span class="lbl">Saldo int. penales</span>
              <span class="val">{{ fmt(saldoInt) }} UTM
                <small class="val-sub">{{ fmtPesos(utmAPesos(saldoInt)) }}</small></span>
            </div>
            <div class="summary-row">
              <span class="lbl">Saldo cuotas morosas</span>
              <span class="val">{{ fmt(datosDeuda.cuotasMorosas) }} UTM
                <small class="val-sub">{{ fmtPesos(utmAPesos(datosDeuda.cuotasMorosas)) }}</small></span>
            </div>
            <div class="summary-row">
              <span class="lbl">Total a reprogramar (pagaré)</span>
              <span class="val bold">{{ fmt(totalReprogram) }} UTM
                <small class="val-sub">{{ fmtPesos(utmAPesos(totalReprogram)) }}</small></span>
            </div>
            <div class="summary-row">
              <span class="lbl">Plan de pago</span>
              <span class="val">{{ nCuotas }} cuotas anuales desde {{ anioActual + 1 }}<br>
                {{ fmt(cuotaAnual) }} UTM/año
                <small class="val-sub">{{ fmtPesos(utmAPesos(cuotaAnual)) }}/año</small></span>
            </div>
          </template>

          <div class="summary-row">
            <span class="lbl">Fecha límite proceso</span>
            <span class="val">{{ fechaLimite }}</span>
          </div>
          <div class="summary-row">
            <span class="lbl">Notificaciones a</span>
            <span class="val blue">{{ form.email }}</span>
          </div>
        </div>

        <div v-if="pagoEsTotal" class="info-box blue">
          Al pagar el <strong>100% del capital + 20% de los intereses penales</strong>, se condona
          el 80% de los intereses y <strong>no se requiere firma de pagaré ante notario</strong>.
          Recibirá en su correo:
          <ul>
            <li>Las instrucciones para realizar el pago al contado</li>
            <li v-if="datosDeuda.cuotasMorosas > 0">El pagaré por las cuotas morosas pendientes</li>
          </ul>
        </div>
        <div v-else class="info-box blue">
          Una vez aceptada su solicitud recibirá en su correo electrónico:
          <ul>
            <li>El pagaré de reprogramación para firmar ante notario</li>
            <li>Las instrucciones para realizar el pago del pie inicial</li>
          </ul>
        </div>

        <div class="info-box yellow">
          <template v-if="pagoEsTotal">
            Debe completar el pago al contado antes del <strong>{{ fechaLimite }}</strong>.
            Si no lo hace, la solicitud será rechazada automáticamente.
          </template>
          <template v-else>
            Debe completar el pago del pie y entregar el pagaré firmado ante notario antes del
            <strong>{{ fechaLimite }}</strong>. Si no lo hace, la solicitud será rechazada automáticamente.
          </template>
        </div>

        <p class="send-to">La solicitud será enviada a <strong>reprogramacion@fscu.cl</strong></p>

        <div class="action-row">
          <button class="btn-ghost" @click="irAPaso('A')">Cancelar</button>
          <button class="btn-green" :disabled="enviando" @click="enviarSolicitud">
            <span v-if="enviando">Enviando...</span>
            <span v-else>Confirmar y enviar solicitud a reprogramacion@fscu.cl →</span>
          </button>
        </div>
      </div>

    </main>
  </AppLayout>

  <!-- ══ MODAL ÉXITO ══════════════════════════ -->
<Teleport to="body">
  <div v-if="modalExito" class="modal-overlay" @click.self="cerrarModalYRedirigir">
    <div class="modal-card">
      <div class="modal-icon">✓</div>
      <h2 class="modal-title">Solicitud enviada</h2>
      <p class="modal-body">
        Su solicitud de reprogramación fue enviada correctamente a
        <strong>reprogramacion@fscu.cl</strong>.
      </p>
      <p class="modal-body">
        Recibirá las instrucciones en <strong>{{ form.email }}</strong>
        para completar el proceso antes del <strong>{{ fechaLimite }}</strong>.
      </p>
      <button class="modal-btn" @click="cerrarModalYRedirigir">
        Entendido — ir a Mi solicitud →
      </button>
    </div>
  </div>
</Teleport>
</template>