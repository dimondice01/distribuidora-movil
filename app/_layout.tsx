// app/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';
import Toast from 'react-native-toast-message';
import { DataProvider } from '../context/DataContext';
import { RouteProvider } from '../context/RouteContext';

// Este layout ahora solo provee los contextos de datos y el navegador.
export default function RootLayout() {
  return (
    <DataProvider>
        <RouteProvider>
            <Stack screenOptions={{ headerShown: false }} />
            <Toast />
        </RouteProvider>
    </DataProvider>
  );
}