'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState
} from 'react';

interface ProductSelectionContextType {
  selectedProduct: string;
  setSelectedProduct: (product: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const ProductSelectionContext =
  createContext<ProductSelectionContextType | null>(null);

export function ProductSelectionProvider({
  children
}: {
  children: ReactNode;
}) {
  const [selectedProduct, setSelectedProductState] =
    useState<string>('BTC-USD');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const setSelectedProduct = useCallback(
    (product: string) => {
      console.log(
        '🔄 Product Selection: Changed from',
        selectedProduct,
        'to',
        product
      );
      setSelectedProductState(product);
    },
    [selectedProduct]
  );

  return (
    <ProductSelectionContext.Provider
      value={{
        selectedProduct,
        setSelectedProduct,
        isLoading,
        setIsLoading
      }}
    >
      {children}
    </ProductSelectionContext.Provider>
  );
}

export function useProductSelection() {
  const context = useContext(ProductSelectionContext);
  if (!context) {
    throw new Error(
      'useProductSelection must be used within a ProductSelectionProvider'
    );
  }
  return context;
}
