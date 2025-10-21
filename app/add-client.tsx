import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { addDoc, collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { auth, db } from '../db/firebase-service';
import { COLORS } from '../styles/theme'; // <-- IMPORTAMOS NUESTROS COLORES

interface Zone { id: string; nombre: string; }
interface LocationCoords { latitude: number; longitude: number; }

const AddClientScreen = () => {
    const [nombre, setNombre] = useState('');
    const [direccion, setDireccion] = useState('');
    const [barrio, setBarrio] = useState('');
    const [localidad, setLocalidad] = useState('');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');
    const [zonaId, setZonaId] = useState('');
    const [location, setLocation] = useState<LocationCoords | null>(null);
    const [loading, setLoading] = useState(false);
    
    const [assignedZones, setAssignedZones] = useState<Zone[]>([]);
    const [zonesLoading, setZonesLoading] = useState(true);
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [mapLoading, setMapLoading] = useState(false);
    const [initialRegion, setInitialRegion] = useState({ latitude: -29.4134, longitude: -66.8569, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });

    useEffect(() => {
        const currentUser = auth.currentUser; if (!currentUser) return;
        let unsubscribeZones = () => {};
        const vendorDocRef = doc(db, 'vendedores', currentUser.uid);
        const unsubscribeVendor = onSnapshot(vendorDocRef, (vendorDocSnap) => {
            unsubscribeZones();
            if (vendorDocSnap.exists()) {
                const zoneIds = vendorDocSnap.data().zonasAsignadas;
                if (zoneIds && zoneIds.length > 0) {
                    const zonesQuery = query(collection(db, 'zonas'), where('__name__', 'in', zoneIds));
                    unsubscribeZones = onSnapshot(zonesQuery, (querySnapshot) => {
                        const zonesData: Zone[] = querySnapshot.docs.map(d => ({ id: d.id, nombre: d.data().nombre }));
                        setAssignedZones(zonesData); setZonesLoading(false);
                    });
                } else { setAssignedZones([]); setZonesLoading(false); }
            } else { setZonesLoading(false); }
        });
        return () => { unsubscribeVendor(); unsubscribeZones(); };
    }, []);

    const handleOpenMap = async () => {
        setIsMapVisible(true); setMapLoading(true);
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permiso denegado', 'Se necesita permiso para acceder a la ubicación.'); setMapLoading(false); return; }
        try {
            const currentPosition = await Location.getCurrentPositionAsync({});
            const coords = { latitude: currentPosition.coords.latitude, longitude: currentPosition.coords.longitude };
            if (!location) setLocation(coords);
            setInitialRegion({ ...initialRegion, ...coords });
        } catch (error) { Alert.alert("Error de GPS", "No se pudo obtener la ubicación actual."); } 
        finally { setMapLoading(false); }
    };

    const handleSaveClient = async () => {
        if (!nombre.trim() || !zonaId) { Alert.alert('Campos Requeridos', 'Por favor, ingrese el nombre y seleccione una zona.'); return; }
        const vendedorAsignadoId = auth.currentUser?.uid; if (!vendedorAsignadoId) { return; }
        setLoading(true);
        try {
            await addDoc(collection(db, 'clientes'), {
                nombre, direccion, barrio, localidad, telefono, email, zonaId, vendedorAsignadoId,
                fechaCreacion: new Date(),
                location: location ? { latitude: location.latitude, longitude: location.longitude } : null,
            });
            Alert.alert('Éxito', 'Cliente guardado correctamente.');
            router.back();
        } catch (error) {
            console.error("Error saving client: ", error); Alert.alert('Error', 'No se pudo guardar el cliente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Nuevo Cliente</Text>
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
                        <Picker selectedValue={zonaId} onValueChange={(v) => setZonaId(v)} style={styles.picker} dropdownIconColor={COLORS.primary} enabled={!zonesLoading && assignedZones.length > 0}>
                            {zonesLoading ? <Picker.Item label="Cargando..." value="" /> : <Picker.Item label="Seleccione una Zona..." value="" color={COLORS.primaryDark} />}
                            {assignedZones.map((z) => <Picker.Item key={z.id} label={z.nombre} value={z.id} color={COLORS.primaryDark} />)}
                        </Picker>
                    </View>

                    <TouchableOpacity style={styles.locationButton} onPress={handleOpenMap}>
                        <Feather name={location ? "check-circle" : "plus-circle"} size={20} color={COLORS.primary} />
                        <Text style={styles.locationButtonText}>{location ? 'Modificar Ubicación' : 'Añadir Ubicación'}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={handleSaveClient} style={[styles.button, loading && styles.buttonDisabled]} disabled={loading}>
                        {loading ? <ActivityIndicator color={COLORS.primaryDark} /> : <Text style={styles.buttonText}>Guardar Cliente</Text>}
                    </TouchableOpacity>
                </View>
            </ScrollView>
            <Modal visible={isMapVisible} animationType="slide" onRequestClose={() => setIsMapVisible(false)}>
                <View style={styles.mapContainer}>
                    {mapLoading && <View style={styles.mapOverlay}><ActivityIndicator size="large" color={COLORS.textPrimary} /></View>}
                    <MapView style={styles.map} provider={PROVIDER_GOOGLE} initialRegion={initialRegion} showsUserLocation>
                        {location && <Marker coordinate={location} draggable onDragEnd={(e) => setLocation(e.nativeEvent.coordinate)} />}
                    </MapView>
                    <View style={styles.mapControls}>
                        <Text style={styles.mapInstructions}>Mueve el marcador para ajustar la ubicación.</Text>
                        <TouchableOpacity style={styles.mapConfirmButton} onPress={() => setIsMapVisible(false)}>
                            <Text style={styles.mapConfirmButtonText}>Confirmar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%' },
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

export default AddClientScreen;