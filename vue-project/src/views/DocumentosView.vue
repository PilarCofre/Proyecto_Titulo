<script setup>
import AppLayout from '../components/AppLayout.vue'
import '../assets/styles/documentos.css'
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth     = useAuthStore()
const loading  = ref(true)
const error    = ref(null)
const solicitud = ref(null)
const persona   = ref(null)

// ── CARGA DATOS ───────────────────────────────
async function cargarDatos() {
  loading.value = true
  error.value   = null
  try {
    const [resSol, resPer] = await Promise.all([
      fetch(`http://localhost:3000/api/solicitud/${auth.rut}`),
      fetch(`http://localhost:3000/api/persona/${auth.rut}`),
    ])
    if (!resSol.ok) throw new Error('No se pudo cargar la solicitud')
    if (!resPer.ok) throw new Error('No se pudieron cargar los datos personales')
    solicitud.value = await resSol.json()
    persona.value   = await resPer.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(cargarDatos)

// ── ESTADO ────────────────────────────────────
const estadoAprobado = computed(() =>
  solicitud.value?.estado === 'APROBADA' || solicitud.value?.estado === 'ACTIVADA'
)

// ── HELPERS DE FORMATO ────────────────────────
function fmt(n) {
  if (n == null) return '—'
  return '$' + Math.round(n).toLocaleString('es-CL')
}

function abrirVentana(html, titulo) {
  const w = window.open('', '_blank', 'width=820,height=950')
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 600)
}

// ── ESTILOS BASE COMPARTIDOS ──────────────────
const estilosBase = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a18; padding: 32px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start;
              border-bottom: 2px solid #1a1a18; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 16px; font-weight: bold; }
    .header p  { font-size: 11px; color: #666; margin-top: 3px; }
    .meta      { font-size: 11px; color: #666; text-align: right; line-height: 1.6; }
    h2 { font-size: 13px; font-weight: bold; background: #f5f5f3; padding: 6px 10px;
         border-left: 3px solid #1a1a18; margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    td { padding: 6px 10px; border-bottom: 1px solid #e4e4e0; vertical-align: top; }
    td:first-child { color: #6b6b65; width: 52%; }
    td:last-child  { font-weight: 500; text-align: right; }
    .total-row td  { font-weight: bold; background: #eff4ff; color: #2563eb; }
    .neg  { color: #2a7a4b; }
    .aviso { margin-top: 16px; padding: 10px 14px; border: 1px solid #fde68a;
             background: #fefce8; color: #92400e; font-size: 11px; border-radius: 4px; line-height: 1.6; }
    .aviso-verde { margin-top: 16px; padding: 10px 14px; border: 1px solid #b6dfc8;
             background: #e8f5ee; color: #1a5c36; font-size: 11px; border-radius: 4px; line-height: 1.6; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
    .firma-box { flex: 1; border-top: 1px solid #1a1a18; padding-top: 8px;
                 font-size: 11px; color: #666; text-align: center; min-height: 60px; }
    .numero-sol { font-size: 11px; color: #2563eb; font-weight: 600; }
    ul { margin: 6px 0 0 18px; }
    li { margin-bottom: 3px; }
  </style>
`

// ── 1. PAGARÉ ─────────────────────────────────
function generarPagare() {
  const s = solicitud.value
  const p = persona.value
  if (!s || !p) return

  const nombre = `${p.nombres} ${p.apellido_pat} ${p.apellido_mat}`.trim()
  const fecha  = new Date().toLocaleDateString('es-CL')
  const anioInicio = new Date().getFullYear() + 1

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Pagaré de Reprogramación</title>${estilosBase}</head><body>

  <div class="header">
    <div>
      <h1>Pagaré de Reprogramación de Deuda</h1>
      <p>Art. 17 bis Ley 19.287 — Fondo Solidario de Crédito Universitario</p>
    </div>
    <div class="meta">
      <div class="numero-sol">${s.numero}</div>
      <div>Fecha: ${fecha}</div>
    </div>
  </div>

  <h2>Datos del deudor</h2>
  <table>
    <tr><td>Nombre completo</td><td>${nombre}</td></tr>
    <tr><td>RUT</td><td>${auth.rut}</td></tr>
    <tr><td>Correo electrónico</td><td>${p.email}</td></tr>
    <tr><td>Celular</td><td>${p.celular || '—'}</td></tr>
    <tr><td>Dirección</td><td>${p.direccion}, ${p.comuna}, ${p.region}</td></tr>
  </table>

  <h2>Condiciones del pagaré</h2>
  <table>
    <tr><td>Capital adeudado</td><td>${fmt(s.pie + (s.totalReprogram ?? 0))}</td></tr>
    <tr><td>Pie inicial (abono a capital)</td><td>${fmt(s.pie)}</td></tr>
    <tr><td>Monto total reprogramado</td><td>${fmt(s.totalReprogram)}</td></tr>
    <tr><td>Número de cuotas</td><td>${s.cuotas} cuotas anuales</td></tr>
    <tr><td>Inicio de cobro</td><td>${anioInicio}</td></tr>
    <tr class="total-row"><td>Cuota anual estimada</td><td>${fmt(s.cuotaAnual)}</td></tr>
    <tr><td>Fecha límite del proceso</td><td>${s.fechaLimite}</td></tr>
  </table>

  <h2>Cláusulas</h2>
  <table>
    <tr>
      <td colspan="2" style="color:#1a1a18; line-height:1.8; padding: 10px;">
        Yo, <strong>${nombre}</strong>, RUT <strong>${auth.rut}</strong>, en mi calidad de deudor
        del Fondo Solidario de Crédito Universitario, me obligo a pagar al portador de este
        instrumento la suma de <strong>${fmt(s.totalReprogram)}</strong> en <strong>${s.cuotas}
        cuotas anuales</strong> de <strong>${fmt(s.cuotaAnual)}</strong> cada una, a partir del
        año <strong>${anioInicio}</strong>, conforme a lo establecido en el Art. 17 bis de la
        Ley 19.287 y las condiciones de la reprogramación acordada.<br><br>
        El no pago oportuno de cualquier cuota hará exigible el total del saldo insoluto, más
        los intereses penales que correspondan según la normativa vigente.
      </td>
    </tr>
  </table>

  <div class="aviso">
    <strong>Instrucción:</strong> Imprima este documento, fírmelo ante notario con su cédula
    de identidad vigente y envíe el original escaneado a <strong>reprogramacion@fscu.cl</strong>
    indicando el número <strong>${s.numero}</strong> en el asunto.
    Plazo máximo: <strong>${s.fechaLimite}</strong>.
  </div>

  <div class="footer">
    <div class="firma-box">Firma del deudor<br><br><br>${nombre}<br>RUT: ${auth.rut}</div>
    <div class="firma-box">Firma y timbre notarial</div>
    <div class="firma-box">Timbre y firma FSCU</div>
  </div>

  </body></html>`

  abrirVentana(html, 'Pagaré')
}

// ── 2. INSTRUCCIONES DE PAGO ──────────────────
function generarInstruccionesPago() {
  const s = solicitud.value
  const p = persona.value
  if (!s || !p) return

  const nombre = `${p.nombres} ${p.apellido_pat} ${p.apellido_mat}`.trim()

  const fecha = new Date().toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Instrucciones de Pago del Pie</title>
${estilosBase}

<style>
  body{
    font-family: Arial, Helvetica, sans-serif;
    color:#555;
    padding:40px 56px;
    line-height:1.4;
  }

  .titulo{
    text-align:center;
    color:#1a3a5c;
    font-size:22px;
    font-weight:bold;
    margin-bottom:8px;
  }

  .subtitulo{
    text-align:center;
    color:#2d6a9f;
    font-size:14px;
    margin-bottom:6px;
  }

  .codigo{
    text-align:center;
    font-size:13px;
    margin-bottom:4px;
  }

  .fecha{
    text-align:center;
    font-size:13px;
    margin-bottom:14px;
  }

  .linea{
    border:none;
    border-top:2px solid #2d6a9f;
    margin-bottom:18px;
  }

  .section-title{
    background:#1a3a5c;
    color:white;
    padding:6px 10px;
    font-size:13px;
    font-weight:bold;
    margin-top:18px;
  }

  table{
    width:100%;
    border-collapse:collapse;
    margin-top:0;
  }

  td{
    border:1px solid #ccc;
    padding:7px 8px;
    font-size:13px;
    vertical-align:top;
  }

  .label{
    width:180px;
    font-weight:bold;
    color:#1a3a5c;
  }

  .canal-titulo{
    width:160px;
    background:#e8f0f7;
    font-weight:bold;
    color:#1a3a5c;
  }

  ul{
    margin:6px 0 6px 18px;
    padding:0;
  }

  li{
    margin-bottom:8px;
  }

  .aviso{
    margin-top:20px;
    background:#e8f0f7;
    border:1px solid #2d6a9f;
    padding:14px;
    font-size:13px;
    color:#1a3a5c;
    line-height:1.6;
  }

  .footer{
    margin-top:24px;
    padding-top:10px;
    border-top:1px solid #ccc;
    display:flex;
    justify-content:space-between;
    font-size:11px;
    color:#666;
  }
</style>
</head>

<body>

  <div class="titulo">
    Instrucciones de Pago del Pie Inicial
  </div>

  <div class="subtitulo">
    Art. 17 bis Ley 19.287 — Fondo Solidario de Crédito Universitario
  </div>

  <div class="codigo">
    ${s.numero}
  </div>

  <div class="fecha">
    Fecha: ${fecha}
  </div>

  <hr class="linea"/>

  <!-- DATOS DEL DEUDOR -->
  <div class="section-title">Datos del deudor</div>

  <table>
    <tr>
      <td class="label">Nombre completo</td>
      <td>${nombre}</td>
    </tr>
    <tr>
      <td class="label">RUT</td>
      <td>${auth.rut}</td>
    </tr>
    <tr>
      <td class="label">N° de solicitud</td>
      <td>${s.numero}</td>
    </tr>
    <tr>
      <td class="label">Correo de notificaciones</td>
      <td>${p.email}</td>
    </tr>
  </table>

  <!-- MONTO -->
  <div class="section-title">Monto a pagar</div>

  <table>
    <tr>
      <td class="label">Monto del pie inicial</td>
      <td><strong>${fmt(s.pie)}</strong></td>
    </tr>
    <tr>
      <td class="label">Plazo máximo de pago</td>
      <td>${s.fechaLimite}</td>
    </tr>
    <tr>
      <td class="label">Concepto</td>
      <td>Pie inicial reprogramación ${s.numero}</td>
    </tr>
  </table>

  <!-- CANALES -->
  <div class="section-title">Canales de pago</div>

  <table>
    <tr>
      <td class="canal-titulo">Transferencia bancaria</td>
      <td>
        Banco Estado<br>
        Cuenta corriente N° 123456789<br>
        RUT: 61.979.440-0<br>
        Nombre: Fondo Solidario de Crédito Universitario<br>
        Email confirmación: reprogramacion@fscu.cl
      </td>
    </tr>

    <tr>
      <td class="canal-titulo">Pago presencial</td>
      <td>
        Oficina FSCU, Av. Universidad s/n<br>
        Lunes a viernes, 9:00 – 14:00 hrs<br>
        Presente este documento y su cédula de identidad
      </td>
    </tr>

    <tr>
      <td class="canal-titulo">WebPay / pago en línea</td>
      <td>
        Ingrese a www.oficinavirtual.cl<br>
        → Mi deuda → Pagar pie inicial.<br>
        Use el código de solicitud: <strong>${s.numero}</strong>
      </td>
    </tr>
  </table>

  <!-- INSTRUCCIONES -->
  <div class="section-title">Instrucciones importantes</div>

  <table>
    <tr>
      <td>
        <ul>
          <li>
            Incluya siempre el número <strong>${s.numero}</strong>
            en el asunto o glosa del pago.
          </li>

          <li>
            Una vez realizado el pago, envíe el comprobante a
            <strong>reprogramacion@fscu.cl</strong>.
          </li>

          <li>
            El pago debe realizarse antes del
            <strong>${s.fechaLimite}</strong>.
            Pagos recibidos o pagaré firmado después de esta fecha
            no serán considerados válidos para la reprogramación.
          </li>

          <li>
            El monto exacto a transferir es
            <strong>${fmt(s.pie)}</strong>.
            Montos inferiores no activarán la reprogramación.
          </li>

          <li>
            Para consultas escriba al correo
            <strong>reprogramacion@fscu.cl</strong>,
            indicando su código de solicitud
            <strong>${s.numero}</strong>.
          </li>
        </ul>
      </td>
    </tr>
  </table>

  <!-- AVISO -->
  <div class="aviso">
    <strong>Próximo paso:</strong>
    Una vez confirmado su pago y recibido el pagaré debidamente firmado
    ante notario, su reprogramación quedará activa. Posteriormente podrá
    revisar el estado de su deuda ingresando a través de Oficina Virtual.
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div>
      Emitido por FSCU<br>
      reprogramacion@fscu.cl
    </div>

    <div style="text-align:right;">
      Documento válido hasta<br>
      <strong>${s.fechaLimite}</strong>
    </div>
  </div>

</body>
</html>`

  abrirVentana(html, 'Instrucciones de pago')
}

// ── 3. RESUMEN DE SOLICITUD ───────────────────
function generarResumen() {
  const s = solicitud.value
  const p = persona.value
  if (!s || !p) return

  const nombre = `${p.nombres} ${p.apellido_pat} ${p.apellido_mat}`.trim()
  const fecha  = new Date().toLocaleDateString('es-CL')
  const anioInicio = new Date().getFullYear() + 1

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Resumen de Solicitud</title>${estilosBase}</head><body>

  <div class="header">
    <div>
      <h1>Resumen de Solicitud de Reprogramación</h1>
      <p>Art. 17 bis Ley 19.287 — Fondo Solidario de Crédito Universitario</p>
    </div>
    <div class="meta">
      <div class="numero-sol">${s.numero}</div>
      <div>Generado: ${fecha}</div>
      <div>Estado: <strong>${s.estado}</strong></div>
    </div>
  </div>

  <h2>Datos del deudor</h2>
  <table>
    <tr><td>Nombre completo</td><td>${nombre}</td></tr>
    <tr><td>RUT</td><td>${auth.rut}</td></tr>
    <tr><td>Correo electrónico</td><td>${p.email}</td></tr>
    <tr><td>Celular</td><td>${p.celular || '—'}</td></tr>
    <tr><td>Dirección</td><td>${p.direccion}, ${p.comuna}, ${p.region}</td></tr>
  </table>

  <h2>Condiciones de la reprogramación</h2>
  <table>
    <tr><td>Pie inicial pagado</td><td>${fmt(s.pie)}</td></tr>
    <tr><td>Total reprogramado (pagaré)</td><td>${fmt(s.totalReprogram)}</td></tr>
    <tr><td>Número de cuotas</td><td>${s.cuotas} cuotas anuales</td></tr>
    <tr><td>Inicio de cobro</td><td>${anioInicio}</td></tr>
    <tr class="total-row"><td>Cuota anual estimada</td><td>${fmt(s.cuotaAnual)}</td></tr>
  </table>

  <h2>Estado del proceso</h2>
  <table>
    <tr><td>N° de solicitud</td><td>${s.numero}</td></tr>
    <tr><td>Fecha de envío</td><td>${s.fechaEnvio}</td></tr>
    <tr><td>Fecha límite proceso</td><td>${s.fechaLimite}</td></tr>
    <tr><td>Estado actual</td><td><strong>${s.estado}</strong></td></tr>
    <tr><td>Notificaciones enviadas a</td><td>${p.email}</td></tr>
  </table>

  <div class="aviso">
    Este documento es un resumen informativo de su solicitud de reprogramación.
    Para consultas contáctese a <strong>reprogramacion@fscu.cl</strong>
    indicando el número <strong>${s.numero}</strong>.
  </div>

  <div class="footer">
    <div class="firma-box">Emitido por FSCU<br>reprogramacion@fscu.cl</div>
  </div>

  </body></html>`

  abrirVentana(html, 'Resumen solicitud')
}

// ── LISTA DE DOCUMENTOS ───────────────────────
const documentos = computed(() => {
  if (!solicitud.value) return []
  const s = solicitud.value
  return [
    {
      id:          1,
      nombre:      'Pagaré de reprogramación',
      descripcion: 'Documento legal que formaliza las nuevas condiciones de su deuda. Debe ser firmado ante notario.',
      fecha:       s.fechaEnvio,
      accion:      generarPagare,
    },
    {
      id:          2,
      nombre:      'Instrucciones de pago del pie',
      descripcion: 'Detalle de cómo y dónde realizar el pago del pie inicial requerido para activar la reprogramación.',
      fecha:       s.fechaEnvio,
      accion:      generarInstruccionesPago,
    },
    {
      id:          3,
      nombre:      'Resumen de solicitud',
      descripcion: 'Resumen oficial de las condiciones acordadas en su solicitud de reprogramación.',
      fecha:       s.fechaEnvio,
      accion:      generarResumen,
    },
  ]
})

const pasosFirma = [
  {
    n: 1,
    titulo: 'Descargue el pagaré',
    desc:   'Descargue el documento desde esta pantalla. Verifique que sus datos personales sean correctos antes de imprimirlo.',
  },
  {
    n: 2,
    titulo: 'Imprima el documento',
    desc:   'Imprima el pagaré en papel tamaño carta. No modifique el contenido del documento.',
  },
  {
    n: 3,
    titulo: 'Firme ante notario',
    desc:   'Acuda a cualquier notaría con su cédula de identidad vigente y firme el pagaré en presencia del notario.',
  },
  {
    n: 4,
    titulo: 'Entregue en oficinas',
    desc:   'El pagaré debe ser enviado físicamente a las oficinas del Fondo de Crédito para su correspondiente recepción y validación.',
  },
  {
    n: 5,
    titulo: 'Realice el pago del pie',
    desc:   `Efectúe el pago del pie inicial siguiendo las instrucciones del documento adjunto. Revise la fecha límite en su solicitud.`,
  },
]
</script>

<template>
  <AppLayout>
    <main class="docs-main">

      <h1 class="page-title">Mis documentos</h1>

      <!-- CARGANDO -->
      <div v-if="loading" class="state-box">
        <div class="spinner"></div>
        <p>Cargando documentos...</p>
      </div>

      <!-- ERROR -->
      <div v-else-if="error" class="state-box">
        <p class="state-error">⚠️ {{ error }}</p>
        <button class="retry-btn" @click="cargarDatos">Reintentar</button>
      </div>

      <!-- SIN SOLICITUD O NO APROBADA -->
      <template v-else-if="!solicitud || !estadoAprobado">
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <div class="empty-titulo">No hay documentos disponibles aún</div>
          <div class="empty-desc">
            Los documentos estarán disponibles una vez que su solicitud de reprogramación
            sea aprobada por un funcionario FSCU.
          </div>
        </div>
      </template>

      <!-- CON SOLICITUD APROBADA O ACTIVADA -->
      <template v-else>

        <div class="info-box green">
          <strong>Su solicitud fue aprobada.</strong> Los documentos a continuación están listos
          para descargar. Recuerde que debe completar el proceso antes del
          <strong>{{ solicitud.fechaLimite }}</strong>.
        </div>

        <div class="two-col">

          <!-- DOCUMENTOS -->
          <div>
            <div class="section-label">Documentos disponibles</div>

            <div
              v-for="doc in documentos"
              :key="doc.id"
              class="doc-card"
            >
              <div class="doc-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>

              <div class="doc-info">
                <div class="doc-nombre">{{ doc.nombre }}</div>
                <div class="doc-desc">{{ doc.descripcion }}</div>
                <div class="doc-meta">
                  <span class="doc-tipo">PDF</span>
                  <span class="doc-fecha">Disponible desde {{ doc.fecha }}</span>
                </div>
              </div>

              <button class="doc-btn" @click="doc.accion()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Descargar
              </button>
            </div>
          </div>

          <!-- INSTRUCCIONES FIRMA -->
          <div>
            <div class="section-label">Instrucciones para la firma</div>
            <div class="box">
              <div class="firma-steps">
                <div v-for="paso in pasosFirma" :key="paso.n" class="firma-step">
                  <div class="firma-num">{{ paso.n }}</div>
                  <div class="firma-content">
                    <div class="firma-titulo">{{ paso.titulo }}</div>
                    <div class="firma-desc">{{ paso.desc }}</div>
                  </div>
                </div>
              </div>

              <div class="firma-footer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>
                  Para consultas o dudas relacionadas con su solicitud, comuníquese al correo
                  <strong>reprogramacion@fscu.cl</strong>
                  indicando su número de solicitud en el asunto.
                </span>
              </div>
            </div>
          </div>

        </div>
      </template>

    </main>
  </AppLayout>
</template>