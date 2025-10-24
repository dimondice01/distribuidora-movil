import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics'; // <-- AÑADIDO
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore'; // Importaciones limpiadas
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Toast from 'react-native-toast-message'; // <-- AÑADIDO
import { useData } from '../context/DataContext'; // <-- AÑADIDO
import { auth, db } from '../db/firebase-service';
import { COLORS } from '../styles/theme';

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
    const [isSubmitting, setIsSubmitting] = useState(false); // Renombrado de 'loading'
    
    // --- OBTENER DATOS DEL CONTEXTO ---
    const { availableZones, vendors, refreshAllData } = useData();
    const currentUser = auth.currentUser;

    const [mapModalVisible, setMapModalVisible] = useState(false);
    const [tempRegion, setTempRegion] = useState({
        latitude: -34.6037, // Centro de Buenos Aires (default)
        longitude: -58.3816,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    });
    const [locationLoading, setLocationLoading] = useState(false);

    // --- MEJORA: Obtener zonas del vendedor desde el DataContext ---
    // Es más eficiente que un onSnapshot() en esta pantalla.
    const currentVendedor = useMemo(() => {
        if (!currentUser || !vendors) return null;
        return vendors.find((v: any) => v.id === currentUser.uid);
    }, [currentUser, vendors]);

    const zonasDelVendedor = useMemo(() => {
        if (!currentVendedor || !currentVendedor.zonasAsignadas || !availableZones) {
            return [];
        }
        const zonaIds = currentVendedor.zonasAsignadas;
        return availableZones
            .filter(z => zonaIds.includes(z.id))
            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    }, [currentVendedor, availableZones]);

    // --- (Se elimina el useEffect con onSnapshot, ya no es necesario) ---

    // Función para obtener ubicación actual
    const handleLocation = async () => {
        setLocationLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Se necesita permiso de ubicación para esta función.');
            setLocationLoading(false);
            return;
        }

        try {
            let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const coords = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            };
            setTempRegion({
                ...tempRegion,
                ...coords,
            });
            setLocation(coords);
            setMapModalVisible(true);
        } catch (error) {
            Alert.alert('Error de Ubicación', 'No se pudo obtener la ubicación actual.');
        } finally {
            setLocationLoading(false);
        }
    };

    const handleConfirmLocation = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setMapModalVisible(false);
    };

    // --- FUNCIÓN DE GUARDADO (CON REFRESCADO) ---
    const handleSubmit = async () => {
        if (!nombre.trim() || !zonaId) {
            Alert.alert('Datos Incompletos', 'El nombre y la zona son obligatorios.');
            return;
        }
        if (isSubmitting) return; // Evitar doble submit

        setIsSubmitting(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            // 1. Preparar el nuevo documento
            const newClientData = {
                nombre: nombre.trim(),
                nombreCompleto: nombre.trim(), // Asumir que es el mismo
                direccion: direccion.trim(),
                barrio: barrio.trim(),
                localidad: localidad.trim(),
                telefono: telefono.trim(),
                email: email.trim().toLowerCase(),
                zonaId,
                location: location || null,
                vendedorAsignadoId: currentUser?.uid, // ¡Importante!
                fechaCreacion: new Date(), // Usar new Date() es más simple que serverTimestamp aquí
            };

            // 2. GUARDAR EN FIREBASE
            await addDoc(collection(db, 'clientes'), newClientData);
            
            // 3. ¡LA MAGIA! REFRESCAR TODOS LOS DATOS
            await refreshAllData();

            // 4. Notificar al usuario con Toast
            Toast.show({
                type: 'success',
                text1: 'Cliente Creado',
                text2: `${nombre.trim()} ha sido agregado a tu lista.`,
                position: 'bottom',
                visibilityTime: 3000
            });

            // 5. NAVEGAR DE VUELTA
            router.back();

        } catch (error) {
            console.error("Error al crear el cliente:", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
                'Error', 
                'No se pudo crear el cliente. Revisa tu conexión a internet.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar barStyle="light-content" backgroundColor={COLORS.backgroundStart} />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                    <Feather name="arrow-left" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Nuevo Cliente</Text>
                <View style={styles.headerButton} />
            </View>
            
            <ScrollView style={styles.formContainer} contentContainerStyle={{ paddingBottom: 40 }}>
                
                <View style={styles.inputGroup}>
                    <Feather name="user" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Nombre o Razón Social *"
                        placeholderTextColor={COLORS.textSecondary}
                        value={nombre}
                        onChangeText={setNombre}
                        autoCapitalize="words"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Feather name="map-pin" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Dirección"
                        placeholderTextColor={COLORS.textSecondary}
                        value={direccion}
                        onChangeText={setDireccion}
                        autoCapitalize="words"
                    />
                </View>
                
                <View style={styles.inputGroup}>
                    <Feather name="navigation" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Barrio"
                        placeholderTextColor={COLORS.textSecondary}
                        value={barrio}
                        onChangeText={setBarrio}
                        autoCapitalize="words"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Feather name="map" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Localidad"
                        placeholderTextColor={COLORS.textSecondary}
                        value={localidad}
                        onChangeText={setLocalidad}
                        autoCapitalize="words"
                    />
                </View>
                
                <View style={styles.inputGroup}>
                    <Feather name="phone" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Teléfono"
                        placeholderTextColor={COLORS.textSecondary}
                        value={telefono}
                        onChangeText={setTelefono}
                        keyboardType="phone-pad"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Feather name="mail" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={COLORS.textSecondary}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.pickerContainer}>
                    <Feather name="compass" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <Picker
                        selectedValue={zonaId}
                        onValueChange={(itemValue) => setZonaId(itemValue)}
                        style={styles.picker}
                        dropdownIconColor={COLORS.primary}
                        prompt="Seleccionar Zona Asignada"
                    >
                        <Picker.Item label="Seleccionar Zona *" value="" color={COLORS.textSecondary} />
                        {/* --- MEJORA: Usar zonas del DataContext --- */}
                        {zonasDelVendedor.map((z: Zone) => (
                            <Picker.Item key={z.id} label={z.nombre} value={z.id} color={COLORS.primaryDark} />
                        ))}
                    </Picker>
                </View>

                <TouchableOpacity style={styles.locationButton} onPress={handleLocation} disabled={locationLoading}>
                    {locationLoading ? (
                        <ActivityIndicator color={COLORS.primary} />
                    ) : (
                        <Feather name={location ? "check-circle" : "crosshair"} size={22} color={COLORS.primary} />
                    )}
                    <Text style={styles.locationButtonText}>
                        {location ? 'Ubicación Guardada' : 'Capturar Ubicación GPS'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.button, (isSubmitting || !nombre.trim() || !zonaId) && styles.buttonDisabled]} 
                    onPress={handleSubmit} 
                    disabled={isSubmitting || !nombre.trim() || !zonaId}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color={COLORS.primaryDark} />
                    ) : (
                        <Text style={styles.buttonText}>Guardar Cliente</Text>
                    )}
                </TouchableOpacity>

            </ScrollView>

            <Modal
                visible={mapModalVisible}
                animationType="slide"
                onRequestClose={() => setMapModalVisible(false)}
            >
                <View style={styles.mapContainer}>
                    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
                    <MapView
                        provider={PROVIDER_GOOGLE}
                        style={styles.map}
                        region={tempRegion}
                        onRegionChangeComplete={setTempRegion}
                        showsUserLocation
                        followsUserLocation
                    >
                        <Marker
                            coordinate={tempRegion}
                            draggable
                            onDragEnd={(e) => {
                                const newCoords = e.nativeEvent.coordinate;
                                setLocation(newCoords);
                                setTempRegion({ ...tempRegion, ...newCoords });
                            }}
                        />
                    </MapView>
                    <View style={styles.mapOverlay}>
                         <Feather name="move" size={32} color={COLORS.primary} style={{ position: 'absolute' }} />
                    </View>
                    <View style={styles.mapControls}>
                        <Text style={styles.mapInstructions}>
                            Mueva el mapa o el marcador para ajustar la ubicación exacta del cliente.
                        </Text>
                         <TouchableOpacity style={styles.button} onPress={handleConfirmLocation}>
                            <Text style={styles.buttonText}>Confirmar Ubicación</Text>
                        </TouchableOpacity>
                         <TouchableOpacity style={{ ...styles.button, backgroundColor: 'transparent', marginTop: 10 }} onPress={() => setMapModalVisible(false)}>
                            <Text style={{...styles.buttonText, color: COLORS.textSecondary }}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: (StatusBar.currentHeight || 0) + 10,
        paddingBottom: 15,
        paddingHorizontal: 10,
        backgroundColor: 'transparent',
    },
    headerButton: { padding: 10, width: 44 }, // Ancho fijo para centrar
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
    formContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.glass,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        paddingHorizontal: 15,
        marginBottom: 15,
        height: 58,
    },
    inputIcon: { marginRight: 10 },
    input: {
        flex: 1,
        color: COLORS.textPrimary,
        fontSize: 16,
        height: '100%'
    },
    pickerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder, paddingLeft: 15, marginBottom: 15, height: 58 },
    picker: { flex: 1, color: COLORS.primaryDark, height: '100%' },
    locationButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: 15, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}20`, marginBottom: 20, marginTop: 5 },
    locationButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: 'bold' },
    button: { backgroundColor: COLORS.primary, padding: 18, borderRadius: 15, alignItems: 'center' },
    buttonDisabled: { backgroundColor: COLORS.glassBorder },
    buttonText: { color: COLORS.primaryDark, fontSize: 18, fontWeight: 'bold' },
    mapContainer: { flex: 1 },
    map: { ...StyleSheet.absoluteFillObject },
    mapOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 10, pointerEvents: 'none' }, // No debe capturar eventos
    mapControls: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.backgroundEnd, padding: 20, paddingBottom: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 10 },
    mapInstructions: { color: COLORS.textSecondary, textAlign: 'center', fontSize: 15, marginBottom: 10 },
});

export default AddClientScreen;