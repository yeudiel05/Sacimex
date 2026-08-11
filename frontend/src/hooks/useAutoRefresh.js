// frontend/src/hooks/useAutoRefresh.js
// Hook reutilizable para polling automático.
// Llama a `callback` cada `intervalo` ms mientras la pestaña esté visible.
// Se pausa cuando el usuario cambia de pestaña para no hacer requests innecesarios.

import { useEffect, useRef, useCallback } from 'react';

/**
 * @param {Function} callback  — función async a ejecutar (normalmente fetchDatos)
 * @param {number}   intervalo — milisegundos entre cada llamada (default 15000 = 15s)
 * @param {boolean}  activo    — si false, pausa el polling (útil cuando hay un modal abierto)
 */
const useAutoRefresh = (callback, intervalo = 15000, activo = true) => {
  const timerRef    = useRef(null);
  const callbackRef = useRef(callback);

  // Mantener la referencia del callback actualizada sin reiniciar el timer
  useEffect(() => { callbackRef.current = callback; }, [callback]);

  const iniciar = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      // Solo refrescar si la pestaña está visible
      if (document.visibilityState === 'visible') {
        callbackRef.current();
      }
    }, intervalo);
  }, [intervalo]);

  const detener = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!activo) { detener(); return; }

    iniciar();

    // Pausar cuando la pestaña se oculta, reanudar cuando vuelve
    const handleVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        callbackRef.current(); // refrescar inmediatamente al volver
        iniciar();
      } else {
        detener();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilidad);
    return () => {
      detener();
      document.removeEventListener('visibilitychange', handleVisibilidad);
    };
  }, [activo, iniciar, detener]);
};

export default useAutoRefresh;