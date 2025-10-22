// Paleta de colores clara y profesional con acentos amarillos.

export const COLORS = {
  // Fondo: Blanco o un gris muy claro para máxima limpieza.
  backgroundStart: '#FFFFFF', // Blanco puro
  backgroundEnd: '#F7F7F7',   // Un gris muy sutil

  // Color Primario: Un amarillo cálido pero profesional.
  primary: '#FFC107',       // Amarillo ámbar (similar al de advertencia, pero lo usamos como principal)
  primaryDark: '#B8860B',   // Un amarillo más oscuro/dorado para contraste o énfasis

  // Texto: Tonos oscuros para legibilidad sobre fondo claro.
  textPrimary: '#1A202C',    // Casi negro (Gris oscuro azulado)
  textSecondary: '#718096',   // Gris medio

  // Blanco (para textos sobre fondos oscuros o de color)
  white: '#FFFFFF',

  // Componentes "Glass" adaptados a tema claro: Sutiles grises transparentes.
  // Podrías ajustar la opacidad según prefieras.
  glass: 'rgba(240, 240, 240, 0.6)', // Gris claro semi-transparente
  glassBorder: 'rgba(200, 200, 200, 0.4)', // Borde gris más sutil

  // Colores de Estado: Mantenemos los estándar, buen contraste en fondo claro.
  success: '#28A745',       // Verde éxito
  warning: '#FFA000',       // Naranja/Amarillo advertencia (un poco más naranja que el primario)
  danger: '#DC3545',        // Rojo peligro
  disabled: '#A0AEC0',      // Gris claro para elementos deshabilitados (similar a textSecondary)
};

// NOTA:
// - primaryDark ahora es un amarillo oscuro. Asegúrate de que los textos sobre él sean blancos (COLORS.white).
// - textPrimary y textSecondary son oscuros para leerse bien sobre backgroundStart/End.
// - Los colores 'glass' ahora son claros/grises. El texto DENTRO de componentes glass deberá ser oscuro (textPrimary/textSecondary).