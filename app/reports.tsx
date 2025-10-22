import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useData } from '../context/DataContext'; // Asegúrate que DataContext provea 'clientes'
import { COLORS } from '../styles/theme';

interface Sale {
    id: string;
    clienteId?: string;
    clientName?: string; // Nombre guardado desde móvil (posiblemente)
    clienteNombre?: string; // Nombre guardado desde desktop
    fecha: Date;
    totalVenta: number;
    totalComision?: number;
    estado: 'Pagada' | 'Adeuda' | 'Pendiente de Pago' | 'Repartiendo' | 'Anulada';
    saldoPendiente: number;
}

const ReportsScreen = () => {
    // Asegúrate de que useData también provea 'clientes' si quieres buscar el nombre ahí como fallback
    const { sales: allSales, isLoading, clients } = useData();

    const sortedSales = useMemo(() => {
        if (!allSales) return [];
        return allSales
            .filter(sale => !(sale.clientName?.startsWith('Cobro Saldo') || sale.clienteNombre?.startsWith('Cobro Saldo'))) // Filtra ambos campos
            .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    }, [allSales]);

    const { comisionesGanadas, deudaPorCobrar } = useMemo(() => {
        if (!allSales) return { comisionesGanadas: 0, deudaPorCobrar: 0 };
        const comisiones = allSales
            .filter(sale => sale.estado === 'Pagada' || sale.estado === 'Adeuda')
            .reduce((sum, sale) => sum + (sale.totalComision || 0), 0);
        const deuda = allSales
            .filter(sale => sale.estado === 'Adeuda')
            .reduce((sum, sale) => sum + (sale.saldoPendiente || 0), 0);
        return { comisionesGanadas: comisiones, deudaPorCobrar: deuda };
    }, [allSales]);

    const formatJSDate = (date: Date) => {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return 'Fecha inválida';
        }
        return date.toLocaleDateString('es-AR');
    };

    // CORRECCIÓN 1: Función para obtener el nombre del cliente de forma robusta
    const getClientDisplayName = (sale: Sale) => {
        // Prioriza el nombre guardado directamente en la venta (desde desktop o móvil)
        if (sale.clienteNombre) return sale.clienteNombre;
        if (sale.clientName) return sale.clientName;
        // Como fallback, busca en la lista de clientes si está disponible
        if (sale.clienteId && clients) {
            const client = clients.find(c => c.id === sale.clienteId);
            if (client) return client.nombre || client.nombreCompleto || `Venta del ${formatJSDate(sale.fecha)}`;
        }
        // Si no hay nombre ni clienteId, usa la fecha
        return `Venta del ${formatJSDate(sale.fecha)}`;
    };


    if (isLoading && (!allSales || allSales.length === 0)) {
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
                        // CORRECCIÓN 2: Pasar solo el ID de la venta
                        onPress={() => router.push({
                            pathname: '/sale-detail',
                            params: { saleId: item.id } // Pasamos solo el ID
                        })}
                    >
                        <View style={styles.saleInfo}>
                            {/* CORRECCIÓN 1: Usar la nueva función para obtener el nombre */}
                            <Text style={styles.saleClientName}>{getClientDisplayName(item)}</Text>
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

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Pagada': return COLORS.success;
        case 'Adeuda': return COLORS.warning;
        case 'Pendiente de Pago': return COLORS.textSecondary;
        case 'Repartiendo': return COLORS.primary;
        case 'Anulada': return COLORS.danger;
        case 'ARCHIVADA': return COLORS.disabled; // Aunque no debería aparecer aquí, lo dejamos por si acaso
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
    statusText: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold' }, // Cambié a primaryDark para mejor contraste
});

export default ReportsScreen;