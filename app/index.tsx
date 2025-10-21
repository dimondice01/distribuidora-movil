// app/index.tsx
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useData } from '../context/DataContext';
import { auth, db } from '../db/firebase-service';
import { COLORS } from '../styles/theme';

const LoginScreen = () => {
    const { syncData } = useData();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    const handleLogin = async () => {
        if (!email || !password) { Alert.alert('Error', 'Por favor, ingrese email y contraseña.'); return; }
        setLoading(true);
        try {
            setLoadingMessage('Autenticando...');
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // --- Lógica de rol directamente aquí ---
            const userDocRef = doc(db, 'vendedores', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                throw new Error("Datos de usuario no encontrados en la base de datos.");
            }
            const rango = userDocSnap.data().rango;
            
            setLoadingMessage('Sincronizando datos...');
            await syncData();

            // --- Redirección directa y explícita ---
            if (rango === 'Reparto') {
                router.replace('/driver');
            } else {
                router.replace('/home');
            }

        } catch (error: any) {
            console.error("Login Failed:", error.message);
            Alert.alert('Error', 'Credenciales incorrectas o problema de red.');
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
            <Feather name="key" size={60} color={COLORS.primary} />
            <Text style={styles.title}>La Llave</Text>
            <Text style={styles.subtitle}>Acceso de Personal</Text>

            <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                    <Feather name="at-sign" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Email" placeholderTextColor={COLORS.textSecondary} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} editable={!loading} />
                </View>
                <View style={styles.inputContainer}>
                    <Feather name="lock" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor={COLORS.textSecondary} secureTextEntry value={password} onChangeText={setPassword} editable={!loading} />
                </View>

                <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
                    {loading ? (
                        <><ActivityIndicator color={COLORS.primaryDark} /><Text style={styles.loadingText}>{loadingMessage}</Text></>
                    ) : (
                        <Text style={styles.buttonText}>Iniciar Sesión</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};


const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundEnd, padding: 20 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, height: '100%' },
    title: { fontSize: 48, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 10 },
    subtitle: { fontSize: 18, color: COLORS.textSecondary, marginBottom: 40 },
    formContainer: { width: '100%' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder, paddingHorizontal: 15, marginBottom: 15, height: 58 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: COLORS.textPrimary, fontSize: 16 },
    button: { marginTop: 10, backgroundColor: COLORS.primary, padding: 18, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
    buttonDisabled: { backgroundColor: COLORS.disabled },
    buttonText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 18 },
    loadingText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 16 },
});

export default LoginScreen;