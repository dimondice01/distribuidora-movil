import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import React, { useCallback, useEffect, useState } from 'react'; // Importa useCallback
import {
    ActivityIndicator,
    Alert,
    RefreshControl // Importa RefreshControl
    ,

    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useData } from '../context/DataContext'; // Importa useData y la interfaz IDataContext
import { auth } from '../db/firebase-service';
import { COLORS } from '../styles/theme';

const HomeScreen = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false); // Estado para el RefreshControl
    // Obtén la función de refresco del contexto
    const { refreshAllData } = useData();

    // --- GUARDIÁN DE RUTA ---
    // Este useEffect asegura que solo un usuario logueado pueda ver esta pantalla.
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // Si hay un usuario, permite que la pantalla se muestre.
                setIsLoading(false);
            } else {
                // Si no hay usuario, lo expulsa al login.
                router.replace('/');
            }
        });
        // Limpia el listener al salir de la pantalla.
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            // El listener de arriba detectará el cambio y redirigirá.
        } catch (error) {
            console.error("Error al cerrar sesión: ", error);
            Alert.alert('Error', 'No se pudo cerrar la sesión.');
        }
    };

    // --- FUNCIÓN DE REFRESH ---
    const onRefresh = useCallback(async () => {
        // Verifica si la función existe antes de llamarla (buena práctica)
        if (typeof refreshAllData !== 'function') {
            console.warn("DataContext no proporciona la función refreshAllData.");
            Alert.alert('Funcionalidad no disponible', 'La actualización manual no está implementada en el contexto.');
            setIsRefreshing(false); // Asegúrate de detener el indicador
            return;
        }

        setIsRefreshing(true); // Muestra el indicador de carga
        try {
            // Llama a la función del DataContext para recargar los datos
            await refreshAllData();
            Alert.alert('Sincronizado', 'Los datos se actualizaron correctamente.');
        } catch (error) {
            console.error("Error durante la actualización de datos: ", error);
            Alert.alert('Error', 'No se pudieron actualizar los datos.');
        } finally {
            setIsRefreshing(false); // Oculta el indicador de carga
        }
    }, [refreshAllData]); // El array de dependencias incluye la función de refresco

    // Muestra pantalla de carga mientras se verifica la sesión.
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    // Muestra el contenido si la sesión es válida.
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
                refreshControl={ // Añade la prop refreshControl
                    <RefreshControl
                        refreshing={isRefreshing} // Controlado por el estado
                        onRefresh={onRefresh} // Función que se ejecuta al deslizar
                        tintColor={COLORS.primary} // Color del spinner (iOS)
                        colors={[COLORS.primary]} // Color del spinner (Android)
                    />
                }
            >
                {/* Contenido de la pantalla (botones de navegación) */}
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
                    {/* Puedes añadir más botones aquí si es necesario */}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

// --- ESTILOS (sin cambios respecto a la versión anterior) ---
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