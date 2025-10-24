import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
// --- Importaciones necesarias ---
import {
    addDoc,
    collection,
    doc,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
// --- Importación para el FIX del PDF (Corregida para Deprecation Warning) ---
import * as FileSystem from 'expo-file-system/legacy'; // Para cacheDirectory y EncodingType
import { writeAsStringAsync } from 'expo-file-system/legacy'; // Para la función deprecada
import React, { useEffect, useMemo, useState } from 'react';
// --- FIX: Bloque de importación corregido (sin la coma extra) ---
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView, // El módulo/valor
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Toast from 'react-native-toast-message';
// --- Importamos TODAS las interfaces desde el Context ---
import {
    Sale as BaseSale,
    CartItem,
    Category,
    Client,
    Product,
    Promotion, // <-- AÑADIDO
    useData,
    Vendor
} from '../context/DataContext'; // Asumo DataContext ya está actualizado
import { auth, db } from '../db/firebase-service';
// --- Importamos el generador de PDF ---
import { generatePdf } from '../services/pdfGenerator'; // Asumo pdfGenerator ya está actualizado
import { COLORS } from '../styles/theme'; // Asumo theme ya está actualizado


// Interface para la venta que guardaremos (con campos de BD correctos)
interface SaleDataToSave {
    clienteId: string;
    clientName: string;
    vendedorId: string;
    vendedorName: string;
    items: CartItem[];
    totalVenta: number;
    totalCosto: number;
    totalComision: number;
    // observaciones: string; // <-- ELIMINADO
    estado: BaseSale['estado'];
    saldoPendiente: number;
    fecha?: any;
    fechaUltimaEdicion?: any;
    // paymentMethod: 'contado' | 'cuenta_corriente'; // <-- ELIMINADO
    totalDescuentoPromociones: number;
}


const CreateSaleScreen = () => {
    const { clientId, saleId, isEditing } = useLocalSearchParams();
    const editMode = isEditing === 'true';

    const {
        products: allProducts,
        categories,
        vendors,
        clients,
        sales,
        promotions, // <-- AÑADIDO
        isLoading: isDataLoading,
        refreshAllData
    } = useData();

    const [cart, setCart] = useState<CartItem[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    // const [observations, setObservations] = useState(''); // <-- ELIMINADO
    // const [paymentMethod, setPaymentMethod] = useState<'contado' | 'cuenta_corriente'>('contado'); // <-- ELIMINADO

    const [modalVisible, setModalVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product & { precioOriginal?: number } | null>(null);
    const [currentQuantity, setCurrentQuantity] = useState('1S');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [originalSale, setOriginalSale] = useState<BaseSale | null>(null);

    const currentUser = auth.currentUser;

    const currentVendedor = useMemo(() => {
        if (!currentUser || !vendors) return null;
        // --- Búsqueda Vendedor Corregida ---
        return vendors.find((v: Vendor) => v.firebaseAuthUid === currentUser.uid);
    }, [currentUser, vendors]);

    const client = useMemo(() => {
        if (!clientId || !clients) return null;
        return clients.find((c: Client) => c.id === clientId);
    }, [clientId, clients]);

    // Carga de datos en modo edición
    useEffect(() => {
        if (editMode && saleId && sales.length > 0) {
            const saleToEdit = sales.find((s: BaseSale) => s.id === saleId);

            if (saleToEdit) {
                setOriginalSale(saleToEdit);
                const cartItems = (saleToEdit.items || []).map((item: CartItem) => ({
                    ...item,
                    precioOriginal: item.precioOriginal ?? item.precio
                }));
                setCart(cartItems);
                // setObservations(saleToEdit.observaciones || ''); // <-- ELIMINADO
                // setPaymentMethod(saleToEdit.paymentMethod || 'contado'); // <-- ELIMINADO
            } else {
                Toast.show({ type: 'error', text1: 'Error', text2: 'No se encontró la venta para editar.', position: 'bottom' });
                router.back();
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editMode, saleId, sales]);

    // Filtrado de productos
    useEffect(() => {
        let products = allProducts;
        if (categoryFilter) {
            products = products.filter(p => p.categoriaId === categoryFilter);
        }
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            products = products.filter(p => p.nombre.toLowerCase().includes(lowerQuery));
        }
        setFilteredProducts(products);
    }, [allProducts, categoryFilter, searchQuery]);

    // Cálculo de comisión
    const getComision = (product: Product, quantity: number): number => {
        const comisionGeneral = currentVendedor?.comisionGeneral || 0;
        const precio = product.precio || 0;
        const costo = product.costo || 0;
        let comisionPorItem = 0;

        if (product.comisionEspecifica && product.comisionEspecifica > 0) {
            comisionPorItem = product.comisionEspecifica;
        } else if (costo > 0 && precio > 0) {
            const ganancia = precio - costo;
            comisionPorItem = ganancia * (comisionGeneral / 100);
        } else if (precio > 0) {
            comisionPorItem = precio * (comisionGeneral / 100);
        }
        return comisionPorItem * quantity;
    };

    // --- Lógica del Carrito ---
     const handleAddProduct = (product: Product) => {
        const existingItem = cart.find(item => item.id === product.id);
        
        // --- Lógica de Promociones ---
        let precioFinal = product.precio;
        let precioOriginal = product.precio;
        
        const promoAplicable: Promotion | undefined = promotions.find(promo =>
            promo.tipo === 'precio_especial' &&
            promo.productoIds.includes(product.id) &&
            (!promo.clienteIds || promo.clienteIds.length === 0 || (clientId && promo.clienteIds.includes(clientId as string)))
        );

        if (promoAplicable && promoAplicable.nuevoPrecio) {
            precioFinal = promoAplicable.nuevoPrecio;
            precioOriginal = product.precio;
        }
        // --- Fin Lógica de Promociones ---
        
        const productToAdd = { ...product, precio: precioFinal, precioOriginal: precioOriginal };
        
        if (existingItem) {
            setSelectedProduct(productToAdd);
            setCurrentQuantity(existingItem.quantity.toString());
            setModalVisible(true);
        } else {
            setSelectedProduct(productToAdd);
            setCurrentQuantity('1');
            setModalVisible(true);
        }
    };

    const handleConfirmQuantity = () => {
        const quantity = parseInt(currentQuantity, 10);
        if (isNaN(quantity) || quantity <= 0) {
            Alert.alert("Cantidad Inválida", "Por favor ingrese un número mayor a 0.");
            return;
        }
        if (!selectedProduct) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const comision = getComision(selectedProduct, quantity);

        const cartItemToAdd: CartItem = {
             ...selectedProduct,
             precio: selectedProduct.precio,
             precioOriginal: selectedProduct.precioOriginal ?? selectedProduct.precio,
             quantity,
             comision
        };

        setCart(prevCart => {
            const existingItemIndex = prevCart.findIndex(item => item.id === selectedProduct.id);
            if (existingItemIndex > -1) {
                 const updatedCart = [...prevCart];
                 updatedCart[existingItemIndex] = cartItemToAdd;
                 return updatedCart;

            } else {
                return [...prevCart, cartItemToAdd];
            }
        });
        setModalVisible(false);
        setSelectedProduct(null);
        setCurrentQuantity('1');
    };


    const handleRemoveFromCart = () => {
        if (!selectedProduct) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCart(prevCart => prevCart.filter(item => item.id !== selectedProduct!.id));
        setModalVisible(false);
        setSelectedProduct(null);
        setCurrentQuantity('1');
    };

    // --- Cálculos del Total ---
    const { subtotal, totalComision, totalCosto, totalFinal, totalDescuentoPromociones } = useMemo(() => {
        let sub: number = 0;
        let comision: number = 0;
        let costo: number = 0;
        let descuento: number = 0;

        cart.forEach(item => {
            sub += item.precio * item.quantity;
            comision += item.comision;
            costo += (item.costo || 0) * item.quantity;
            
            if (item.precioOriginal && item.precioOriginal > item.precio) {
                descuento += (item.precioOriginal - item.precio) * item.quantity;
            }
        });
        
        const total: number = sub;
        return {
            subtotal: sub,
            totalComision: comision,
            totalCosto: costo,
            totalFinal: total,
            totalDescuentoPromociones: descuento
        };
    }, [cart]);


    // --- !!!!! FUNCIÓN handleShare (CON DEPURACIÓN AVANZADA) !!!!! ---
    // --- !!!!! FUNCIÓN handleShare (CON LOGS PARA DEPURAR) !!!!! ---
   // --- !!!!! FUNCIÓN handleShare CORREGIDA (message restaurado) !!!!! ---
    const handleShare = async (saleDataForPdf: BaseSale, clientData: Client, vendorName: string) => {
         if (!clientData) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'No se encontraron datos del cliente.' });
            setIsSubmitting(false); // Asegúrate de resetear si es necesario
            router.back();
            return;
         }

       let pdfData_base64_or_data_uri: string | null = null;
        let base64Data: string = '';
        let fileUri: string = '';

         try {
            Toast.show({ type: 'info', text1: '1. Generando PDF...', position: 'bottom', visibilityTime: 2000 });
            pdfData_base64_or_data_uri = await generatePdf(saleDataForPdf, clientData, vendorName);
            if (!pdfData_base64_or_data_uri) { throw new Error("generatePdf devolvió null o vacío."); }
            base64Data = pdfData_base64_or_data_uri.startsWith('data:application/pdf;base64,')
                ? pdfData_base64_or_data_uri.substring('data:application/pdf;base64,'.length)
                : pdfData_base64_or_data_uri;
         } catch (pdfError: any) {
             console.error("handleShare: Error al generar PDF:", pdfError);
             Alert.alert("Error al Generar PDF", `Detalle: ${pdfError.message || 'Error desconocido'}`);
             return;
         }

         try {
            Toast.show({ type: 'info', text1: '2. Escribiendo archivo...', position: 'bottom', visibilityTime: 2000 });
            const fileName = `comprobante-${saleDataForPdf.id || Date.now()}.pdf`;
            fileUri = FileSystem.cacheDirectory + fileName;
            await writeAsStringAsync(fileUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
            console.log("handleShare: Archivo escrito en:", fileUri); // Log útil
         } catch (fileError: any) {
            console.error("handleShare: Error al escribir archivo:", fileError);
            Alert.alert("Error al Escribir Archivo", `Detalle: ${fileError.message || 'Error desconocido'}`);
            return;
         }

         // --- PASO 3: Compartir con expo-sharing ---
         try {
            // Primero, verificamos si se puede compartir
            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                throw new Error("La función de compartir no está disponible en este dispositivo.");
            }

            Toast.show({ type: 'info', text1: '3. Abriendo Share (expo-sharing)...', position: 'bottom', visibilityTime: 2000 });

            // Llamamos a shareAsync pasando SOLO la URI del archivo
            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/pdf', // Especificamos el tipo de archivo
                dialogTitle: 'Compartir comprobante vía...', // Título del diálogo
                // UTI: 'com.adobe.pdf' // Opcional para iOS
            });

            console.log("handleShare: Sharing.shareAsync completado.");
            router.back(); // Volvemos si se completó (incluso si canceló)

         } catch (shareError: any) {
            console.error("handleShare: Error con expo-sharing:", shareError);
            // expo-sharing a veces lanza error si el usuario cancela, verificar mensaje
            if (shareError.message?.includes('Sharing dismissed') || shareError.message?.includes('cancelled')) {
                 console.log("handleShare: El usuario canceló compartir (expo-sharing).");
            } else {
                Alert.alert("Error al Compartir", `Detalle: ${shareError.message || 'Error desconocido'}`);
            }
            router.back(); // Volvemos atrás incluso si hay error o cancelación
         }
    };
    // --- !!!!! FIN FUNCIÓN handleShare CORREGIDA !!!!! ---
    // --- !!!!! FIN FUNCIÓN handleShare (CON LOGS) !!!!! ---
    // --- !!!!! FIN FUNCIÓN handleShare CORREGIDA !!!!! ---


    // --- Función de Guardado (YA CORREGIDA PREVIAMENTE PARA CAMPOS BD) ---
    const handleCheckout = async () => {
        if (isSubmitting) return;
        if (!client || !currentVendedor) {
            Alert.alert("Error", "Faltan datos del cliente o vendedor.");
            return;
        }
        if (cart.length === 0) {
            Alert.alert("Carrito Vacío", "Agregue al menos un producto.");
            return;
        }

        setIsSubmitting(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // --- Usamos los nombres de campo correctos ---
        const saleDataToSave: SaleDataToSave = {
            clienteId: client.id,
            clientName: client.nombre,
            vendedorId: currentVendedor.id,
            vendedorName: currentVendedor.nombreCompleto || currentVendedor.nombre,
            items: cart.map((item: CartItem) => {
                const { precioOriginal, ...restOfItem } = item;
                return {
                    ...restOfItem,
                    ...(precioOriginal !== undefined && precioOriginal !== item.precio && { precioOriginal: precioOriginal })
                };
            }),
            totalVenta: totalFinal,
            totalCosto: totalCosto,
            totalComision: totalComision,
            // observaciones: observations, // <-- ELIMINADO
            estado: 'Pendiente de Pago', // <-- MODIFICADO SEGÚN SOLICITUD
            saldoPendiente: totalFinal, // <-- MODIFICADO
            // paymentMethod: paymentMethod, // <-- ELIMINADO
            totalDescuentoPromociones: totalDescuentoPromociones,
            ...(editMode ? { fechaUltimaEdicion: serverTimestamp() } : { fecha: serverTimestamp() })
        };

        try {
            let savedSaleId = originalSale ? originalSale.id : '';

            if (editMode && originalSale) {
                const saleRef = doc(db, 'ventas', originalSale.id);
                await updateDoc(saleRef, saleDataToSave as any);
                Toast.show({ type: 'success', text1: 'Venta Actualizada', position: 'bottom', visibilityTime: 2000 });
            } else {
                const docRef = await addDoc(collection(db, 'ventas'), saleDataToSave as any);
                savedSaleId = docRef.id;
                Toast.show({ type: 'success', text1: 'Venta Creada', position: 'bottom', visibilityTime: 2000 });
            }

            // Preparamos los datos completos para el PDF (con nombres de campo correctos)
            const completeSaleDataForPdf: BaseSale = {
                ...(originalSale || {}), // Campos originales si editamos
                ...saleDataToSave,       // Campos guardados (con nombres correctos)
                id: savedSaleId,
                // Fecha simulada para el PDF
                fecha: new Date(), // Usamos la fecha actual para el PDF
                
                // @ts-ignore - Limpiamos campos innecesarios para el PDF
                fechaUltimaEdicion: undefined,
                 items: saleDataToSave.items.map((item: CartItem) => ({
                     ...item,
                     precioOriginal: item.precioOriginal ?? item.precio // Aseguramos precioOriginal
                 })),
                 // @ts-ignore - Añadimos toDate simulado para compatibilidad con pdfGenerator
                 fecha: { toDate: () => new Date() },
            };
             // @ts-ignore - Limpiamos campo innecesario
             delete completeSaleDataForPdf.fechaUltimaEdicion;


          //  await refreshAllData();

            // --- !!!!! CORRECCIÓN: Obtener y pasar 'vendorName' !!!!! ---
            const vendorName = currentVendedor.nombreCompleto || currentVendedor.nombre;
            
            Alert.alert(
                "Venta Guardada",
                "¿Desea generar y compartir el comprobante ahora?",
                [
                    { text: "No, Volver", onPress: () => { setIsSubmitting(false); router.back(); }, style: "cancel" },
                    // Pasamos los 3 argumentos a handleShare
                    { text: "Sí, Compartir", onPress: () => handleShare(completeSaleDataForPdf, client, vendorName) }
                ],
                 { cancelable: false }
            );

        } catch (error: any) {
            console.error("Error al guardar la venta:", error);
             const firestoreError = error.message || 'No se pudo completar la operación.';
            Toast.show({ type: 'error', text1: 'Error al Guardar', text2: firestoreError, position: 'bottom' });
            setIsSubmitting(false);
        }
        // No ponemos 'finally' aquí, el setIsSubmitting se maneja en el Alert
    };


    // --- Renderizado de Producto ---
    const renderProduct = ({ item }: { item: Product }) => {
        const itemInCart = cart.find(cartItem => cartItem.id === item.id);
        const quantityInCart = itemInCart?.quantity || 0;
        
        let displayPrice = item.precio;
        const promoAplicable: Promotion | undefined = promotions.find(promo =>
            promo.tipo === 'precio_especial' &&
            promo.productoIds.includes(item.id) &&
            (!promo.clienteIds || promo.clienteIds.length === 0 || (clientId && promo.clienteIds.includes(clientId as string)))
        );
         if (promoAplicable && promoAplicable.nuevoPrecio) {
            displayPrice = promoAplicable.nuevoPrecio;
        }

        return (
            <TouchableOpacity
                style={[styles.card, quantityInCart > 0 && styles.cardSelected]}
                onPress={() => handleAddProduct(item)}
                activeOpacity={0.8}
            >
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre}</Text>
                    {displayPrice !== item.precio ? (
                        <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
                            <Text style={styles.cardPrice}>${displayPrice.toLocaleString('es-AR')}</Text>
                            <Text style={styles.cardOriginalPrice}>${item.precio.toLocaleString('es-AR')}</Text>
                        </View>
                    ) : (
                         <Text style={styles.cardPrice}>${item.precio.toLocaleString('es-AR')}</Text>
                    )}
                </View>

                {quantityInCart > 0 ? (
                    <View style={styles.inCartControls}>
                        <View style={styles.quantityBadge}>
                            <Text style={styles.quantityBadgeText}>{quantityInCart}</Text>
                        </View>
                        <Feather name="edit" size={22} color={COLORS.primary} style={{ marginLeft: 8 }} />
                    </View>
                ) : (
                    <View style={styles.addButton}>
                        <Feather name="plus" size={20} color={COLORS.primaryDark} />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    // --- RENDERIZADO PRINCIPAL ---
    if (isDataLoading) {
        return (
            <View style={styles.fullScreenLoader}>
                <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={StyleSheet.absoluteFill} />
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loaderText}>Cargando datos...</Text>
            </View>
        );
    }
    if (!client && !isDataLoading) {
        return (
            <View style={styles.fullScreenLoader}>
                <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={StyleSheet.absoluteFill} />
                <Feather name="user-x" size={48} color={COLORS.danger} />
                <Text style={styles.loaderText}>Error: Cliente no encontrado</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButtonError}>
                    <Text style={styles.backButtonErrorText}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }


    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.backgroundStart} />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}><Feather name="x" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
                <View style={styles.headerTitleContainer}><Text style={styles.title}>{editMode ? 'Editar Venta' : 'Nueva Venta'}</Text><Text style={styles.clientName}>{client?.nombre}</Text></View>
                <View style={styles.headerButton} />
            </View>

            {/* Controles (Búsqueda y Picker) */}
            <View style={styles.controlsContainer}>
                <View style={styles.inputContainer}>
                    <Feather name="search" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Buscar producto..." placeholderTextColor={COLORS.textSecondary} value={searchQuery} onChangeText={setSearchQuery} clearButtonMode="while-editing"/>
                     {searchQuery.length > 0 && Platform.OS === 'android' && ( <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}><Feather name="x" size={18} color={COLORS.textSecondary} /></TouchableOpacity> )}
                </View>
                <View style={styles.pickerContainer}>
                    <Feather name="tag" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <Picker selectedValue={categoryFilter} onValueChange={(itemValue) => setCategoryFilter(itemValue)} style={styles.picker} dropdownIconColor={COLORS.primary} prompt="Filtrar por Categoría" mode="dropdown">
                        <Picker.Item label="Todas las Categorías" value="" color={COLORS.textSecondary} style={styles.pickerItem} />
                        {categories.map((c: Category) => ( <Picker.Item key={c.id} label={c.nombre} value={c.id} color={COLORS.primaryDark} style={styles.pickerItem}/> ))}
                    </Picker>
                </View>
            </View>

            {/* Lista de Productos */}
            <FlatList data={filteredProducts} keyExtractor={(item) => item.id} renderItem={renderProduct} contentContainerStyle={styles.listContentContainer} ListEmptyComponent={ () => (
                 <View style={styles.emptyContainer}>
                    <Feather name="package" size={48} color={COLORS.textSecondary} />
                    <Text style={styles.emptyText}>No se encontraron productos</Text>
                </View>
            )} />

            {/* Resumen y Checkout */}
            <View style={styles.checkoutContainer}>
                <ScrollView>
                     {/* --- OBSERVACIONES Y SELECTOR DE PAGO ELIMINADOS --- */}
                     
                    <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</Text></View>
                    {totalDescuentoPromociones > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={[styles.totalLabel, styles.discountText]}>Descuentos</Text>
                            <Text style={[styles.totalValue, styles.discountText]}>-${totalDescuentoPromociones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</Text>
                        </View>
                    )}
                    <View style={[styles.totalRow, styles.finalTotalRow]}><Text style={styles.finalTotalLabel}>Total</Text><Text style={styles.finalTotalValue}>${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</Text></View>
                </ScrollView>
                <TouchableOpacity style={[styles.checkoutButton, isSubmitting && styles.checkoutButtonDisabled]} onPress={handleCheckout} disabled={isSubmitting}>
                    {isSubmitting ? ( <ActivityIndicator color={COLORS.primaryDark} /> ) : ( <Feather name={editMode ? "check-circle" : "arrow-right-circle"} size={22} color={COLORS.primaryDark} /> )}
                    <Text style={styles.checkoutButtonText}>{isSubmitting ? (editMode ? 'Actualizando...' : 'Guardando...') : (editMode ? 'Actualizar Venta' : 'Finalizar Venta')}</Text>
                </TouchableOpacity>
            </View>

            {/* Modal */}
            <Modal transparent={true} visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Cantidad</Text>
                        <Text style={styles.modalProduct}>{selectedProduct?.nombre}</Text>
                        <TextInput style={styles.modalInput} value={currentQuantity} onChangeText={setCurrentQuantity} keyboardType="number-pad" textAlign="center" autoFocus={true} selectTextOnFocus />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={handleRemoveFromCart}><Feather name="trash-2" size={20} color={COLORS.danger} /></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={handleConfirmQuantity}><Text style={styles.modalButtonText}>Confirmar</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

// --- ESTILOS ---
// (Se asume que los estilos son los mismos que en tu archivo original)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    fullScreenLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 15 },
    loaderText: { fontSize: 16, color: COLORS.textSecondary },
    backButtonError: { marginTop: 20, backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 25, borderRadius: 25 },
    backButtonErrorText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: (StatusBar.currentHeight || 0) + 10, paddingBottom: 15, paddingHorizontal: 10 },
    headerButton: { padding: 10, width: 44 },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    title: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary },
    clientName: { fontSize: 15, color: COLORS.primary, fontWeight: '500' },
    controlsContainer: { paddingHorizontal: 15, marginBottom: 10, gap: 10 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 12, borderWidth: 1, borderColor: COLORS.glassBorder, paddingHorizontal: 12, height: 48 },
    inputIcon: { marginRight: 8 },
    input: { flex: 1, color: COLORS.textPrimary, fontSize: 16, height: '100%' },
    clearButton: { padding: 5 },
    pickerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 12, borderWidth: 1, borderColor: COLORS.glassBorder, paddingLeft: 12, justifyContent: 'center', paddingVertical: 5 },
    picker: { flex: 1, color: COLORS.textPrimary, backgroundColor: 'transparent' },
    pickerItem: {
        minHeight: Platform.OS === 'ios' ? 44 : undefined,
    },
    listContentContainer: { paddingHorizontal: 15, paddingBottom: 10, flexGrow: 1 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: 15 },
    emptyText: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center' },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, paddingVertical: 12, paddingLeft: 15, paddingRight: 10, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.glassBorder },
    cardSelected: { backgroundColor: 'rgba(241, 245, 188, 0.2)', borderColor: COLORS.primary },
    cardInfo: { flex: 1, marginRight: 8 },
    cardTitle: { fontSize: 16, fontWeight: '500', color: COLORS.textPrimary, marginBottom: 2 },
    cardPrice: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
    cardOriginalPrice: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '400', textDecorationLine: 'line-through', marginLeft: 5 },
    inCartControls: { flexDirection: 'row', alignItems: 'center' },
    quantityBadge: { backgroundColor: COLORS.primary, borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
    quantityBadgeText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 14 },
    addButton: { backgroundColor: COLORS.primary, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4 },
    checkoutContainer: { backgroundColor: COLORS.glass, borderTopWidth: 1, borderColor: COLORS.glassBorder, padding: 15, paddingBottom: Platform.OS === 'ios' ? 30 : 15, maxHeight: '60%' },
    
    // --- Estilos de Observaciones y Pago ELIMINADOS (dejados por si acaso, no molestan) ---
    observationInputContainer: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, borderColor: COLORS.glassBorder, borderWidth: 1, marginBottom: 10 },
    observationInput: { color: COLORS.textPrimary, fontSize: 15, paddingHorizontal: 12, paddingVertical: 8, minHeight: 40, maxHeight: 80 },
    paymentSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderRadius: 12, 
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderColor: COLORS.glassBorder,
        borderWidth: 1,
        marginBottom: 10,
    },
    paymentButton: {
        flex: 1,
        padding: 16, 
        alignItems: 'center',
        borderRadius: 12, 
    },
    paymentButtonActive: {
        backgroundColor: COLORS.primary,
    },
    paymentButtonText: {
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    paymentButtonTextActive: {
        color: COLORS.primaryDark,
        fontWeight: 'bold',
    },
    // --- Fin Estilos Pago ---

    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    totalLabel: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },
    totalValue: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
    discountText: { color: COLORS.danger, fontWeight: '600' },
    finalTotalRow: { borderTopWidth: 1, borderColor: COLORS.glassBorder, paddingTop: 10, marginTop: 5 },
    finalTotalLabel: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold' },
    finalTotalValue: { color: COLORS.primary, fontSize: 20, fontWeight: 'bold' },
    checkoutButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 15, gap: 10, marginTop: 10 },
    checkoutButtonDisabled: { backgroundColor: COLORS.textSecondary },
    checkoutButtonText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 18 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)' },
    modalContent: { width: '80%', backgroundColor: COLORS.backgroundEnd, borderRadius: 15, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: COLORS.glassBorder },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, color: COLORS.textPrimary },
    modalProduct: { fontSize: 16, color: COLORS.primary, marginBottom: 20, textAlign: 'center', fontWeight: '500' },
    modalInput: { width: '100%', backgroundColor: COLORS.glass, borderColor: COLORS.glassBorder, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 22, textAlign: 'center', marginBottom: 20, color: COLORS.textPrimary },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10 },
    modalButton: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
    modalButtonCancel: { backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.danger },
    modalButtonConfirm: { backgroundColor: COLORS.primary },
    modalButtonText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 16 },
});

export default CreateSaleScreen;