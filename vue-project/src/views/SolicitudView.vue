<script setup>
import AppLayout from '../components/AppLayout.vue'
import '../assets/styles/solicitud.css'
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const auth   = useAuthStore()
const router = useRouter()

const loading  = ref(true)
const error    = ref(null)
const solicitud = ref(null)

// ── CARGA DATOS ───────────────────────────────
async function cargarSolicitud() {
  loading.value = true
  error.value   = null
  try {
    const res = await fetch(`http://localhost:3000/api/solicitud/${auth.rut}`)
    if (!res.ok) throw new Error('No se pudo cargar la solicitud')
    solicitud.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(cargarSolicitud)

// ── FECHA LÍMITE: último día del mes actual ──
const fechaLimite = computed(() => {
  const hoy = new Date()
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  const dd  = String(ultimoDia.getDate()).padStart(2, '0')
  const mm  = String(ultimoDia.getMonth() + 1).padStart(2, '0')
  const aaaa = ultimoDia.getFullYear()
  return `${dd}/${mm}/${aaaa}`
})

// ── HISTORIAL DINÁMICO ────────────────────────
const historial = computed(() => {
  if (!solicitud.value) return []
  const s = solicitud.value
  const esActivada  = s.estado === 'ACTIVADA'
  const esAprobada  = s.estado === 'APROBADA' || esActivada
  const esResuelta  = s.estado !== 'PENDIENTE'

  const todos = [
    {
      id: 1,
      fecha:       s.fechaEnvioHora,
      titulo:      'Solicitud enviada',
      descripcion: 'Su solicitud fue enviada a reprogramacion@fscu.cl y está en revisión.',
      hecho:       true,
    },
    {
      id: 2,
      fecha:       esResuelta ? s.fechaActualizacion : null,
      titulo:      'Solicitud revisada por funcionario',
      descripcion: esActivada
        ? 'Su solicitud fue aprobada. El pagaré y las instrucciones de pago del pie fueron enviados a su correo electrónico.'
        : s.estado === 'APROBADA'
          ? 'Su solicitud fue aprobada. El pagaré y las instrucciones de pago del pie han sido enviados a su correo electrónico.'
          : s.estado === 'RECHAZADA'
            ? 'Su solicitud fue rechazada. Contáctese con FSCU para más información.'
            : 'Un funcionario revisará su solicitud y le notificará por correo electrónico.',
      hecho: esResuelta,
    },
    {
      id: 3,
      fecha:       esActivada ? s.fechaActualizacion : null,
      titulo:      'Firma del pagaré ante notario',
      descripcion: 'Debe firmar el pagaré de reprogramación ante notario y enviar el documento a FSCU.',
      hecho:       esActivada,
    },
    {
      id: 4,
      fecha:       esActivada ? s.fechaActualizacion : null,
      titulo:      'Pago del pie inicial',
      descripcion: `Realice el pago del pie inicial de ${fmt(s.pie)} según las instrucciones enviadas a su correo.`,
      hecho:       esActivada,
    },
    {
      id: 5,
      fecha:       esActivada ? s.fechaActualizacion : null,
      titulo:      'Reprogramación activada',
      descripcion: esActivada
        ? `Su deuda ha sido reprogramada exitosamente en ${s.cuotas} cuotas anuales desde ${new Date().getFullYear() + 1}.`
        : `Su deuda quedará reprogramada en ${s.cuotas} cuotas anuales desde ${new Date().getFullYear() + 1}.`,
      hecho: esActivada,
    },
  ]

  if (['RECHAZADA', 'EXPIRADA'].includes(s.estado)) return todos.slice(0, 2)
  return todos
})

// ── ESTADO BADGE ──────────────────────────────
const estadoInfo = computed(() => {
  const map = {
    PENDIENTE: { label: 'Pendiente de revisión',  cls: 'pendiente' },
    APROBADA:  { label: 'Aprobada',               cls: 'aprobada'  },
    RECHAZADA: { label: 'Rechazada',              cls: 'rechazada' },
    EXPIRADA:  { label: 'Expirada',               cls: 'expirada'  },
    ACTIVADA:  { label: 'Reprogramación activa',  cls: 'activada'  },
  }
  return map[solicitud.value?.estado] ?? map.PENDIENTE
})

function fmt(n) {
  if (n == null) return '—'
  return '$' + Math.round(n).toLocaleString('es-CL')
}
</script>

<template>
  <AppLayout>
    <main class="sol-main">
      <h1 class="page-title">Mi solicitud</h1>

      <!-- CARGANDO -->
      <div v-if="loading" class="state-box">
        <div class="spinner"></div>
        <p>Cargando solicitud...</p>
      </div>

      <!-- ERROR -->
      <div v-else-if="error" class="state-box">
        <p class="state-error">⚠️ {{ error }}</p>
        <button class="retry-btn" @click="cargarSolicitud">Reintentar</button>
      </div>

      <!-- SIN SOLICITUD -->
      <div v-else-if="!solicitud" class="state-box">
        <p style="font-size:32px;margin-bottom:8px">📋</p>
        <p>No tiene solicitudes enviadas aún.</p>
        <button class="retry-btn" @click="router.push('/simulador')">
          Ir al simulador →
        </button>
      </div>

      <!-- DATOS REALES -->
      <template v-else>

        <!-- Tarjeta de estado -->
        <div class="estado-card">
          <div class="estado-left">
            <div class="estado-numero">{{ solicitud.numero }}</div>
            <div class="estado-fecha">
              Enviada el {{ solicitud.fechaEnvio }} · Notificaciones a
              <strong>{{ solicitud.email }}</strong>
            </div>
          </div>
          <div :class="['estado-badge', estadoInfo.cls]">
            <span class="estado-dot"></span>
            {{ estadoInfo.label }}
          </div>
        </div>

        <!-- Alerta ACTIVADA -->
        <div v-if="solicitud.estado === 'ACTIVADA'" class="info-box green">
          <strong>¡Su reprogramación está activa!</strong> Su deuda ha sido reprogramada exitosamente en
          <strong>{{ solicitud.cuotas }} cuotas anuales</strong>. Le hemos enviado a
          <strong>{{ solicitud.email }}</strong> el detalle de su plan de pagos.
        </div>

        <!-- Alerta APROBADA -->
        <div v-else-if="solicitud.estado === 'APROBADA'" class="info-box green">
          <strong>¡Su solicitud fue aprobada!</strong> Le hemos enviado a <strong>{{ solicitud.email }}</strong>:
          <ul>
            <li>El pagaré de reprogramación para firmar ante notario</li>
            <li>Las instrucciones para realizar el pago del pie inicial de {{ fmt(solicitud.pie) }}</li>
          </ul>
        </div>

        <!-- Alerta RECHAZADA -->
        <div v-if="solicitud.estado === 'RECHAZADA'" class="info-box red">
          <strong>Su solicitud fue rechazada.</strong> Contáctese con FSCU para conocer el motivo y evaluar alternativas.
        </div>

        <!-- Alerta EXPIRADA -->
        <div v-if="solicitud.estado === 'EXPIRADA'" class="info-box red">
          <strong>Su solicitud expiró.</strong> No se completó el proceso dentro del plazo límite.
          Puede iniciar una nueva solicitud si aún cumple los requisitos.
        </div>

        <!-- Aviso plazo (solo pendiente o aprobada, no activada) -->
        <div v-if="['PENDIENTE','APROBADA'].includes(solicitud.estado)" class="info-box yellow">
          Debe completar el pago del pie y la firma del pagaré antes del
          <strong>{{ fechaLimite }}</strong>.
          Si no lo hace, la solicitud será rechazada automáticamente.
        </div>

        <div class="two-col">

          <!-- Historial -->
          <div class="box">
            <div class="box-header">Historial del proceso</div>
            <div class="timeline">
              <div
                v-for="(paso, i) in historial"
                :key="paso.id"
                :class="['timeline-item', { hecho: paso.hecho, ultimo: i === historial.length - 1 }]"
              >
                <div class="tl-marker">
                  <div class="tl-dot">
                    <span v-if="paso.hecho">✓</span>
                    <span v-else>{{ paso.id }}</span>
                  </div>
                  <div v-if="i < historial.length - 1" class="tl-line"></div>
                </div>
                <div class="tl-content">
                  <div class="tl-titulo">{{ paso.titulo }}</div>
                  <div v-if="paso.fecha" class="tl-fecha">{{ paso.fecha }}</div>
                  <div class="tl-desc">{{ paso.descripcion }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Resumen condiciones -->
          <div class="box">
            <div class="box-header">Condiciones de su reprogramación</div>
            <div class="resumen-row">
              <span class="lbl">Pie a pagar</span>
              <span class="val">{{ fmt(solicitud.pie) }}</span>
            </div>
            <div class="resumen-row">
              <span class="lbl">Total a reprogramar</span>
              <span class="val bold">{{ fmt(solicitud.totalReprogram) }}</span>
            </div>
            <div class="resumen-row">
              <span class="lbl">Plan de pago</span>
              <span class="val">{{ solicitud.cuotas }} cuotas anuales</span>
            </div>
            <div class="resumen-row">
              <span class="lbl">Cuota anual estimada</span>
              <span class="val green">{{ fmt(solicitud.cuotaAnual) }}</span>
            </div>
            <div class="resumen-row">
              <span class="lbl">Inicio de cobro</span>
              <span class="val">{{ new Date().getFullYear() + 1 }}</span>
            </div>
            <div class="resumen-row">
              <span class="lbl">Fecha límite proceso</span>
              <span class="val">{{ fechaLimite }}</span>
            </div>
            <div class="resumen-row last">
              <span class="lbl">Enviada a</span>
              <span class="val muted">reprogramacion@fscu.cl</span>
            </div>
          </div>

        </div>
      </template>
    </main>
  </AppLayout>
</template>