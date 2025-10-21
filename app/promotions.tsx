import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react'; // <-- useEffect y useState ya no son necesarios
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useData } from '../context/DataContext'; // <-- 1. IMPORTAMOS EL ALMACÉN
import { COLORS } from '../styles/theme'; // <-- 2. IMPORTAMOS EL TEMA

// Interface para una promoción
interface Promotion {
    id: string;
    productoNombre: string;
    descripcion: string;
}

const PromotionsScreen = () => {
    // --- 3. OBTENEMOS LOS DATOS LOCALMENTE ---
    const { promotions, isLoading } = useData();

    // --- 4. ¡HEMOS ELIMINADO EL useEffect DE CARGA! ---
    
    if (isLoading && promotions.length === 0) {
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
                <Text style={styles.title}>Promociones Vigentes</Text>
            </View>

            <FlatList
                data={promotions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContentContainer}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Feather name="tag" size={40} color={COLORS.textSecondary} />
                        <Text style={styles.emptyText}>No hay promociones activas en este momento.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.promoCard}>
                        <View style={styles.promoIconContainer}>
                            <Feather name="star" size={24} color={COLORS.primaryDark} />
                        </View>
                        <View style={styles.promoTextContainer}>
                            <Text style={styles.promoProduct}>{item.productoNombre}</Text>
                            <Text style={styles.promoDescription}>{item.descripcion}</Text>
                        </View>
                    </View>
                )}
            />
        </View>
    );
};

// --- 5. ESTILOS COMPLETAMENTE REFACTORIZADOS ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, position: 'relative' },
    backButton: { position: 'absolute', left: 20, top: 60, padding: 10 },
    title: { fontSize: 28, fontWeight: 'bold', color: COLORS.textPrimary },
    listContentContainer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
    emptyContainer: { alignItems: 'center', paddingTop: 80, gap: 15 },
    emptyText: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center' },
    promoCard: {
        backgroundColor: COLORS.glass,
        borderRadius: 20,
        padding: 20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        flexDirection: 'row',
        alignItems: 'center',
    },
    promoIconContainer: {
        backgroundColor: COLORS.primary,
        borderRadius: 15,
        padding: 12,
        marginRight: 15,
    },
    promoTextContainer: {
        flex: 1,
    },
    promoProduct: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    promoDescription: {
        fontSize: 15,
        color: COLORS.textSecondary,
        marginTop: 5,
    },
});

export default PromotionsScreen;