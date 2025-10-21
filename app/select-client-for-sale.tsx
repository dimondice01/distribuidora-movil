import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useData } from '../context/DataContext'; // <-- Importamos el almacén
import { COLORS } from '../styles/theme'; // <-- Importamos el tema

interface Client {
    id: string;
    nombre: string;
    direccion?: string;
}

const SelectClientForSaleScreen = () => {
    // Obtenemos los clientes y el estado de carga desde el almacén local
    const { clients: allClients, isLoading } = useData();

    // El estado del buscador sigue siendo local
    const [searchQuery, setSearchQuery] = useState('');
    
    // ¡Hemos eliminado el useEffect de carga!

    const filteredClients = useMemo(() => {
        if (!searchQuery.trim()) return allClients;
        return allClients.filter(client =>
            client.nombre.toLowerCase().includes(searchQuery.trim().toLowerCase())
        );
    }, [searchQuery, allClients]);

    const handleSelectClient = (client: Client) => {
        router.push({
            pathname: '/create-sale',
            params: { clientId: client.id, clientName: client.nombre },
        });
    };

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
                <Text style={styles.title}>Iniciar Venta</Text>
            </View>
            <Text style={styles.subtitle}>Seleccione un cliente</Text>

            <View style={styles.searchContainer}>
                <Feather name="search" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Buscar cliente por nombre..."
                    placeholderTextColor={COLORS.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <FlatList
                data={filteredClients}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContentContainer}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Feather name="user-x" size={40} color={COLORS.textSecondary} />
                        <Text style={styles.emptyText}>No se encontraron clientes.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.card} onPress={() => handleSelectClient(item)}>
                        <View style={styles.cardInfo}>
                            <Text style={styles.cardTitle}>{item.nombre}</Text>
                            {item.direccion && <Text style={styles.cardSubtitle}>{item.direccion}</Text>}
                        </View>
                        <Feather name="chevron-right" size={24} color={COLORS.primary} style={styles.cardIcon} />
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 10, paddingHorizontal: 20, position: 'relative' },
    backButton: { position: 'absolute', left: 20, top: 60, padding: 10 },
    title: { fontSize: 28, fontWeight: 'bold', color: COLORS.textPrimary },
    subtitle: { fontSize: 18, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
    
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder, paddingHorizontal: 15, marginHorizontal: 20, marginBottom: 20, height: 50 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: COLORS.textPrimary, fontSize: 16 },

    listContentContainer: { paddingHorizontal: 20, paddingBottom: 20 },
    emptyContainer: { alignItems: 'center', paddingTop: 50, gap: 15 },
    emptyText: { fontSize: 16, color: COLORS.textSecondary },
    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.glass, padding: 20, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: COLORS.glassBorder },
    cardInfo: { flex: 1 },
    cardTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
    cardSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 5 },
    cardIcon: { opacity: 0.9 },
});

export default SelectClientForSaleScreen;