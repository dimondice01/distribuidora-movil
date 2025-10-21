import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../db/firebase-service';
import { COLORS } from '../styles/theme';

const HomeScreen = () => {
    const [isLoading, setIsLoading] = useState(true);

    // --- GUARDIÁN DE RUTA ---
    // Este useEffect se asegura de que solo un usuario logueado pueda ver esta pantalla.
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // Si hay un usuario, permitimos que la pantalla se muestre.
                setIsLoading(false);
            } else {
                // Si no hay usuario (sesión cerrada o expirada), lo expulsamos al login.
                router.replace('/');
            }
        });
        // Limpiamos el listener al salir de la pantalla para evitar fugas de memoria.
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            // El listener de arriba detectará el cambio y redirigirá automáticamente.
        } catch (error) {
            console.error("Error during logout: ", error);
            Alert.alert('Error', 'No se pudo cerrar la sesión.');
        }
    };

    // Mientras se verifica la sesión, mostramos una pantalla de carga.
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    // Si la sesión es válida, mostramos el contenido de la pantalla.
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={[COLORS.backgroundStart, COLORS.backgroundEnd]}
                style={styles.background}
            />
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hola,</Text>
                    <Text style={styles.userName}>{auth.currentUser?.email?.split('@')[0] || 'Vendedor'} 👋</Text>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                    <Feather name="log-out" size={22} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.gridContainer}>
                    <Link href="/select-client-for-sale" asChild>
                        <TouchableOpacity style={styles.gridButton}>
                            <Feather name="shopping-cart" size={32} color={COLORS.primary} />
                            <Text style={styles.gridButtonText}>Crear Venta</Text>
                        </TouchableOpacity>
                    </Link>
                    <Link href="/client-map" asChild>
                        <TouchableOpacity style={styles.gridButton}>
                            <Feather name="map" size={32} color={COLORS.primary} />
                            <Text style={styles.gridButtonText}>Ver Mapa</Text>
                        </TouchableOpacity>
                    </Link>
                    <Link href="/client-list" asChild>
                        <TouchableOpacity style={styles.gridButton}>
                            <Feather name="users" size={32} color={COLORS.primary} />
                            <Text style={styles.gridButtonText}>Mis Clientes</Text>
                        </TouchableOpacity>
                    </Link>
                    <Link href="/add-client" asChild>
                        <TouchableOpacity style={styles.gridButton}>
                            <Feather name="user-plus" size={32} color={COLORS.primary} />
                            <Text style={styles.gridButtonText}>Añadir Cliente</Text>
                        </TouchableOpacity>
                    </Link>
                    <Link href="/reports" asChild>
                        <TouchableOpacity style={styles.gridButton}>
                            <Feather name="pie-chart" size={32} color={COLORS.primary} />
                            <Text style={styles.gridButtonText}>Reportes</Text>
                        </TouchableOpacity>
                    </Link>
                    <Link href="/promotions" asChild>
                        <TouchableOpacity style={styles.gridButton}>
                            <Feather name="star" size={32} color={COLORS.primary} />
                            <Text style={styles.gridButtonText}>Promociones</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.backgroundEnd,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 20,
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    greeting: {
        fontSize: 20,
        color: COLORS.textSecondary,
    },
    userName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    logoutButton: {
        padding: 12,
        backgroundColor: COLORS.glass,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    scrollContent: {
        paddingHorizontal: 15,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    gridButton: {
        width: '48%',
        aspectRatio: 1,
        backgroundColor: COLORS.glass,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '4%',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    gridButtonText: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
});

export default HomeScreen;