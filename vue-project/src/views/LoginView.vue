<script setup>
import { ref } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "../stores/auth"
import "../assets/styles/login.css"

const rut      = ref("")
const password = ref("")
const router   = useRouter()
const auth     = useAuthStore()

async function login() {
  const res = await fetch("http://localhost:3000/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rut:      rut.value,
      password: password.value,
    }),
  })

  const data = await res.json()

  if (data.success) {
    auth.setUsuario({
      rut:    data.rut,
      nombre: data.nombre,
      tipo:   data.tipo,
    })
    router.push(data.tipo === "admin" ? "/admin" : "/usuario")
  } else {
    alert("Usuario no encontrado")
  }
}
</script>

<template>
  <div class="login-container">
    <h2>Login</h2>
    <input v-model="rut"      placeholder="Ingrese RUT" />
    <input v-model="password" type="password" placeholder="Ingrese clave" />
    <button @click="login">Ingresar</button>
  </div>
</template>