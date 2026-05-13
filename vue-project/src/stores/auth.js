import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {

  // Carga el usuario desde localStorage al iniciar
  const usuario = ref(JSON.parse(localStorage.getItem('usuario')) || null)

  const nombre  = computed(() => usuario.value?.nombre  ?? 'Usuario')
  const rut     = computed(() => usuario.value?.rut     ?? '')
  const tipo    = computed(() => usuario.value?.tipo     ?? '')

  function setUsuario(data) {
    usuario.value = data
    localStorage.setItem('usuario', JSON.stringify(data))
  }

  function logout() {
    usuario.value = null
    localStorage.removeItem('usuario')
  }

  return { usuario, nombre, rut, tipo, setUsuario, logout }
})