<script setup>
import AdminLayout from '../components/AdminLayout.vue'
import '../assets/styles/admin.css'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const loading     = ref(true)
const error       = ref(null)
const solicitudes = ref([])

async function cargarSolicitudes() {
  loading.value = true
  error.value   = null
  try {
    const res = await fetch('http://localhost:3000/api/solicitudes')
    if (!res.ok) throw new Error('No se pudieron cargar las solicitudes')
    solicitudes.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(cargarSolicitudes)

// ── FECHA LÍMITE: último día del mes actual ──
const fechaLimite = computed(() => {
  const hoy = new Date()
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  const dd  = String(ultimoDia.getDate()).padStart(2, '0')
  const mm  = String(ultimoDia.getMonth() + 1).padStart(2, '0')
  const aaaa = ultimoDia.getFullYear()
  return `${dd}/${mm}/${aaaa}`
})




const pendientes = computed(() => solicitudes.value.filter(s => s.estado === 'Pendiente').length)
const aprobadas  = computed(() => solicitudes.value.filter(s => s.estado === 'Aprobada').length)
const rechazadas = computed(() => solicitudes.value.filter(s => s.estado === 'Rechazada').length)

function fmt(n) { return '$' + Math.round(n).toLocaleString('es-CL') }

function revisar(id)    { router.push(`/admin/solicitud/${id}`) }
function verDetalle(id) { router.push(`/admin/solicitud/${id}`) }
</script>

<template>
  <AdminLayout>
    <main class="admin-main">

      <div class="admin-topbar">
        <h1 class="page-title">Solicitudes de reprogramación</h1>
        <div class="contadores">
          <div class="contador">
            <span class="contador-n pendiente">{{ pendientes }}</span>
            <span class="contador-lbl">Pendientes</span>
          </div>
          <div class="contador">
            <span class="contador-n aprobada">{{ aprobadas }}</span>
            <span class="contador-lbl">Aprobadas</span>
          </div>
          <div class="contador">
            <span class="contador-n rechazada">{{ rechazadas }}</span>
            <span class="contador-lbl">Rechazadas</span>
          </div>
        </div>
      </div>

      <!-- CARGANDO -->
      <div v-if="loading" class="state-box">
        <div class="spinner"></div>
        <p>Cargando solicitudes...</p>
      </div>

      <!-- ERROR -->
      <div v-else-if="error" class="state-box">
        <p class="state-error">⚠️ {{ error }}</p>
        <button class="retry-btn" @click="cargarSolicitudes">Reintentar</button>
      </div>

      <!-- SIN SOLICITUDES -->
      <div v-else-if="solicitudes.length === 0" class="state-box">
        <p>No hay solicitudes registradas aún.</p>
      </div>

      <!-- TABLA -->
      <div v-else class="table-box">
        <table class="sol-table">
          <thead>
            <tr>
              <th>RUT deudor</th>
              <th>Nombre</th>
              <th>Total deuda</th>
              <th>Pie</th>
              <th>F. solicitud</th>
              <th>F. límite</th>
              <th>Estado</th>
              <th>Acción</th>
              
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in solicitudes" :key="s.id">
              <td class="rut-cell">{{ s.rut }}</td>
              <td>{{ s.nombre }}</td>
              <td class="mono">{{ fmt(s.totalDeuda) }}</td>
              <td class="mono">{{ fmt(s.pie) }}</td>
              <td class="mono">{{ s.fechaEnvio }}</td> 
              <td class="mono">{{ fechaLimite }}</td>
             
              <td>
                <span :class="['estado-badge', s.estado.toLowerCase()]">{{ s.estado }}</span>
              </td>
              <td>
                <button v-if="s.estado === 'Pendiente'" class="btn-revisar" @click="revisar(s.id)">Revisar</button>
                <button v-else class="btn-detalle" @click="verDetalle(s.id)">Ver detalle</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </main>
  </AdminLayout>
</template>