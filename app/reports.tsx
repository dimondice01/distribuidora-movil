import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useData } from '../context/DataContext';
import { COLORS } from '../styles/theme';

interface Sale {
    id: string;
    clienteId?: string;
    clientName?: string;
    fecha: { seconds: number; nanoseconds: number; };
    totalVenta: number;
    totalComision?: number; // Usamos totalComision en lugar de totalNetProfit para mayor precisión
    estado: 'Pagada' | 'Adeuda' | 'Pendiente de Pago' | 'Repartiendo' | 'Anulada';
    saldoPendiente: number;
}

const ReportsScreen = () => {
    const { sales: allSales, isLoading } = useData();

    const sortedSales = useMemo(() => {
        if (!allSales) return [];
        // Filtramos ventas que no sean de "Cobro Saldo" para no duplicar información
        return allSales
            .filter(sale => !sale.clientName?.startsWith('Cobro Saldo'))
            .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
    }, [allSales]);

    // --- LÓGICA DE MÉTRICAS CORREGIDA ---
    const { comisionesGanadas, deudaPorCobrar } = useMemo(() => {
        if (!allSales) return { comisionesGanadas: 0, deudaPorCobrar: 0 };

        // Comisiones ganadas = la suma de `totalComision` de todas las ventas (Pagadas y Adeuda).
        // Este campo refleja la comisión sobre lo que ya se cobró.
        const comisiones = allSales.reduce((sum, sale) => sum + (sale.totalComision || 0), 0);
        
        // Deuda por cobrar = la suma de `saldoPendiente` SÓLO de las ventas con estado "Adeuda".
        const deuda = allSales
            .filter(sale => sale.estado === 'Adeuda')
            .reduce((sum, sale) => sum + (sale.saldoPendiente || 0), 0);

        return { comisionesGanadas: comisiones, deudaPorCobrar: deuda };
    }, [allSales]);

    const formatFirebaseDate = (timestamp: { seconds: number }) => {
        if (!timestamp?.seconds) return 'Fecha inválida';
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString('es-AR');
    };

    if (isLoading && allSales.length === 0) {
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
                <Text style={styles.title}>Mis Reportes</Text>
            </View>

            <View style={styles.metricsContainer}>
                <View style={styles.metricBox}>
                    <Feather name="award" size={24} color={COLORS.success} style={styles.metricIcon} />
                    <Text style={styles.metricValue}>${comisionesGanadas.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    <Text style={styles.metricLabel}>Comisiones Generadas</Text>
                </View>
                <View style={styles.metricBox}>
                    <Feather name="alert-circle" size={24} color={COLORS.warning} style={styles.metricIcon} />
                    <Text style={styles.metricValue}>${deudaPorCobrar.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    <Text style={styles.metricLabel}>Deuda por Cobrar</Text>
                </View>
            </View>

            <Text style={styles.listHeader}>Últimas Ventas Realizadas</Text>

            <FlatList
                data={sortedSales}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContentContainer}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 30 }}>
                        <Text style={styles.emptyText}>No hay ventas registradas.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.saleCard}
                        onPress={() => router.push({
                            pathname: '/sale-detail',
                            params: { saleJSON: JSON.stringify(item) }
                        })}
                    >
                        <View style={styles.saleInfo}>
                            <Text style={styles.saleClientName}>{item.clientName || `Venta del ${formatFirebaseDate(item.fecha)}`}</Text>
                            <Text style={styles.saleDetails}>
                                Total: ${(item.totalVenta || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                            {(item.saldoPendiente > 0) && (
                                <Text style={styles.salePending}>
                                    Saldo: ${(item.saldoPendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                            )}
                        </View>
                        <View style={styles.saleActions}>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.estado) }]}>
                                <Text style={styles.statusText}>{item.estado}</Text>
                            </View>
                            <Feather name="chevron-right" size={24} color={COLORS.textSecondary} style={{marginTop: 8}}/>
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

// --- FUNCIÓN DE COLOR ACTUALIZADA ---
const getStatusColor = (status: string) => {
    switch (status) {
        case 'Pagada': return COLORS.success;
        case 'Adeuda': return COLORS.warning;
        case 'Pendiente de Pago': return COLORS.textSecondary;
        case 'Repartiendo': return COLORS.primary;
        case 'Anulada': return COLORS.danger;
        case 'ARCHIVADA': return COLORS.disabled;
        default: return COLORS.disabled;
    }
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
    backButton: { position: 'absolute', left: 20, top: 60, padding: 10, zIndex: 1 },
    title: { fontSize: 28, fontWeight: 'bold', color: COLORS.textPrimary },
    metricsContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 15, marginBottom: 30, gap: 15 },
    metricBox: { flex: 1, backgroundColor: COLORS.glass, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.glassBorder, alignItems: 'center' },
    metricIcon: { marginBottom: 10 },
    metricValue: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 5 },
    metricLabel: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
    listHeader: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, paddingHorizontal: 20, marginBottom: 15 },
    listContentContainer: { paddingHorizontal: 15, paddingBottom: 20 },
    emptyText: { color: COLORS.textSecondary, textAlign: 'center', fontStyle: 'italic' },
    saleCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.glass, padding: 18, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: COLORS.glassBorder },
    saleInfo: { flex: 1, marginRight: 10 },
    saleClientName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 5 },
    saleDetails: { color: COLORS.textSecondary, fontSize: 14 },
    salePending: { color: COLORS.warning, fontWeight: 'bold', fontSize: 14, marginTop: 4 },
    saleActions: { alignItems: 'flex-end' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    statusText: { color: COLORS.primaryDark, fontSize: 12, fontWeight: 'bold' },
});

export default ReportsScreen;