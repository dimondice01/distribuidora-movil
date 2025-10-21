import { useNetInfo } from '@react-native-community/netinfo';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OfflineIndicator = () => {
  const netInfo = useNetInfo();
  // Este hook es para que la barra no se ponga debajo del "notch" o la isla dinámica del iPhone
  const insets = useSafeAreaInsets(); 

  // Solo mostraremos la barra si sabemos con certeza que no hay conexión.
  if (netInfo.type !== 'unknown' && netInfo.isConnected === false) {
    return (
      <Animated.View 
        style={[styles.container, { paddingTop: insets.top + 5, paddingBottom: 10 }]}
        entering={FadeInUp.duration(500)} // Animación de entrada
        exiting={FadeOutUp.duration(500)}  // Animación de salida
      >
        <Text style={styles.text}>Modo Offline - Los cambios se guardarán localmente</Text>
      </Animated.View>
    );
  }

  // Si hay conexión, no mostramos nada.
  return null;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F59E0B', // Un color ámbar de advertencia
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000, // Nos aseguramos de que siempre esté por encima de todo
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default OfflineIndicator;