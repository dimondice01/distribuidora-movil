import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useData } from '../context/DataContext'; // Importamos el almacén
import { COLORS } from '../styles/theme'; // Importamos el tema

interface Client { id: string; nombre: string; direccion?: string; zonaId?: string; }

const ClientListScreen = () => {
    // Obtenemos los datos localmente
    const { clients: allClients, availableZones, isLoading } = useData();

    // Estados locales solo para los filtros
    const [zonaFilter, setZonaFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // ¡Hemos eliminado ambos useEffect de carga!

    // Filtramos los datos localmente
    const filteredClients = useMemo(() => {
        let clients = allClients;
        if (zonaFilter) {
            clients = clients.filter(c => c.zonaId === zonaFilter);
        }
        if (searchQuery.trim()) {
            clients = clients.filter(c => c.nombre.toLowerCase().includes(searchQuery.trim().toLowerCase()));
        }
        return clients;
    }, [zonaFilter, searchQuery, allClients]);

    if (isLoading && allClients.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={StyleSheet.absoluteFill} />
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Mis Clientes</Text>
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
                    />
                </View>
                <View style={styles.pickerContainer}>
                    <Feather name="navigation" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <Picker
                        selectedValue={zonaFilter}
                        onValueChange={(v) => setZonaFilter(v)}
                        style={styles.picker}
                        dropdownIconColor={COLORS.primary}
                    >
                        <Picker.Item label="Todas las Zonas" value="" color={COLORS.primaryDark}/>
                        {availableZones.map((z) => <Picker.Item key={z.id} label={z.nombre} value={z.id} color={COLORS.primaryDark}/>)}
                    </Picker>
                </View>
            </View>

            <FlatList
                data={filteredClients}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContentContainer}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Feather name="users" size={40} color={COLORS.textSecondary} />
                        <Text style={styles.emptyText}>No se encontraron clientes.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => router.push({ pathname: '/client-dashboard', params: { clientId: item.id } })}
                    >
                        <View style={styles.cardInfo}>
                            <Text style={styles.cardTitle}>{item.nombre}</Text>
                            {item.direccion && <Text style={styles.cardSubtitle}>{item.direccion}</Text>}
                        </View>
                        <TouchableOpacity
                            style={styles.editButton}
                            onPress={(e) => {
                                e.stopPropagation();
                                router.push({ pathname: '/edit-client', params: { clientId: item.id } });
                            }}
                        >
                            <Feather name="edit-2" size={22} color={COLORS.primary} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, position: 'relative' },
    backButton: { position: 'absolute', left: 20, top: 60, padding: 10 },
    title: { fontSize: 28, fontWeight: 'bold', color: COLORS.textPrimary },
    controlsContainer: { paddingHorizontal: 20, marginBottom: 20, gap: 15 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder, paddingHorizontal: 15, height: 58 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: COLORS.textPrimary, fontSize: 16 },
    pickerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder, paddingLeft: 15, height: 58 },
    picker: { flex: 1, color: COLORS.textPrimary },
    listContentContainer: { paddingHorizontal: 20, paddingBottom: 20 },
    emptyContainer: { alignItems: 'center', paddingTop: 50 },
    emptyText: { marginTop: 15, fontSize: 16, color: COLORS.textSecondary },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, paddingVertical: 20, paddingLeft: 20, paddingRight: 10, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: COLORS.glassBorder },
    cardInfo: { flex: 1 },
    cardTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
    cardSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 5 },
    editButton: { padding: 10, marginLeft: 15 },
});

export default ClientListScreen;