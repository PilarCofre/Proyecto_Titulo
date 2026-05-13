<script setup>
import AppLayout from '../components/AppLayout.vue'
import '../assets/styles/usuario.css'
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const loading = ref(true)
const error   = ref(null)
const resumen = ref(null)
const detalle = ref([])
const utm     = ref(68310)

async function cargarDeuda() {
  loading.value = true
  error.value   = null
  try {
    const res  = await fetch(`http://localhost:3000/api/deudas/${auth.rut}`)
    const data = await res.json()
    if (!data.ok) throw new Error(data.error ?? 'Error al cargar deuda')
    resumen.value = data.resumen[0] ?? null
    detalle.value = data.detalle   ?? []
    utm.value     = data.utm       ?? 68310
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(cargarDeuda)

// Formatea número con 3 decimales (valores en UTM)
function fmt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('es-CL', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  })
}

// ESTADO_MOROSIDAD = 1 (número) → puede reprogramar
const puedeReprogramar = computed(() =>
  detalle.value.some(d =>
    d.ESTADO_MOROSIDAD === 1 || String(d.ESTADO_MOROSIDAD).trim() === '1'
  )
)

const esMoroso = computed(() =>
  detalle.value.some(d => d.ESTADO_MORA === 'MOROSO')
)

// Primer detalle para campos fijos del crédito
const det = computed(() => detalle.value[0] ?? {})

// Total deuda general = capital vencido + intereses + cuotas futuras
const totalDeudaGeneral = computed(() => {
  if (!resumen.value) return 0
  return (resumen.value.DEUDA_CAPITAL      ?? 0) +
         (resumen.value.SALDO_PENAL        ?? 0) +
         (resumen.value.TOTAL_SALDO_CUOTAS ?? 0)
})
</script>

<template>
  <AppLayout>
    <main>
      <h1 class="page-title">Resumen de mi deuda</h1>

      <!-- CARGANDO -->
      <div v-if="loading" class="state-box">
        <div class="spinner"></div>
        <p>Cargando información...</p>
      </div>

      <!-- ERROR -->
      <div v-else-if="error" class="state-box">
        <p class="state-error">⚠️ {{ error }}</p>
        <button class="retry-btn" @click="cargarDeuda">Reintentar</button>
      </div>

      <!-- SIN DEUDA -->
      <div v-else-if="!resumen" class="state-box">
        <p>✅ No se encontraron deudas asociadas a su RUT.</p>
      </div>

      <!-- DATOS REALES -->
      <template v-else>

        <!-- DEUDA_CAPITAL = cuotas vencidas (≤ año actual)           -->
        <!-- SALDO_PENAL   = intereses penales acumulados              -->
        <!-- TOTAL_SALDO_CUOTAS = cuotas futuras (> año actual)       -->
        <div class="summary-cards">
          <div class="card">
            <div class="card-label">Capital adeudado</div>
            <div class="card-value">{{ fmt(resumen.DEUDA_CAPITAL) }}</div>
          </div>
          <div class="card">
            <div class="card-label">Intereses penales</div>
            <div class="card-value red">{{ fmt(resumen.SALDO_PENAL) }}</div>
          </div>
          <div class="card">
            <div class="card-label">Cuotas futuras</div>
            <div class="card-value">{{ fmt(resumen.TOTAL_SALDO_CUOTAS) }}</div>
          </div>
          <div class="card">
            <div class="card-label">Total deuda</div>
            <div class="card-value bold">{{ fmt(resumen.TOTAL_DEUDA_GENERAL ?? totalDeudaGeneral) }}</div>
          </div>
        </div>

        <div class="detail-box">
          <div class="detail-box-header">Detalle del crédito</div>

          <div class="detail-row">
            <span class="detail-label">Acreedor</span>
            <span class="detail-value">Universidad de Concepción</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Año inicio cobranza</span>
            <span class="detail-value">{{ det.AGNO_DEUDA_EXIGIBLE ?? '—' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">N° cuotas originales</span>
            <span class="detail-value">
              {{ det.NRO_CUOTAS != null ? det.NRO_CUOTAS + ' anuales' : '—' }}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Meses en mora</span>
            <span class="detail-value">{{ det.MESES_MOROSOS ?? '—' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Estado</span>
            <span v-if="esMoroso" class="badge moroso">Moroso</span>
            <span v-else          class="badge cumple">Al día</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Elegible reprogramación</span>
            <span v-if="puedeReprogramar" class="badge cumple">Sí, cumple requisitos</span>
            <span v-else                  class="badge moroso">No cumple requisitos</span>
          </div>
        </div>

        <button
          v-if="puedeReprogramar"
          class="cta-btn"
          @click="$router.push('/simulador')"
        >
          Continuar al simulador de reprogramación
          <span class="cta-arrow">→</span>
        </button>

      </template>
    </main>
  </AppLayout>
</template>