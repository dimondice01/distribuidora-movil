import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
// --- CORRECCIÓN: Importamos la interfaz 'Client' y 'useData' desde el Contexto ---
import { Client, useData } from '../context/DataContext';
import { COLORS } from '../styles/theme';

// --- Interfaz local eliminada (ahora la importamos) ---

const SelectClientForSaleScreen = () => {
    // --- CORRECCIÓN: Esta línea ahora es 100% tipada gracias al DataContext ---
    // TypeScript sabe que 'allClients' es Client[] e 'isLoading' es boolean.
    // Se corrigió el error de sintaxis '}_'.
    const { clients: allClients, isLoading } = useData();

    const [searchQuery, setSearchQuery] = useState('');
    
    // Filtrado de clientes
    const filteredClients = useMemo(() => {
        let clientsToFilter = Array.isArray(allClients) ? allClients : [];

        // --- CORRECIÓN ANTI-CRASH ---
        // Filtra clientes nulos o sin ID antes de renderizar
        clientsToFilter = clientsToFilter.filter(c => c && c.id);

        if (!searchQuery.trim()) {
            clientsToFilter.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
            return clientsToFilter;
        }

        const lowerQuery = searchQuery.trim().toLowerCase();
        clientsToFilter = clientsToFilter.filter(client =>
            (client.nombre?.toLowerCase() || '').includes(lowerQuery) ||
            (client.nombreCompleto?.toLowerCase() || '').includes(lowerQuery)
        );
        
        clientsToFilter.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        return clientsToFilter;

    }, [searchQuery, allClients]);

    // Función de navegación
    const handleSelectClient = (client: Client) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // --- NAVEGACIÓN UNIFICADA ---
        // Solo pasamos el clientId. La pantalla 'create-sale'
        // ya es capaz de buscar al cliente con este ID.
        router.push({
            pathname: '/create-sale',
            params: { clientId: client.id },
        });
    };

    // Estado de carga inicial (si los datos de useData aún no están listos)
    if (isLoading && (!allClients || allClients.length === 0)) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={StyleSheet.absoluteFill} />
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Cargando clientes...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.backgroundStart} />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />

            {/* --- HEADER UNIFICADO --- */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                    <Feather name="arrow-left" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Seleccionar Cliente</Text>
                 <View style={styles.headerButton} />
            </View>

            {/* --- BARRA DE BÚSQUEDA UNIFICADA --- */}
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
                </View>
            </View>

            <FlatList
                data={filteredClients}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContentContainer}
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.emptyContainer}>
                            <Feather name="users" size={48} color={COLORS.textSecondary} />
                            <Text style={styles.emptyText}>
                                {searchQuery ? 'No se encontraron clientes.' : 'No hay clientes cargados.'}
                            </Text>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => (
                    // --- CARD UNIFICADA ---
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => handleSelectClient(item)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.cardInfo}>
                            <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre || item.nombreCompleto}</Text>
                            {item.direccion ? <Text style={styles.cardSubtitle} numberOfLines={1}>{item.direccion}</Text> : null}
                        </View>
                        <Feather name="chevron-right" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                )}
                 ListFooterComponent={<View style={{ height: 20 }} />}
            />
        </View>
    );
};

// --- ESTILOS UNIFICADOS (Basados en client-list.tsx) ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 15, color: COLORS.textSecondary, fontSize: 16 },
    
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: (StatusBar.currentHeight || 0) + 10,
        paddingBottom: 15,
        paddingHorizontal: 10,
    },
    headerButton: { padding: 10, width: 44 }, // Ancho fijo para centrar
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        textAlign: 'center',
        flex: 1,
        marginHorizontal: 5,
    },
    
    controlsContainer: { paddingHorizontal: 15, marginBottom: 10 },
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
        color: COLORS.textPrimary,
        fontSize: 16,
        height: '100%'
    },

    listContentContainer: { paddingHorizontal: 15, paddingBottom: 20, flexGrow: 1 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, paddingTop: 60 },
    emptyText: { marginTop: 20, fontSize: 16, color: COLORS.textSecondary, textAlign: 'center' },
    
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.glass,
        paddingVertical: 14,
        paddingLeft: 16,
        paddingRight: 12, // Ajustado
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    cardInfo: { flex: 1, marginRight: 8 },
    cardTitle: { fontSize: 17, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 3 },
    cardSubtitle: { fontSize: 14, color: COLORS.textSecondary },
});

export default SelectClientForSaleScreen;