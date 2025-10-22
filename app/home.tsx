import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useData } from '../context/DataContext'; // Assuming this path is correct
import { auth } from '../db/firebase-service';
import { COLORS } from '../styles/theme';

// Define a basic type for context, acknowledging refreshAllData might exist
// Ideally, you should import the actual IDataContext type from your context file
interface IDataContextWithRefresh {
    refreshAllData?: () => Promise<void>; // Make it optional for safety
    // Include other properties from your actual IDataContext here
    [key: string]: any; // Allows for other properties not explicitly defined
}


const HomeScreen = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    // Use the potentially enhanced context type
    const { refreshAllData } = useData() as IDataContextWithRefresh; // Cast to include refreshAllData

    // --- GUARDIÁN DE RUTA ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setIsLoading(false);
            } else {
                router.replace('/');
            }
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error during logout: ", error);
            Alert.alert('Error', 'No se pudo cerrar la sesión.');
        }
    };

    // --- FUNCIÓN DE REFRESH ---
    const onRefresh = useCallback(async () => {
        // Check if the function exists before calling it
        if (typeof refreshAllData !== 'function') {
            console.warn("DataContext does not provide refreshAllData function.");
            Alert.alert('Funcionalidad no disponible', 'La actualización manual no está implementada.');
            setIsRefreshing(false); // Ensure refreshing indicator stops
            return;
        }

        setIsRefreshing(true);
        try {
            await refreshAllData();
            Alert.alert('Sincronizado', 'Los datos se actualizaron correctamente.');
        } catch (error) {
            console.error("Error during data refresh: ", error);
            Alert.alert('Error', 'No se pudieron actualizar los datos.');
        } finally {
            setIsRefreshing(false);
        }
    }, [refreshAllData]); // Dependency array still includes the potentially undefined function

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

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

            {/* --- SCROLLVIEW CON REFRESH CONTROL --- */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
                        colors={[COLORS.primary]}
                    />
                }
            >
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
                    {/* Puedes añadir más botones si es necesario */}
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
        paddingTop: 20, // Ajustado para SafeAreaView
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
        paddingBottom: 20, // Añadir padding al final si es necesario
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    gridButton: {
        width: '48%', // Asegura 2 columnas
        aspectRatio: 1, // Mantiene el botón cuadrado
        backgroundColor: COLORS.glass,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '4%', // Espacio entre filas
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