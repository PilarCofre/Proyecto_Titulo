<script setup>
import { ref } from "vue"

const rut = ref("")
const deudas = ref([])

async function buscarDeuda() {
  const res = await fetch(`http://localhost:3000/api/deuda/${rut.value}`)
  deudas.value = await res.json()
}
</script>

<template>
  <h1>Consulta de Deuda</h1>

  <input v-model="rut" placeholder="Ingresa tu RUT" />

  <button @click="buscarDeuda">
    Buscar
  </button>

  <div v-if="deudas.length > 0">
    <h2>Resultados:</h2>

    <ul>
      <li v-for="d in deudas" :key="d[0]">
        Código: {{ d[0] }} — Monto: ${{ d[1] }}
      </li>
    </ul>
  </div>

  <div v-else>
    <p>No hay resultados</p>
  </div>
</template>