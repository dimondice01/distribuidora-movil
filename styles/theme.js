// Paleta de colores de vanguardia: Ligera, energética (amarillo) y de alto contraste.

export const COLORS = {
  // Fondo: Blanco y un gris "hueso" muy claro para una sensación limpia y moderna.
  backgroundStart: '#e3ebffff', // Blanco puro
  backgroundEnd: '#cbb0f7ff',   // Un gris casi blanco, muy sutil

  // Color Primario: Un amarillo vibrante y moderno, no un ámbar estándar.
  primary: '#FDE047',       // Amarillo "Limón" vibrante (Tailwind 'yellow-400')
  
  // Contraste Primario: Un color oscuro para el texto DENTRO de los botones primarios.
  // Usamos un gris/azul muy oscuro para máximo contraste sobre el amarillo.
  primaryDark: '#1E293B',   // Azul/Gris oscuro (Tailwind 'slate-800')

  // Texto: Tonos de gris muy oscuros para una legibilidad nítida.
  textPrimary: '#000000ff',    // Casi negro, muy contrastado (Tailwind 'gray-900')
  textSecondary: '#404550ff',   // Gris medio, legible (Tailwind 'gray-500')

  // Blanco (para textos sobre fondos oscuros o de color)
  white: '#FFFFFF',

  // Componentes "Glass": Un efecto "esmerilado" limpio y moderno.
  glass: 'rgba(250, 250, 250, 0.75)', // Un blanco "hueso" semi-transparente
  glassBorder: 'rgba(229, 231, 235, 0.6)', // Un borde gris claro sutil

  // Colores de Estado: Estándar para usabilidad, buen contraste en fondo claro.
  success: '#22C55E',       // Verde éxito (más vibrante)
  warning: '#F59E0B',       // Naranja/Ámbar advertencia
  danger: '#EF4444',        // Rojo peligro (más vibrante)
  disabled: '#9CA3AF',      // Gris para elementos deshabilitados (Tailwind 'gray-400')
};

// NOTA DE IMPLEMENTACIÓN:
// - 'primary' es el fondo de los botones principales.
// - 'primaryDark' es el color del texto para esos botones (ej. "Revisar Venta").
// - 'textPrimary' y 'textSecondary' son los colores de texto para la app en general.
// - Los componentes 'glass' ahora son más claros y "esmerilados".