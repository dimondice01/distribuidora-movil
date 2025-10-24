import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// --- CORRECCIÓN: Importar onAuthStateChanged y User ---
import { onAuthStateChanged, signInWithEmailAndPassword, User } from 'firebase/auth';
// --- CORRECCIÓN: Importar useEffect ---
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useData } from '../context/DataContext';
import { auth } from '../db/firebase-service';
import { COLORS } from '../styles/theme';

const LoginScreen = () => {
    const { syncData } = useData();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    // --- MEJORA: Estados de carga más descriptivos ---
    // 'loading' controla el overlay, 'loadingText' muestra el mensaje
    const [loading, setLoading] = useState(true); // Inicia en true para esperar a Firebase
    const [loadingText, setLoadingText] = useState('Verificando sesión...');

    // --- NUEVA FUNCIÓN: Manejo de Sesión Persistente y Sincronización ---
    useEffect(() => {
        // onAuthStateChanged es la forma OFICIAL de saber si Firebase
        // ha terminado de inicializar y si hay un usuario.
        // Se dispara al abrir la app y CADA VEZ que el usuario inicia o cierra sesión.
        const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
            if (user) {
                // --- Caso 1: Usuario LOGUEADO (sesión restaurada o login nuevo) ---
                
                // 1. Mostrar spinner de "Sincronizando"
                setLoading(true); 
                setLoadingText('Sincronizando datos...');
                
                try {
                    // 2. LLAMAR A SYNC DATA
                    await syncData();
                    
                    // 3. ¡Listo! El AuthProvider (en _layout.tsx)
                    // también recibió este evento `onAuthStateChanged`
                    // y él se encargará de la navegación a '/home'.
                    // No necesitamos hacer 'setLoading(false)' porque vamos a navegar
                    // a otra pantalla.
                    
                } catch (error) {
                    console.error("Error al sincronizar sesión existente:", error);
                    Alert.alert(
                        "Error de Sincronización", 
                        "No se pudieron cargar tus datos. Por favor, reinicia la app o intenta iniciar sesión de nuevo."
                    );
                    // Si falla la sincro, forzamos el cierre de sesión
                    // para que el usuario pueda re-intentar un login manual.
                    await auth.signOut();
                    setLoading(false); 
                }
            } else {
                // --- Caso 2: Usuario NO logueado (o cerró sesión) ---
                // No hay usuario. Dejamos que vea el formulario de login.
                setLoading(false);
                setLoadingText('');
            }
        });

        // Limpiamos el listener al desmontar el componente
        return () => unsubscribe();
        
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syncData]); // Se ejecuta si syncData cambia (aunque no debería)

    
    // --- FUNCIÓN DE LOGIN (Manual) ---
    const handleLogin = async () => {
        if (!email || !password) { 
            Alert.alert('Error', 'Por favor, ingrese email y contraseña.'); 
            return; 
        }
        
        setLoading(true); // Activa el overlay de carga
        setLoadingText('Iniciando sesión...'); // Mensaje de carga
        
        try {
            // 1. Solo inicia sesión.
            await signInWithEmailAndPassword(auth, email.trim(), password);
            
            // 2. ¡Éxito!
            // NO LLAMAMOS a syncData() aquí.
            // El listener `onAuthStateChanged` de arriba se disparará
            // automáticamente y será ÉL quien llame a syncData().
            // Esto evita llamar a syncData() dos veces.
            
        } catch (error: any) {
            console.error("Error en handleLogin:", error.code);
            let message = 'Email o contraseña incorrectos.';
            if (error.code === 'auth/network-request-failed') {
                message = 'Error de red. Revisa tu conexión a internet.';
            }
            
            Alert.alert('Error de Login', message);
            setLoading(false); // Liberamos el formulario SÓLO si hay error
            setLoadingText('');
        }
    };
    
    // --- MEJORA: Overlay de carga a pantalla completa ---
    // Si 'loading' es true, mostramos un overlay.
    // Esto cubre la espera de Firebase al inicio Y el login manual.
    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={COLORS.backgroundStart} />
                <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>{loadingText}</Text>
            </View>
        );
    }
    
    // --- Pantalla de Login (si no está cargando) ---
    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.backgroundStart} />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
            
            <View style={styles.headerContainer}>
                {/* Puedes poner tu logo aquí */}
                <Feather name="truck" size={60} color={COLORS.primary} />
                <Text style={styles.title}>Distribuidora</Text>
                <Text style={styles.subtitle}>Inicio de Sesión Vendedores</Text>
            </View>

            <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                    <Feather name="mail" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={COLORS.textSecondary}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                    />
                </View>
                <View style={styles.inputContainer}>
                    <Feather name="lock" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Contraseña"
                        placeholderTextColor={COLORS.textSecondary}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoComplete="current-password"
                    />
                </View>
                
                <TouchableOpacity 
                    style={styles.button} 
                    onPress={handleLogin}
                >
                    {/* El botón ya no necesita spinner, el overlay se encarga */}
                    <Text style={styles.buttonText}>Iniciar Sesión</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundEnd, padding: 20 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, height: '100%' },
    
    headerContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: { fontSize: 42, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 10 },
    subtitle: { fontSize: 18, color: COLORS.textSecondary },

    formContainer: { width: '100%' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder, paddingHorizontal: 15, marginBottom: 15, height: 58 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: COLORS.textPrimary, fontSize: 16 },
    button: { marginTop: 10, backgroundColor: COLORS.primary, padding: 18, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
    
    // --- ESTILO MOVIDO: Ya no está deshabilitado, el overlay lo bloquea ---
    // buttonDisabled: { backgroundColor: COLORS.disabled }, 
    
    buttonText: { color: COLORS.primaryDark, fontSize: 18, fontWeight: 'bold' },

    // --- NUEVO ESTILO: Texto de carga para el overlay ---
    loadingText: {
        marginTop: 15,
        color: COLORS.textSecondary,
        fontSize: 16,
        fontWeight: '500'
    }
});

export default LoginScreen;