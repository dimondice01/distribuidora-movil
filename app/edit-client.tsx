import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useData } from '../context/DataContext'; // <-- 1. IMPORTAMOS EL ALMACÉN
import { db } from '../db/firebase-service';
import { COLORS } from '../styles/theme'; // <-- 2. IMPORTAMOS EL TEMA

interface LocationCoords { latitude: number; longitude: number; }

const EditClientScreen = () => {
    const { clientId } = useLocalSearchParams();
    
    // Obtenemos los datos maestros desde nuestro almacén local
    const { clients, availableZones } = useData();

    // Buscamos el cliente a editar en los datos locales (instantáneo)
    const clientToEdit = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);

    // Estados del formulario, inicializados vacíos
    const [nombre, setNombre] = useState('');
    const [direccion, setDireccion] = useState('');
    const [barrio, setBarrio] = useState('');
    const [localidad, setLocalidad] = useState('');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');
    const [zonaId, setZonaId] = useState('');
    const [location, setLocation] = useState<LocationCoords | null>(null);
    const [loading, setLoading] = useState(false); // Solo para el guardado

    // Estados del mapa
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [mapLoading, setMapLoading] = useState(false);
    const [initialRegion, setInitialRegion] = useState({ latitude: -29.4134, longitude: -66.8569, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });

    // --- 3. REFACTORIZACIÓN: useEffect para llenar el formulario ---
    // Este efecto se ejecuta solo una vez cuando encontramos al cliente
    useEffect(() => {
        if (clientToEdit) {
            setNombre(clientToEdit.nombre || '');
            setDireccion(clientToEdit.direccion || '');
            setBarrio(clientToEdit.barrio || '');
            setLocalidad(clientToEdit.localidad || '');
            setTelefono(clientToEdit.telefono || '');
            setEmail(clientToEdit.email || '');
            setZonaId(clientToEdit.zonaId || '');
            setLocation(clientToEdit.location || null);
            if (clientToEdit.location) {
                setInitialRegion(prev => ({ ...prev, ...clientToEdit.location }));
            }
        }
    }, [clientToEdit]);

    // --- 4. ¡HEMOS ELIMINADO LOS useEffect DE CARGA DE DATOS! ---

    const handleOpenMap = async () => { /* Lógica del mapa (sin cambios) */ };
    
    const handleUpdateClient = async () => {
        if (!clientId) return;
        setLoading(true);
        try {
            const clientRef = doc(db, 'clientes', clientId as string);
            await updateDoc(clientRef, {
                nombre, direccion, barrio, localidad, telefono, email, zonaId,
                location: location ? { latitude: location.latitude, longitude: location.longitude } : null,
            });
            Alert.alert('Éxito', 'Cliente actualizado correctamente.');
            router.back();
        } catch (error) {
            console.error("Error updating client: ", error);
            Alert.alert('Error', 'No se pudo actualizar el cliente.');
        } finally {
            setLoading(false);
        }
    };

    if (!clientToEdit) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Editar Cliente</Text>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContentContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.formContainer}>
                    <View style={styles.inputContainer}><Feather name="user" size={20} color={COLORS.textSecondary} style={styles.inputIcon} /><TextInput placeholder="Nombre del Cliente" value={nombre} onChangeText={setNombre} style={styles.input} placeholderTextColor={COLORS.textSecondary} /></View>
                    <View style={styles.inputContainer}><Feather name="map-pin" size={20} color={COLORS.textSecondary} style={styles.inputIcon} /><TextInput placeholder="Dirección" value={direccion} onChangeText={setDireccion} style={styles.input} placeholderTextColor={COLORS.textSecondary} /></View>
                    <View style={styles.inputContainer}><Feather name="compass" size={20} color={COLORS.textSecondary} style={styles.inputIcon} /><TextInput placeholder="Barrio" value={barrio} onChangeText={setBarrio} style={styles.input} placeholderTextColor={COLORS.textSecondary} /></View>
                    <View style={styles.inputContainer}><Feather name="map" size={20} color={COLORS.textSecondary} style={styles.inputIcon} /><TextInput placeholder="Localidad" value={localidad} onChangeText={setLocalidad} style={styles.input} placeholderTextColor={COLORS.textSecondary} /></View>
                    <View style={styles.inputContainer}><Feather name="phone" size={20} color={COLORS.textSecondary} style={styles.inputIcon} /><TextInput placeholder="Teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" style={styles.input} placeholderTextColor={COLORS.textSecondary} /></View>
                    <View style={styles.inputContainer}><Feather name="at-sign" size={20} color={COLORS.textSecondary} style={styles.inputIcon} /><TextInput placeholder="Email (Opcional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} placeholderTextColor={COLORS.textSecondary} /></View>
                    
                    <View style={styles.pickerContainer}>
                        <Feather name="navigation" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                        <Picker selectedValue={zonaId} onValueChange={(v) => setZonaId(v)} style={styles.picker} dropdownIconColor={COLORS.primary}>
                            <Picker.Item label="Seleccione una Zona..." value="" color={COLORS.primaryDark} />
                            {availableZones.map((z) => <Picker.Item key={z.id} label={z.nombre} value={z.id} color={COLORS.primaryDark} />)}
                        </Picker>
                    </View>

                    <TouchableOpacity style={styles.locationButton} onPress={handleOpenMap}>
                        <Feather name={location ? "check-circle" : "plus-circle"} size={20} color={COLORS.primary} />
                        <Text style={styles.locationButtonText}>{location ? 'Modificar Ubicación' : 'Añadir Ubicación'}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={handleUpdateClient} style={[styles.button, loading && styles.buttonDisabled]} disabled={loading}>
                        {loading ? <ActivityIndicator color={COLORS.primaryDark} /> : <Text style={styles.buttonText}>Guardar Cambios</Text>}
                    </TouchableOpacity>
                </View>
            </ScrollView>
            <Modal visible={isMapVisible} animationType="slide" onRequestClose={() => setIsMapVisible(false)}>
                {/* ... (Modal del mapa, ya usa los estilos del tema) ... */}
            </Modal>
        </KeyboardAvoidingView>
    );
};

// --- ESTILOS ACTUALIZADOS CON EL TEMA ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundEnd },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, position: 'relative' },
    backButton: { position: 'absolute', left: 20, top: 60, padding: 10 },
    title: { fontSize: 28, fontWeight: 'bold', color: COLORS.textPrimary },
    scrollContentContainer: { flexGrow: 1, justifyContent: 'center' },
    formContainer: { padding: 20 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder, paddingHorizontal: 15, marginBottom: 15, height: 58 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: COLORS.textPrimary, fontSize: 16, height: '100%' },
    pickerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder, paddingLeft: 15, marginBottom: 15, height: 58 },
    picker: { flex: 1, color: COLORS.textPrimary, height: '100%' },
    locationButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: 15, borderWidth: 2, borderColor: COLORS.primary, marginBottom: 20, marginTop: 5 },
    locationButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: 'bold' },
    button: { backgroundColor: COLORS.primary, padding: 20, borderRadius: 15, alignItems: 'center' },
    buttonDisabled: { backgroundColor: COLORS.disabled },
    buttonText: { color: COLORS.primaryDark, fontSize: 18, fontWeight: 'bold' },
    mapContainer: { flex: 1 },
    map: { ...StyleSheet.absoluteFillObject },
    mapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    mapControls: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(24, 24, 27, 0.9)', padding: 20, paddingBottom: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    mapInstructions: { color: COLORS.textPrimary, textAlign: 'center', fontSize: 16, marginBottom: 20 },
    mapConfirmButton: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 15, alignItems: 'center' },
    mapConfirmButtonText: { color: COLORS.primaryDark, fontSize: 18, fontWeight: 'bold' },
});

export default EditClientScreen;