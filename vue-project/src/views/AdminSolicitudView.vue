<script setup>
import AdminLayout from '../components/AdminLayout.vue'
import '../assets/styles/admin.css'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route  = useRoute()
const router = useRouter()
const auth   = useAuthStore()

const loading    = ref(true)
const error      = ref(null)
const guardando  = ref(false)
const solicitud  = ref(null)

const nuevoEstado    = ref('')
const observaciones  = ref('')
const confirmarModal = ref(false)

async function cargarSolicitud() {
  loading.value = true
  error.value   = null
  try {
    const res = await fetch(`http://localhost:3000/api/solicitudes/${route.params.id}`)
    if (!res.ok) throw new Error('No se pudo cargar la solicitud')
    solicitud.value = await res.json()
    observaciones.value = solicitud.value.observaciones ?? ''
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(cargarSolicitud)

function fmt(n) {
  if (n == null) return '—'
  return '$' + Math.round(n).toLocaleString('es-CL')
}

function abrirModal(estado) {
  nuevoEstado.value    = estado
  confirmarModal.value = true
}

async function confirmarCambio() {
  guardando.value = true
  try {
    const res = await fetch(`http://localhost:3000/api/solicitudes/${route.params.id}/estado`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado:          nuevoEstado.value,
        observaciones:   observaciones.value,
        rut_funcionario: auth.rut,
      }),
    })
    if (!res.ok) throw new Error('Error al actualizar el estado')
   
    solicitud.value.estado        = nuevoEstado.value
    solicitud.value.observaciones = observaciones.value
    confirmarModal.value = false
  } catch (e) {
    alert('⚠️ ' + e.message)
  } finally {
    guardando.value = false
  }
}

const estadoInfo = computed(() => {
  const map = {
    PENDIENTE: { label: 'Pendiente',             cls: 'pendiente' },
    APROBADA:  { label: 'Aprobada',              cls: 'aprobada'  },
    RECHAZADA: { label: 'Rechazada',             cls: 'rechazada' },
    ACTIVADA:  { label: 'Reprogramación activa', cls: 'activada'  },
  }
  return map[solicitud.value?.estado] ?? map.PENDIENTE
})

const esPendiente = computed(() => solicitud.value?.estado === 'PENDIENTE')
const esAprobada  = computed(() => solicitud.value?.estado === 'APROBADA')

// Texto e ícono del modal según el estado a confirmar
const modalConfig = computed(() => {
  const map = {
    APROBADA:  {
      titulo: '✓ Aprobar solicitud',
      desc:   'Al aprobar, el deudor recibirá el pagaré e instrucciones de pago en su correo.',
    },
    RECHAZADA: {
      titulo: '✕ Rechazar solicitud',
      desc:   'Al rechazar, el deudor será notificado y la solicitud quedará cerrada.',
    },
    ACTIVADA:  {
      titulo: '⚡ Activar reprogramación',
      desc:   'Al activar, se confirmará que el deudor firmó el pagaré y realizó el pago del pie. La reprogramación quedará vigente.',
    },
  }
  return map[nuevoEstado.value] ?? map.APROBADA
})
</script>

<template>
  <AdminLayout>
    <main class="admin-main">

      <!-- Breadcrumb -->
      <div class="breadcrumb">
        <span class="breadcrumb-link" @click="router.push('/admin')">← Volver a solicitudes</span>
      </div>

      <!-- CARGANDO -->
      <div v-if="loading" class="state-box">
        <div class="spinner"></div><p>Cargando solicitud...</p>
      </div>

      <!-- ERROR -->
      <div v-else-if="error" class="state-box">
        <p class="state-error">⚠️ {{ error }}</p>
        <button class="retry-btn" @click="cargarSolicitud">Reintentar</button>
      </div>

      <template v-else-if="solicitud">

        <!-- Header -->
        <div class="sol-detail-header">
          <div>
            <h1 class="page-title">{{ solicitud.numero }}</h1>
            <p class="sol-detail-sub">Solicitud de reprogramación · {{ solicitud.fechaSolicitud }}</p>
          </div>
          <div class="header-actions">
            <span :class="['estado-badge', estadoInfo.cls]">
              <span class="estado-badge-dot"></span>{{ estadoInfo.label }}
            </span>

            <!-- Botones cuando está PENDIENTE -->
            <template v-if="esPendiente">
              <button class="btn-rechazar" @click="abrirModal('RECHAZADA')">✕ Rechazar</button>
              <button class="btn-aprobar"  @click="abrirModal('APROBADA')">✓ Aprobar</button>
            </template>

            <!-- Botón cuando está APROBADA (pie pagado + pagaré firmado) -->
            <template v-if="esAprobada">
              <button class="btn-activar" @click="abrirModal('ACTIVADA')">⚡ Activar reprogramación</button>
            </template>
          </div>
        </div>

        <div class="detail-grid">

          <!-- Col izquierda -->
          <div class="detail-col">

            <!-- Datos del deudor -->
            <div class="detail-box">
              <div class="detail-box-header">Datos del deudor</div>
              <div class="detail-row"><span class="detail-label">Nombre</span><span class="detail-value">{{ solicitud.nombre }}</span></div>
              <div class="detail-row"><span class="detail-label">RUT</span><span class="detail-value mono">{{ solicitud.rut }}</span></div>
              <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">{{ solicitud.email }}</span></div>
              <div class="detail-row"><span class="detail-label">Celular</span><span class="detail-value">{{ solicitud.celular }}</span></div>
              <div class="detail-row"><span class="detail-label">Dirección</span><span class="detail-value">{{ solicitud.direccion }}, {{ solicitud.comuna }}, {{ solicitud.region }}</span></div>
            </div>

            <!-- Condiciones -->
            <div class="detail-box">
              <div class="detail-box-header">Condiciones de la reprogramación</div>
              <div class="detail-row"><span class="detail-label">Capital adeudado</span><span class="detail-value mono">{{ fmt(solicitud.deudaCapital) }}</span></div>
              <div class="detail-row"><span class="detail-label">Intereses penales</span><span class="detail-value mono red">{{ fmt(solicitud.intereses) }}</span></div>
              <div class="detail-row"><span class="detail-label">Deuda total</span><span class="detail-value mono bold">{{ fmt(solicitud.deudaTotal) }}</span></div>
              <div class="detail-row"><span class="detail-label">Pie a pagar</span><span class="detail-value mono">{{ fmt(solicitud.pie) }} ({{ solicitud.pieUTM?.toFixed(1) }} UTM)</span></div>
              <div class="detail-row"><span class="detail-label">Condonación ({{ solicitud.pctCondonacion }}%)</span><span class="detail-value mono green">−{{ fmt(solicitud.montoCondonado) }}</span></div>
              <div class="detail-row"><span class="detail-label">Total a reprogramar</span><span class="detail-value mono blue bold">{{ fmt(solicitud.saldoReprogramar) }}</span></div>
              <div class="detail-row"><span class="detail-label">Plan de pago</span><span class="detail-value">{{ solicitud.plazoAnios }} cuotas anuales</span></div>
              <div class="detail-row"><span class="detail-label">Cuota anual estimada</span><span class="detail-value mono">{{ fmt(solicitud.cuotaAnual) }}</span></div>
              <div class="detail-row"><span class="detail-label">Fecha límite</span><span class="detail-value">{{ solicitud.fechaLimite }}</span></div>
            </div>

          </div>

          <!-- Col derecha -->
          <div class="detail-col">

            <!-- Observaciones -->
            <div class="detail-box">
              <div class="detail-box-header">Observaciones del funcionario</div>
              <div class="obs-wrap">
                <textarea
                  v-model="observaciones"
                  :disabled="!esPendiente"
                  :class="['obs-textarea', { readonly: !esPendiente }]"
                  placeholder="Escriba aquí sus observaciones antes de aprobar o rechazar..."
                  rows="6"
                ></textarea>
                <p class="obs-hint" v-if="!esPendiente && !observaciones">Sin observaciones registradas.</p>
              </div>
            </div>

            <!-- Estado actual (no pendiente y no aprobada-en-espera) -->
            <div v-if="!esPendiente && !esAprobada" class="detail-box">
              <div class="detail-box-header">Resolución</div>
              <div class="resolucion-body">
                <div :class="['resolucion-estado', solicitud.estado === 'ACTIVADA' ? 'aprobada' : 'rechazada']">
                  <span v-if="solicitud.estado === 'ACTIVADA'">⚡ Reprogramación activada</span>
                  <span v-else>✕ Solicitud rechazada</span>
                </div>
                <p v-if="solicitud.observaciones" class="resolucion-obs">{{ solicitud.observaciones }}</p>
              </div>
            </div>

            <!-- Aviso cuando está APROBADA esperando activación -->
            <div v-if="esAprobada" class="info-aviso info-aviso--activar">
              <strong>⚡ Pendiente de activación</strong><br>
              Esta solicitud fue aprobada. Una vez que el deudor firme el pagaré y realice el pago del pie,
              presione <strong>"Activar reprogramación"</strong> para completar el proceso.
            </div>

            <!-- Info plazo cuando está pendiente -->
            <div v-if="esPendiente" class="info-aviso">
              <strong>Fecha límite:</strong> {{ solicitud.fechaLimite }}<br>
              El deudor debe pagar el pie y firmar el pagaré antes de esta fecha.
              Si aprueba la solicitud, se le notificará automáticamente al deudor.
            </div>

          </div>
        </div>
      </template>

      <!-- MODAL CONFIRMACIÓN -->
      <div v-if="confirmarModal" class="modal-overlay" @click.self="confirmarModal = false">
        <div class="modal">
          <h2 class="modal-title">{{ modalConfig.titulo }}</h2>
          <p class="modal-desc">{{ modalConfig.desc }}</p>

          <div v-if="observaciones && nuevoEstado !== 'ACTIVADA'" class="modal-obs">
            <strong>Observaciones:</strong> {{ observaciones }}
          </div>

          <div class="modal-actions">
            <button class="btn-ghost-sm" @click="confirmarModal = false">Cancelar</button>
            <button
              :class="nuevoEstado === 'APROBADA' ? 'btn-aprobar' : nuevoEstado === 'ACTIVADA' ? 'btn-activar' : 'btn-rechazar'"
              :disabled="guardando"
              @click="confirmarCambio"
            >
              <span v-if="guardando">Guardando...</span>
              <span v-else-if="nuevoEstado === 'APROBADA'">Confirmar aprobación</span>
              <span v-else-if="nuevoEstado === 'ACTIVADA'">Confirmar activación</span>
              <span v-else>Confirmar rechazo</span>
            </button>
          </div>
        </div>
      </div>

    </main>
  </AdminLayout>
</template>