import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useData } from '../context/DataContext';
import { COLORS } from '../styles/theme';

interface Zone {
    id: string;
    nombre: string;
}

interface Client {
    id: string;
    nombre: string;
    nombreCompleto?: string;
    direccion?: string;
    zonaId?: string;
}

const ClientListScreen = () => {
    const { clients: allClients = [], availableZones = [], isLoading: isDataLoading, syncData } = useData();
    const [zonaFilter, setZonaFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [didPerformInitialLoad, setDidPerformInitialLoad] = useState(false);

    // Lógica de Carga Inicial
    useEffect(() => {
        const initialLoad = async () => {
            if ((!allClients || allClients.length === 0) && !isDataLoading) {
                console.log('ClientList mounted: No local data, initiating initial sync...');
                setDidPerformInitialLoad(true);
                try {
                    await syncData();
                } catch (err) {
                    console.error("Initial sync failed:", err);
                }
            } else {
                 console.log('ClientList mounted: Local data present or global loading already in progress. Initial sync skipped.');
                 setDidPerformInitialLoad(false);
            }
        };
        initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Ordenación de Zonas
    const sortedAvailableZones = useMemo(() => {
        const zones = Array.isArray(availableZones) ? availableZones : [];
        return [...zones].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    }, [availableZones]);

    // Filtrado y Ordenación de Clientes
    const filteredClients = useMemo(() => {
        let clientsToFilter = Array.isArray(allClients) ? allClients : [];
        if (zonaFilter) {
            clientsToFilter = clientsToFilter.filter(c => c.zonaId === zonaFilter);
        }
        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.trim().toLowerCase();
            clientsToFilter = clientsToFilter.filter(c =>
                (c.nombre?.toLowerCase() || '').includes(lowerQuery) ||
                (c.nombreCompleto?.toLowerCase() || '').includes(lowerQuery)
            );
        }
        clientsToFilter.sort((a, b) =>
            (a.nombre || a.nombreCompleto || '').localeCompare(b.nombre || b.nombreCompleto || '')
        );
        return clientsToFilter;
    }, [zonaFilter, searchQuery, allClients]);

    // Pull-to-Refresh
    const onRefresh = useCallback(async () => {
        if (isRefreshing || isDataLoading) return;
        console.log('Pull to refresh triggered...');
        setIsRefreshing(true);
        try {
            await syncData();
        } catch (error) {
            console.error("Error during pull-to-refresh sync:", error);
        } finally {
            setIsRefreshing(false);
        }
    }, [syncData, isRefreshing, isDataLoading]);

    // Indicador de Carga Inicial
    if (isDataLoading && didPerformInitialLoad && (!allClients || allClients.length === 0)) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={StyleSheet.absoluteFill} />
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Cargando datos iniciales...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.backgroundStart} />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                    <Feather name="arrow-left" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Mis Clientes</Text>
                 <TouchableOpacity onPress={() => router.push('/add-client')} style={styles.headerButton}>
                    <Feather name="plus-circle" size={26} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.controlsContainer}>
                <View style={styles.inputContainer}>
                    <Feather name="search" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Buscar por nombre..."
                        placeholderTextColor={COLORS.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        clearButtonMode="while-editing"
                    />
                    {searchQuery.length > 0 && Platform.OS !== 'ios' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                             <Feather name="x" size={18} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* --- CORRECCIÓN VISUAL PICKER --- */}
                <View style={styles.pickerContainer}>
                    <Feather name="map-pin" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    {sortedAvailableZones && sortedAvailableZones.length > 0 ? (
                        <Picker
                            selectedValue={zonaFilter}
                            onValueChange={(itemValue) => setZonaFilter(itemValue)}
                            style={styles.picker} // Estilo principal del Picker
                            itemStyle={styles.pickerItemIOS} // Estilo para items en iOS
                            dropdownIconColor={COLORS.primary}
                            prompt="Filtrar por Zona"
                            mode="dropdown" // Modo dropdown en Android
                        >
                            {/* Primer item con color secundario */}
                            <Picker.Item
                                label="Todas las Zonas"
                                value=""
                                // CORRECCIÓN: Forzar color oscuro en el item, puede que necesites ajustar el valor exacto
                                color={Platform.OS === 'android' ? COLORS.textSecondary : COLORS.textSecondary}
                                style={styles.pickerItemAndroid} // Aplicar estilo Android aquí también si es necesario
                             />
                            {sortedAvailableZones.map((z: Zone) => (
                                <Picker.Item
                                    key={z.id}
                                    label={z.nombre}
                                    value={z.id}
                                    // CORRECCIÓN: Forzar color oscuro en los items
                                    color={Platform.OS === 'android' ? COLORS.primaryDark : COLORS.primaryDark} // Usar un color oscuro definido en tu tema o '#333333'
                                    style={styles.pickerItemAndroid} // Aplicar estilo Android si es necesario
                                />
                            ))}
                        </Picker>
                    ) : (
                        <Text style={styles.noZonesText}>
                            {isDataLoading ? 'Cargando zonas...' : 'No hay zonas'}
                        </Text>
                    )}
                    {/* Quitamos el overlay para simplificar, a ver si ayuda */}
                    {/* <View style={styles.pickerOverlay} /> */}
                </View>
            </View>

            {/* Indicador sutil de carga/refresco */}
            {(isDataLoading || isRefreshing) && allClients && allClients.length > 0 && (
                 <View style={styles.syncingIndicator}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.syncingText}>{isRefreshing ? 'Actualizando...' : 'Sincronizando...'}</Text>
                 </View>
            )}

            <FlatList
                data={filteredClients}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContentContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
                ListEmptyComponent={
                    !isDataLoading && !isRefreshing ? (
                        <View style={styles.emptyContainer}>
                            <Feather name="users" size={48} color={COLORS.textSecondary} />
                            <Text style={styles.emptyText}>
                                {searchQuery || zonaFilter ? 'No se encontraron clientes.' : 'Aún no tienes clientes asignados.'}
                            </Text>
                            { !searchQuery && !zonaFilter && (!allClients || allClients.length === 0) && (
                                 <TouchableOpacity onPress={() => router.push('/add-client')} style={styles.emptyButton}>
                                    <Text style={styles.emptyButtonText}>Agregar Mi Primer Cliente</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : null
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => router.push({ pathname: '/client-dashboard', params: { clientId: item.id } })}
                        activeOpacity={0.8}
                    >
                        <View style={styles.cardInfo}>
                            <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre || item.nombreCompleto}</Text>
                            {item.direccion ? <Text style={styles.cardSubtitle} numberOfLines={1}>{item.direccion}</Text> : null}
                        </View>
                        <TouchableOpacity
                            style={styles.editButton}
                            onPress={(e) => {
                                e.stopPropagation();
                                router.push({ pathname: '/edit-client', params: { clientId: item.id } });
                            }}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Feather name="edit-2" size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}
                 ListFooterComponent={<View style={{ height: 20 }} />}
            />
        </View>
    );
};

// --- ESTILOS CON AJUSTES EN PICKER ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundEnd },
    loadingText: { marginTop: 15, color: COLORS.textSecondary, fontSize: 16 },
    syncingIndicator: {
        position: 'absolute',
        top: (StatusBar.currentHeight || 0) + 60,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 5,
        zIndex: 10
    },
    syncingText: { marginLeft: 8, color: COLORS.textSecondary, fontSize: 12 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: (StatusBar.currentHeight || 0) + 10,
        paddingBottom: 15,
        paddingHorizontal: 10,
        backgroundColor: 'transparent',
    },
    headerButton: { padding: 10 },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textPrimary, // Asegúrate que este color contraste con el fondo
        textAlign: 'center',
        flex: 1,
        marginHorizontal: 5,
    },
    controlsContainer: { paddingHorizontal: 15, marginBottom: 10, gap: 10 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.glass,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        paddingHorizontal: 12,
        height: 48,
    },
    inputIcon: { marginRight: 8 },
    input: {
        flex: 1,
        color: COLORS.textPrimary, // Color del texto del input
        fontSize: 16,
        height: '100%'
    },
    clearButton: { padding: 5 },
    pickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.glass, // Fondo del contenedor
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        paddingLeft: 12,
        height: 48, // Altura fija
        position: 'relative',
        // overflow: 'hidden', // Quitar overflow por si corta el texto
    },
    picker: {
        flex: 1,
        height: '105%', // Que ocupe toda la altura
        color: COLORS.primaryDark || '#333333', // **Forzar color oscuro para el valor seleccionado**
        backgroundColor: 'transparent', // Mantener transparente si es posible
    },
    pickerItemIOS: { // Estilo específico para items en iOS
        fontSize: 16,
        color: COLORS.primaryDark || '#333333', // **Forzar color oscuro**
        height: 150, // Aumentar altura si se corta verticalmente en iOS
    },
    pickerItemAndroid: { // Estilo que se puede aplicar en Picker.Item en Android
        fontSize: 16,
        // El color aquí puede o no funcionar dependiendo de la versión de Android/RN
         backgroundColor: Platform.OS === 'android' ? COLORS.glass : undefined, // Fondo para items Android si es necesario
    },
    pickerItemLabel: { // Estilo usado en el label del Picker.Item (puede afectar Android)
        fontSize: 16,
        // color: COLORS.primaryDark || '#333333', // **Forzar color oscuro**
    },
    pickerOverlay: { // Probablemente ya no sea necesario si quitamos la transparencia
        // position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
        // backgroundColor: 'transparent', zIndex: -1,
    },
    noZonesText: {
        flex: 1,
        fontSize: 16,
        color: COLORS.textSecondary,
        paddingVertical: 12,
        fontStyle: 'italic',
    },
    listContentContainer: { paddingHorizontal: 15, paddingBottom: 20, flexGrow: 1 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    emptyText: { marginTop: 20, fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 25 },
    emptyButton: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 25, borderRadius: 25, elevation: 2, shadowOpacity: 0.1, shadowRadius: 4 },
    emptyButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.glass,
        paddingVertical: 14,
        paddingLeft: 16,
        paddingRight: 8,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        shadowColor: '#f1f5bcff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 2,
    },
    cardInfo: { flex: 1, marginRight: 8 },
    cardTitle: { fontSize: 17, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 3 },
    cardSubtitle: { fontSize: 14, color: COLORS.textSecondary },
    editButton: { padding: 12 },
});

export default ClientListScreen;