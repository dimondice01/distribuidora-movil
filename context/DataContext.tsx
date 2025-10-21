import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDoc, getDocs, query, Timestamp, where } from 'firebase/firestore';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { auth, db } from '../db/firebase-service';

// --- CORRECCIÓN 1: Se añade 'vendors' a la interfaz ---
interface IDataContext {
    products: any[];
    clients: any[];
    categories: any[];
    promotions: any[];
    availableZones: any[];
    vendors: any[]; // <-- Añadido
    sales: any[];
    routes: any[];
    syncData: () => Promise<void>;
    isLoading: boolean;
}

const DataContext = createContext<IDataContext | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
    const [products, setProducts] = useState([]);
    const [clients, setClients] = useState([]);
    const [categories, setCategories] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [availableZones, setAvailableZones] = useState([]);
    const [vendors, setVendors] = useState([]); // <-- Añadido
    const [sales, setSales] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const parseWithDates = (jsonString: string | null) => {
        if (!jsonString) return [];
        return JSON.parse(jsonString, (key, value) => {
            // Reconvierte los strings de fecha a objetos Date
            if (key === 'fecha' && typeof value === 'string' && value.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)) {
                return new Date(value);
            }
            return value;
        });
    };

    useEffect(() => {
        const loadDataFromStorage = async () => {
            try {
                console.log("Intentando cargar datos desde el almacenamiento local...");
                const [
                    storedProducts, storedClients, storedCategories, storedPromotions,
                    storedZones, storedVendors, storedSales, storedRoutes
                ] = await AsyncStorage.multiGet([
                    'products', 'clients', 'categories', 'promotions', 
                    'availableZones', 'vendors', 'sales', 'routes'
                ]);

                if (storedProducts[1]) setProducts(JSON.parse(storedProducts[1]));
                if (storedClients[1]) setClients(JSON.parse(storedClients[1]));
                if (storedCategories[1]) setCategories(JSON.parse(storedCategories[1]));
                if (storedPromotions[1]) setPromotions(JSON.parse(storedPromotions[1]));
                if (storedZones[1]) setAvailableZones(JSON.parse(storedZones[1]));
                if (storedVendors[1]) setVendors(JSON.parse(storedVendors[1])); // <-- Añadido
                
                // Usamos una función para parsear fechas correctamente
                if (storedSales[1]) setSales(parseWithDates(storedSales[1]));
                if (storedRoutes[1]) setRoutes(parseWithDates(storedRoutes[1]));

                console.log("Datos locales cargados.");
            } catch (e) {
                console.error("Error al cargar datos locales:", e);
            } finally {
                setIsLoading(false);
            }
        };

        loadDataFromStorage();
    }, []);

    const syncData = async () => {
        setIsLoading(true);
        console.log("Iniciando sincronización de datos...");
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("No hay usuario para sincronizar.");

            const vendorRef = doc(db, 'vendedores', currentUser.uid);
            const vendorSnap = await getDoc(vendorRef);
            if (!vendorSnap.exists()) throw new Error("Datos del usuario no encontrados.");
            
            const userData = vendorSnap.data();
            const userRole = userData.rango;
            console.log(`Usuario identificado con rol: ${userRole}`);

            // --- CORRECCIÓN 2: Se añade la consulta de vendedores ---
            const productsQuery = getDocs(query(collection(db, 'productos')));
            const categoriesQuery = getDocs(query(collection(db, 'categorias')));
            const promosQuery = getDocs(query(collection(db, 'promociones'), where('estado', '==', 'activa')));
            const vendorsQuery = getDocs(query(collection(db, 'vendedores'))); // <-- Añadido

            let finalData: any = {
                products: [], categories: [], promotions: [], vendors: [],
                clients: [], availableZones: [], sales: [], routes: []
            };

            const processFirebaseDoc = (doc: any) => {
                const data = doc.data();
                // Convertir Timestamps de Firebase a objetos Date para consistencia
                if (data.fecha && data.fecha instanceof Timestamp) {
                    data.fecha = data.fecha.toDate();
                }
                return { id: doc.id, ...data };
            };

            if (userRole === 'Reparto') {
                const routesQuery = getDocs(query(collection(db, 'rutas'), where('repartidorId', '==', currentUser.uid)));
                const [productsSnap, categoriesSnap, promosSnap, vendorsSnap, routesSnap] = await Promise.all([productsQuery, categoriesQuery, promosQuery, vendorsQuery, routesQuery]);
                
                finalData.products = productsSnap.docs.map(processFirebaseDoc);
                finalData.categories = categoriesSnap.docs.map(processFirebaseDoc);
                finalData.promotions = promosSnap.docs.map(processFirebaseDoc);
                finalData.vendors = vendorsSnap.docs.map(processFirebaseDoc); // <-- Añadido
                finalData.routes = routesSnap.docs.map(processFirebaseDoc);
                
            } else {
                const clientsQuery = getDocs(query(collection(db, 'clientes'), where('vendedorAsignadoId', '==', currentUser.uid)));
                const salesQuery = getDocs(query(collection(db, 'ventas'), where('vendedorId', '==', currentUser.uid)));
                
                const [productsSnap, categoriesSnap, promosSnap, vendorsSnap, clientsSnap, salesSnap] = await Promise.all([productsQuery, categoriesQuery, promosQuery, vendorsQuery, clientsQuery, salesQuery]);

                finalData.products = productsSnap.docs.map(processFirebaseDoc);
                finalData.categories = categoriesSnap.docs.map(processFirebaseDoc);
                finalData.promotions = promosSnap.docs.map(processFirebaseDoc);
                finalData.vendors = vendorsSnap.docs.map(processFirebaseDoc); // <-- Añadido
                finalData.clients = clientsSnap.docs.map(processFirebaseDoc);
                finalData.sales = salesSnap.docs.map(processFirebaseDoc);

                const zoneIds = userData.zonasAsignadas;
                if (zoneIds && zoneIds.length > 0) {
                    const zonesQuery = await getDocs(query(collection(db, 'zonas'), where('__name__', 'in', zoneIds)));
                    finalData.availableZones = zonesQuery.docs.map(processFirebaseDoc);
                }
            }
            
            await Promise.all([
                AsyncStorage.setItem('products', JSON.stringify(finalData.products)),
                AsyncStorage.setItem('categories', JSON.stringify(finalData.categories)),
                AsyncStorage.setItem('promotions', JSON.stringify(finalData.promotions)),
                AsyncStorage.setItem('vendors', JSON.stringify(finalData.vendors)), // <-- Añadido
                AsyncStorage.setItem('clients', JSON.stringify(finalData.clients)),
                AsyncStorage.setItem('availableZones', JSON.stringify(finalData.availableZones)),
                AsyncStorage.setItem('sales', JSON.stringify(finalData.sales)),
                AsyncStorage.setItem('routes', JSON.stringify(finalData.routes)),
            ]);

            setProducts(finalData.products);
            setCategories(finalData.categories);
            setPromotions(finalData.promotions);
            setVendors(finalData.vendors); // <-- Añadido
            setClients(finalData.clients);
            setAvailableZones(finalData.availableZones);
            setSales(finalData.sales);
            setRoutes(finalData.routes);

            Toast.show({ type: 'success', text1: 'Datos Sincronizados', text2: 'La información ha sido actualizada. 👋', position: 'top', visibilityTime: 3000 });
            console.log("Sincronización completada con éxito.");
        } catch (error) {
            console.error("Error durante la sincronización de datos:", error);
            Toast.show({ type: 'error', text1: 'Error de Sincronización' });
        } finally {
            setIsLoading(false);
        }
    };

    // --- CORRECCIÓN 3: Se añade 'vendors' al valor del contexto ---
    const value = { products, clients, categories, promotions, availableZones, vendors, sales, routes, syncData, isLoading };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData debe ser usado dentro de un DataProvider');
    }
    return context;
};