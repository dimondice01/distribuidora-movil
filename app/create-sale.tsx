import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useData } from '../context/DataContext';
import { auth, db } from '../db/firebase-service';
import { COLORS } from '../styles/theme';

interface Product { id: string; nombre: string; precio: number; costo: number; stock?: number; categoriaId?: string; comisionEspecifica?: number; }
interface CartItem extends Product { quantity: number; comision: number; }
interface Vendedor { id: string; nombreCompleto: string; }

const CreateSaleScreen = () => {
    const { clientId, clientName } = useLocalSearchParams();
    const { products: allProducts, categories, promotions, vendors, isLoading: isDataLoading } = useData();
    
    const currentUser = auth.currentUser;
    const currentVendedor = useMemo(() => {
        if (!currentUser || !vendors) return null;
        return vendors.find((v: Vendedor) => v.id === currentUser.uid);
    }, [currentUser, vendors]);

    const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantityInput, setQuantityInput] = useState('1');

    useEffect(() => {
        if (!clientId || allProducts.length === 0) return;
        const salesQuery = query(collection(db, 'ventas'), where('clienteId', '==', clientId), orderBy('fecha', 'desc'), limit(3));
        const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
            const productIds = new Set<string>();
            snapshot.docs.forEach(doc => { (doc.data().items || []).forEach((item: any) => productIds.add(item.productId)); });
            if (productIds.size > 0) {
                const suggestions = allProducts.filter(p => productIds.has(p.id));
                setSuggestedProducts(suggestions);
            }
        });
        return () => unsubscribeSales();
    }, [clientId, allProducts]);

    const filteredProducts = useMemo(() => {
        let products = allProducts;
        if (categoryFilter) { products = products.filter(p => p.categoriaId === categoryFilter); }
        if (searchQuery.trim()) { products = products.filter(p => p.nombre.toLowerCase().includes(searchQuery.trim().toLowerCase())); }
        return products;
    }, [searchQuery, categoryFilter, allProducts]);

    const openQuantityModal = (product: Product) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectedProduct(product);
        setQuantityInput('1');
        setIsModalVisible(true);
    };
    
    const closeQuantityModal = () => { setIsModalVisible(false); setSelectedProduct(null); };
    
    const handleConfirmAddToCart = () => {
        if (!selectedProduct) return;
        const quantity = parseInt(quantityInput, 10);
        if (isNaN(quantity) || quantity <= 0) { Alert.alert('Error', 'Cantidad inválida.'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
        if (selectedProduct.stock !== undefined && quantity > selectedProduct.stock) { Alert.alert('Stock Insuficiente', `Solo quedan ${selectedProduct.stock} unidades.`); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
        
        handleAddToCart(selectedProduct, quantity);
        closeQuantityModal();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handleAddToCart = (product: Product, quantity: number) => {
        let effectiveCommission = product.comisionEspecifica ?? 0;
        if (product.comisionEspecifica == null) {
            const category = categories.find(cat => cat.id === product.categoriaId);
            if (category && category.comisionGeneral) {
                effectiveCommission = category.comisionGeneral;
            }
        }

        setCart((prevCart) => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
            } else {
                return [...prevCart, { ...product, quantity, comision: effectiveCommission }];
            }
        });
    };
    const cartTotal = useMemo(() => cart.reduce((total, item) => total + (item.precio || 0) * item.quantity, 0), [cart]);

    const handleReviewSale = () => {
        if (!clientId || !clientName || !currentUser || !currentVendedor) {
            Alert.alert("Error", "Faltan datos del cliente o vendedor para continuar. Por favor, reinicia la sesión.");
            return;
        }
        router.push({ 
            pathname: '/review-sale', 
            params: { 
                clientId: clientId as string, 
                clientName: clientName as string, 
                cart: JSON.stringify(cart),
                vendedorId: currentUser.uid,
                vendedorNombre: currentVendedor.nombreCompleto
            } 
        });
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Feather name="arrow-left" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
                <Text style={styles.title}>Nueva Venta</Text>
            </View>
            <Text style={styles.clientInfo}>Para: <Text style={styles.clientName}>{clientName}</Text></Text>

            {suggestedProducts.length > 0 && (
                <View>
                    <Text style={styles.sectionHeader}>Sugerencias de Reorden</Text>
                    <FlatList horizontal data={suggestedProducts} keyExtractor={item => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 15 }} renderItem={({ item }) => (<TouchableOpacity style={styles.suggestionCard} onPress={() => openQuantityModal(item)}><Text style={styles.suggestionName} numberOfLines={2}>{item.nombre}</Text><Text style={styles.suggestionPrice}>${(item.precio || 0).toFixed(2)}</Text></TouchableOpacity>)}/>
                </View>
            )}

            <View style={styles.controlsContainer}>
                <View style={styles.searchContainer}><Feather name="search" size={20} color={COLORS.textSecondary} style={styles.inputIcon} /><TextInput style={styles.input} placeholder="Buscar en todo el catálogo..." placeholderTextColor={COLORS.textSecondary} value={searchQuery} onChangeText={setSearchQuery} /></View>
                <View style={styles.pickerContainer}>
                    <Feather name="tag" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <Picker selectedValue={categoryFilter} onValueChange={(v) => setCategoryFilter(v)} style={styles.picker} dropdownIconColor={COLORS.primary}>
                        <Picker.Item label="Todas las categorías" value="" color={COLORS.primaryDark} />
                        {categories.map(c => <Picker.Item key={c.id} label={c.nombre} value={c.id} color={COLORS.primaryDark} />)}
                    </Picker>
                </View>
            </View>

            {isDataLoading && allProducts.length === 0 ? <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} /> : (
                <FlatList
                    data={filteredProducts}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContentContainer}
                    ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No se encontraron productos.</Text></View>}
                    renderItem={({ item }) => {
                        const promo = promotions.find(p => p.productoId === item.id);
                        const stock = item.stock ?? null;
                        const isOutOfStock = stock !== null && stock <= 0;
                        const stockTextColor = isOutOfStock ? COLORS.danger : (stock !== null && stock < 10) ? COLORS.warning : COLORS.textSecondary;
                        const stockText = isOutOfStock ? 'AGOTADO' : `Stock: ${stock ?? 'N/A'}`;
                        return (
                            <View style={styles.productCard}>
                                <View style={styles.productInfo}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {promo && <Feather name="star" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />}
                                        <Text style={styles.productName}>{item.nombre}</Text>
                                    </View>
                                    {promo ? <Text style={styles.promoDescription}>{promo.descripcion}</Text> : <Text style={styles.productPrice}>${(item.precio || 0).toFixed(2)}</Text>}
                                    <Text style={[styles.productStock, { color: stockTextColor }]}>{stockText}</Text>
                                </View>
                                <TouchableOpacity style={[styles.addButton, isOutOfStock && styles.addButtonDisabled]} onPress={() => openQuantityModal(item)} disabled={isOutOfStock}>
                                    <Feather name="plus" size={24} color={COLORS.primaryDark} />
                                </TouchableOpacity>
                            </View>
                        );
                    }}
                />
            )}
            
            {cart.length > 0 && ( <View style={styles.cartSummary}><View><Text style={styles.cartText}>{`${cart.length} ítem(s)`}</Text><Text style={styles.cartTotal}>Total (aprox): ${cartTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></View><TouchableOpacity style={styles.checkoutButton} onPress={handleReviewSale}><Text style={styles.checkoutButtonText}>Revisar Venta</Text><Feather name="arrow-right" size={20} color={COLORS.primaryDark} /></TouchableOpacity></View> )}
            
            <Modal transparent={true} visible={isModalVisible} animationType="fade" onRequestClose={closeQuantityModal}>
                <View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Ingresar Cantidad</Text><Text style={styles.modalProduct}>{selectedProduct?.nombre || ''}</Text><TextInput style={styles.modalInput} keyboardType="numeric" value={quantityInput} onChangeText={setQuantityInput} placeholder="Ej: 5" autoFocus={true}/><View style={styles.modalButtons}><TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeQuantityModal}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={handleConfirmAddToCart}><Text style={styles.confirmButtonText}>Añadir</Text></TouchableOpacity></View></View></View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 10, paddingHorizontal: 20, position: 'relative' },
    backButton: { position: 'absolute', left: 20, top: 60, padding: 10 },
    title: { fontSize: 28, fontWeight: 'bold', color: COLORS.textPrimary },
    clientInfo: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 15 },
    clientName: { fontWeight: 'bold', color: COLORS.textPrimary },
    sectionHeader: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary, paddingHorizontal: 20, marginBottom: 10 },
    suggestionCard: { backgroundColor: COLORS.glass, borderRadius: 12, padding: 12, marginRight: 10, width: 120, height: 100, justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.glassBorder },
    suggestionName: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 14 },
    suggestionPrice: { color: COLORS.primary, fontWeight: 'bold', fontSize: 13 },
    controlsContainer: { paddingHorizontal: 15, marginBottom: 15, gap: 10 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder, paddingHorizontal: 15, height: 50 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: COLORS.textPrimary, fontSize: 16 },
    pickerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder, paddingLeft: 15, height: 50 },
    picker: { flex: 1, color: COLORS.textPrimary },
    listContentContainer: { paddingHorizontal: 15, paddingBottom: 120 },
    emptyContainer: { alignItems: 'center', paddingTop: 50 },
    emptyText: { color: COLORS.textSecondary, fontStyle: 'italic' },
    productCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.glass, padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.glassBorder },
    productInfo: { flex: 1, marginRight: 10 },
    productName: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
    productPrice: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
    promoDescription: { fontSize: 14, color: COLORS.primary, fontWeight: 'bold', marginTop: 4, },
    productStock: { fontSize: 12, marginTop: 5, fontWeight: '500' },
    addButton: { backgroundColor: COLORS.primary, padding: 10, borderRadius: 25 },
    addButtonDisabled: { backgroundColor: COLORS.disabled, opacity: 0.6 },
    cartSummary: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(24, 24, 27, 0.95)', padding: 20, paddingTop: 15, borderTopWidth: 1, borderColor: COLORS.glassBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 40 },
    cartText: { color: COLORS.textSecondary, fontSize: 16 },
    cartTotal: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
    checkoutButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 15, gap: 8 },
    checkoutButtonText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 16 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
    modalContent: { width: '85%', backgroundColor: '#FFFFFF', borderRadius: 15, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2, }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, color: COLORS.primaryDark },
    modalProduct: { fontSize: 16, color: '#4B5563', marginBottom: 15, textAlign: 'center' },
    modalInput: { width: '100%', borderColor: '#D1D5DB', borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 18, textAlign: 'center', marginBottom: 20 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    modalButton: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
    cancelButton: { backgroundColor: '#F3F4F6', marginRight: 10 },
    cancelButtonText: { color: '#4B5563', fontWeight: 'bold' },
    confirmButton: { backgroundColor: COLORS.primary },
    confirmButtonText: { color: COLORS.primaryDark, fontWeight: 'bold' },
});

export default CreateSaleScreen;