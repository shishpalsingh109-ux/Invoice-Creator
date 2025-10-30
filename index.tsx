import React, { useState, useMemo, useCallback, ChangeEvent, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { PlusCircleIcon, TrashIcon, ArrowUturnLeftIcon, PrinterIcon } from '@heroicons/react/24/solid';

// --- TYPE DEFINITIONS ---
interface SubItem {
  id: string;
  name: string; // Sub-item name
  description: string | null;
  hsn: string;
  qty: number | null;
  unit: string;
  price: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
}

interface InvoiceItem {
  id:string;
  name: string; // Main item name
  description: string | null;
  subItems: SubItem[];
  // These are used ONLY if subItems is empty
  hsn: string;
  qty: number | null;
  unit: string;
  price: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
}


interface AdjustmentItem {
  id: string;
  name: string;
  amount: number;
  operation: 'add' | 'subtract';
}


// Type declaration for jspdf from CDN
declare global {
  interface Window {
    jspdf: any;
  }
}

// --- CONSTANTS ---
const stateCodeMap: { [key: string]: string } = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
    '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
    '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
    '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '28': 'Andhra Pradesh (Old)',
    '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
    '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana',
    '37': 'Andhra Pradesh (Newly Added)', '38': 'Ladakh (Newly Added)', '97': 'Others Territory', '99': 'Center Jurisdiction',
};


// --- UTILITY FUNCTIONS ---
const capitalizeWords = (str: string): string => {
    if (!str) return '';
    return str.replace(/\b\w/g, char => char.toUpperCase());
};

const capitalizeFirstLetter = (str: string): string => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const formatIndianNumber = (numStr: string | number, decimalPlaces = 0): string => {
    const num = Number(numStr);
    if (isNaN(num)) return typeof numStr === 'string' ? numStr : (decimalPlaces > 0 ? '0.' + '0'.repeat(decimalPlaces) : '0');

    let [integerPart, decimalPart] = num.toFixed(decimalPlaces).split('.');
    
    if (integerPart.length > 3) {
        const lastThree = integerPart.substring(integerPart.length - 3);
        const otherNumbers = integerPart.substring(0, integerPart.length - 3);
        integerPart = otherNumbers.replace(/(\d)(?=(\d\d)+(?!\d))/g, "$1,") + ',' + lastThree;
    }
    
    return decimalPlaces > 0 ? `${integerPart}.${decimalPart}` : integerPart;
};


const numberToWords = (num: number): string => {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const s = ['', 'Thousand', 'Lakh', 'Crore'];

    const toWords = (n: number): string => {
        if (n < 20) return a[n] || '';
        if (n < 100) return (b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '')).trim();
        if (n < 1000) return (a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + toWords(n % 100) : '')).trim();
        return '';
    };

    if (num === 0) return 'Zero Only';
    
    let result = '';
    let tempNum = Math.floor(num);
    let i = 0;
    while (tempNum > 0) {
        let chunk;
        if (i === 0) {
            chunk = tempNum % 1000;
            tempNum = Math.floor(tempNum / 1000);
        } else {
            chunk = tempNum % 100;
            tempNum = Math.floor(tempNum / 100);
        }

        if (chunk > 0) {
            const chunkInWords = toWords(chunk);
            result = chunkInWords + ' ' + (s[i] || '') + ' ' + result;
        }
        i++;
        if (i >= s.length) break; 
    }

    return result.trim().replace(/\s+/g, ' ') + ' Only';
};


// --- UI HELPER COMPONENTS (defined outside App to prevent re-renders) ---
interface EditableFieldProps {
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
}

const EditableField: React.FC<EditableFieldProps> = ({ value, onChange, placeholder = '', className = '' }) => (
    <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md transition-colors ${className}`}
    />
);

interface EditableTextareaProps {
    value: string;
    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    className?: string;
}

const EditableTextarea: React.FC<EditableTextareaProps> = ({ value, onChange, onBlur, placeholder = '', className = '' }) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset height
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Set to scroll height
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            className={`bg-transparent p-1 w-full focus:outline-none focus:bg-blue-50/50 rounded-md transition-colors resize-none overflow-y-hidden ${className}`}
            rows={1}
            autoFocus
        />
    );
};

interface EditableNumberFieldProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
    decimalPlaces?: number;
}

const EditableNumberField: React.FC<EditableNumberFieldProps> = ({ value, onChange, className = '', decimalPlaces = 0 }) => {
    const [localString, setLocalString] = useState(String(value));
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setLocalString(formatIndianNumber(value, decimalPlaces));
        }
    }, [value, isFocused, decimalPlaces]);

    const handleFocus = () => {
        setIsFocused(true);
        setLocalString(String(value));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newString = e.target.value;
        setLocalString(newString);

        const numericValue = parseFloat(newString.replace(/,/g, ''));
        if (!isNaN(numericValue)) {
            onChange(numericValue);
        } else if (newString === '' || newString === '.' || newString === '-') {
            onChange(0);
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
        const numericValue = parseFloat(localString.replace(/,/g, ''));
        let finalValue = isNaN(numericValue) ? 0 : numericValue;

        if (decimalPlaces === 0) {
            finalValue = Math.round(finalValue);
        }
        
        onChange(finalValue);
    };

    return (
        <input
            type="text"
            value={localString}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            className={className}
        />
    );
};

interface EditableNullableNumberFieldProps {
    value: number | null;
    onChange: (value: number | null) => void;
    className?: string;
    decimalPlaces?: number;
}

const EditableNullableNumberField: React.FC<EditableNullableNumberFieldProps> = ({ value, onChange, className = '', decimalPlaces = 0 }) => {
    const [localString, setLocalString] = useState(value === null ? '' : String(value));
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setLocalString(value === null ? '' : formatIndianNumber(value, decimalPlaces));
        }
    }, [value, isFocused, decimalPlaces]);

    const handleFocus = () => {
        setIsFocused(true);
        setLocalString(value === null ? '' : String(value));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newString = e.target.value;
        setLocalString(newString);

        if (newString.trim() === '') {
            onChange(null);
        } else {
            const numericValue = parseFloat(newString.replace(/,/g, ''));
            if (!isNaN(numericValue)) {
                onChange(numericValue);
            }
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
        if (localString.trim() === '') {
            onChange(null);
        } else {
            const numericValue = parseFloat(localString.replace(/,/g, ''));
            let finalValue: number | null = isNaN(numericValue) ? null : numericValue;

            if (finalValue !== null) {
                if (decimalPlaces === 0) {
                    finalValue = Math.round(finalValue);
                }
                onChange(finalValue);
            } else {
                onChange(null);
            }
        }
    };

    return (
        <input
            type="text"
            value={localString}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            className={className}
        />
    );
};

const notificationBgClasses = {
    success: 'bg-green-500',
    info: 'bg-blue-500',
    error: 'bg-red-500',
};

// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const getInitialState = () => ({
        invoiceDetails: {
            invoiceNo: '',
            dated: new Date().toISOString().split('T')[0],
            placeOfSupply: 'Delhi (07)',
        },
        billedTo: { name: '', address: '', gstin: '' },
        shippedTo: { name: '', address: '', gstin: '' },
        items: [{
            id: Date.now().toString(),
            name: '',
            description: null,
            subItems: [],
            hsn: '', 
            qty: null,
            unit: '', 
            price: 0,
            cgstRate: 9, 
            sgstRate: 9, 
            igstRate: 18,
        }] as InvoiceItem[],
        preTaxItems: [] as AdjustmentItem[],
        postTaxItems: [] as AdjustmentItem[],
        terms: `1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if the payment is not made within the stipulated time.\n3. Subject to 'Delhi' Jurisdiction only.`,
        invoiceTitle: 'Tax Invoice',
        invoiceSubtitle: 'Original Copy',
    });

    const [invoiceDetails, setInvoiceDetails] = useState(getInitialState().invoiceDetails);
    const [billedTo, setBilledTo] = useState(getInitialState().billedTo);
    const [shippedTo, setShippedTo] = useState(getInitialState().shippedTo);
    const [items, setItems] = useState<InvoiceItem[]>(getInitialState().items);
    const [preTaxItems, setPreTaxItems] = useState<AdjustmentItem[]>(getInitialState().preTaxItems);
    const [postTaxItems, setPostTaxItems] = useState<AdjustmentItem[]>(getInitialState().postTaxItems);
    const [terms, setTerms] = useState(getInitialState().terms);
    const [invoiceTitle, setInvoiceTitle] = useState(getInitialState().invoiceTitle);
    const [invoiceSubtitle, setInvoiceSubtitle] = useState(getInitialState().invoiceSubtitle);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
    const [gstinErrors, setGstinErrors] = useState({ billedTo: '', shippedTo: '' });

    const prevBilledToRef = useRef(billedTo);
    
    const isIntraState = useMemo(() => invoiceDetails.placeOfSupply.includes('Delhi (07)'), [invoiceDetails.placeOfSupply]);


    const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => {
            setNotification(null);
        }, 3000);
    };
    
    // --- VALIDATION ---
    const validateGstin = (gstin: string): string => {
        if (!gstin) return '';
        const gstinRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{2}$/;
        const stateCode = gstin.substring(0, 2);

        if (!gstinRegex.test(gstin)) {
            return "Invalid GSTN/UIN format.";
        }
        if (!stateCodeMap[stateCode]) {
            return "Invalid state code in GSTIN.";
        }

        return '';
    };

    // Auto-update Place of Supply from GSTIN
    useEffect(() => {
        const gstin = billedTo.gstin;
        const isValid = validateGstin(gstin) === '';
        
        if (isValid && gstin.trim().length >= 2) {
            const stateCode = gstin.substring(0, 2);
            const stateName = stateCodeMap[stateCode];
            if (stateName) {
                setInvoiceDetails(prevDetails => ({
                    ...prevDetails,
                    placeOfSupply: `${stateName} (${stateCode})`
                }));
            }
        }
    }, [billedTo.gstin]);

    // Auto-fill Shipped to details from Billed to details (with manual override)
    useEffect(() => {
        const prevBilledTo = prevBilledToRef.current;
        if (JSON.stringify(shippedTo) === JSON.stringify(prevBilledTo)) {
            setShippedTo(billedTo);
        }
        prevBilledToRef.current = billedTo;
    }, [billedTo, shippedTo]);
    
    // Convert tax rates when tax type (intra/inter-state) changes
    useEffect(() => {
        setItems(prevItems =>
            prevItems.map(item => {
                const updatedSubItems = item.subItems.map(subItem => {
                    if (isIntraState) {
                        const newRate = subItem.igstRate / 2;
                        return { ...subItem, cgstRate: newRate, sgstRate: newRate };
                    } else {
                        const newRate = subItem.cgstRate + subItem.sgstRate;
                        return { ...subItem, igstRate: newRate };
                    }
                });

                let updatedItem = { ...item, subItems: updatedSubItems };
                if (isIntraState) {
                    const newRate = item.igstRate / 2;
                    updatedItem = { ...updatedItem, cgstRate: newRate, sgstRate: newRate };
                } else {
                    const newRate = item.cgstRate + item.sgstRate;
                    updatedItem = { ...updatedItem, igstRate: newRate };
                }
                return updatedItem;
            })
        );
    }, [isIntraState]);


    // --- EVENT HANDLERS ---
     const handleReset = () => {
        if (window.confirm('Are you sure you want to reset the invoice? All data will be erased.')) {
            const initialState = getInitialState();
            setInvoiceDetails(initialState.invoiceDetails);
            setBilledTo(initialState.billedTo);
            setShippedTo(initialState.shippedTo);
            setItems(initialState.items);
            setPreTaxItems(initialState.preTaxItems);
            setPostTaxItems(initialState.postTaxItems);
            setInvoiceTitle(initialState.invoiceTitle);
            setInvoiceSubtitle(initialState.invoiceSubtitle);
            setGstinErrors({ billedTo: '', shippedTo: '' });
            showNotification('Invoice has been reset.', 'info');
        }
    };
    
    const handleGstinChange = (party: 'billedTo' | 'shippedTo', value: string) => {
        const upperValue = value.toUpperCase();
        const error = validateGstin(upperValue);

        setGstinErrors(prev => ({ ...prev, [party]: error }));

        if (party === 'billedTo') {
            setBilledTo(prev => ({ ...prev, gstin: upperValue }));
        } else {
            setShippedTo(prev => ({ ...prev, gstin: upperValue }));
        }
    };
    
    const handleItemChange = (id: string, field: keyof Omit<InvoiceItem, 'subItems' | 'id'> | 'csgstRate', value: any) => {
        setItems(prevItems =>
            prevItems.map(item => {
                if (item.id === id) {
                    if (field === 'csgstRate') {
                        const rate = Number(value);
                        return { ...item, cgstRate: rate, sgstRate: rate };
                    }

                    let processedValue = value;
                    if (field === 'name' && typeof value === 'string') {
                        processedValue = capitalizeFirstLetter(value);
                    }
                    
                    return { ...item, [field as keyof InvoiceItem]: processedValue };
                }
                return item;
            })
        );
    };
    
    const handleSubItemChange = (itemId: string, subItemId: string, field: keyof Omit<SubItem, 'id'> | 'csgstRate', value: any) => {
        setItems(items.map(item => {
            if (item.id === itemId) {
                const updatedSubItems = item.subItems.map(si => {
                    if (si.id === subItemId) {
                        if (field === 'csgstRate') {
                            const rate = Number(value);
                            return { ...si, cgstRate: rate, sgstRate: rate };
                        }
                        return { ...si, [field as keyof SubItem]: value };
                    }
                    return si;
                });
                return { ...item, subItems: updatedSubItems };
            }
            return item;
        }));
    };


    const addItem = () => {
        const newItem: InvoiceItem = {
            id: Date.now().toString(),
            name: '',
            description: null,
            subItems: [],
            hsn: '',
            qty: null,
            unit: '',
            price: 0,
            cgstRate: 9,
            sgstRate: 9,
            igstRate: 18,
        };
        setItems([...items, newItem]);
    };

    const removeItem = (id: string) => {
        setItems(prevItems => prevItems.filter(item => item.id !== id));
    };

    const addSubItem = (itemId: string) => {
        setItems(items.map(item => {
            if (item.id === itemId) {
                const newSubItem: SubItem = {
                    id: Date.now().toString(),
                    name: '',
                    description: null,
                    hsn: '',
                    qty: null,
                    unit: '',
                    price: 0,
                    cgstRate: item.cgstRate, // Inherit tax from parent
                    sgstRate: item.sgstRate,
                    igstRate: item.igstRate,
                };
                return { ...item, subItems: [...item.subItems, newSubItem] };
            }
            return item;
        }));
    };

    const removeSubItem = (itemId: string, subItemId: string) => {
        setItems(items.map(item => {
            if (item.id === itemId) {
                return { ...item, subItems: item.subItems.filter(si => si.id !== subItemId) };
            }
            return item;
        }));
    };

    const addPreTaxItem = () => setPreTaxItems([...preTaxItems, { id: Date.now().toString(), name: 'Discount', amount: 0, operation: 'subtract' }]);
    const handlePreTaxItemChange = (id: string, field: keyof Omit<AdjustmentItem, 'id'>, value: string | number) => {
        setPreTaxItems(preTaxItems.map(item => item.id === id ? { ...item, [field]: value } : item));
    };
    const removePreTaxItem = (id: string) => setPreTaxItems(preTaxItems.filter(item => item.id !== id));

    const addPostTaxItem = () => setPostTaxItems([...postTaxItems, { id: Date.now().toString(), name: 'Advance Paid', amount: 0, operation: 'subtract' }]);
    const handlePostTaxItemChange = (id: string, field: keyof Omit<AdjustmentItem, 'id'>, value: string | number) => {
        setPostTaxItems(postTaxItems.map(item => item.id === id ? { ...item, [field]: value } : item));
    };
    const removePostTaxItem = (id: string) => setPostTaxItems(postTaxItems.filter(item => item.id !== id));

    // --- CALCULATIONS (MEMOIZED) ---
    const calculations = useMemo(() => {
        let subtotal = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;

        const calculatedItemsWithNumbers = items.map(item => {
            let mainItemTotal = 0;
            let mainItemCgst = 0;
            let mainItemSgst = 0;
            let mainItemIgst = 0;
            let calculatedSubItems = [];

            if (item.subItems.length > 0) {
                calculatedSubItems = item.subItems.map(subItem => {
                    const itemQty = subItem.qty ?? 1;
                    const itemAmount = itemQty * subItem.price;
                    let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

                    if (isIntraState) {
                        cgstAmount = itemAmount * (subItem.cgstRate / 100);
                        sgstAmount = itemAmount * (subItem.sgstRate / 100);
                    } else {
                        igstAmount = itemAmount * (subItem.igstRate / 100);
                    }
                    const totalTaxOnSubItem = cgstAmount + sgstAmount + igstAmount;
                    const totalAmount = itemAmount + totalTaxOnSubItem;

                    mainItemTotal += totalAmount; // Sum of sub-item totals
                    mainItemCgst += cgstAmount; // Sum of sub-item CGST
                    mainItemSgst += sgstAmount; // Sum of sub-item SGST
                    mainItemIgst += igstAmount; // Sum of sub-item IGST

                    subtotal += itemAmount;
                    totalCgst += cgstAmount;
                    totalSgst += sgstAmount;
                    totalIgst += igstAmount;

                    return { ...subItem, itemAmount, cgstAmount, sgstAmount, igstAmount, totalAmount };
                });
            } else {
                const itemQty = item.qty ?? 1;
                const itemAmount = item.price * itemQty;
                let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

                if (isIntraState) {
                    cgstAmount = itemAmount * (item.cgstRate / 100);
                    sgstAmount = itemAmount * (item.sgstRate / 100);
                } else {
                    igstAmount = itemAmount * (item.igstRate / 100);
                }
                const totalTaxOnItem = cgstAmount + sgstAmount + igstAmount;
                mainItemTotal = itemAmount + totalTaxOnItem; // For single item, this is its own total

                subtotal += itemAmount;
                totalCgst += cgstAmount;
                totalSgst += sgstAmount;
                totalIgst += igstAmount;
            }

            return { ...item, calculatedSubItems, totalAmount: mainItemTotal, mainItemCgst, mainItemSgst, mainItemIgst };
        });
        
        const preTaxAdjustmentTotal = preTaxItems.reduce((acc, item) => {
            const value = Number(item.amount || 0);
            return item.operation === 'subtract' ? acc - value : acc + value;
        }, 0);
        const taxableAmount = subtotal + preTaxAdjustmentTotal;
        
        const taxScalingFactor = subtotal !== 0 ? taxableAmount / subtotal : 1;
        
        const finalTotalCgst = totalCgst * taxScalingFactor;
        const finalTotalSgst = totalSgst * taxScalingFactor;
        const finalTotalIgst = totalIgst * taxScalingFactor;
        
        const totalTax = isIntraState ? finalTotalCgst + finalTotalSgst : finalTotalIgst;
        const grandTotal = taxableAmount + totalTax;
        
        const postTaxAdjustmentTotal = postTaxItems.reduce((acc, item) => {
            const value = Number(item.amount || 0);
            return item.operation === 'subtract' ? acc - value : acc + value;
        }, 0);
        const amountDue = grandTotal + postTaxAdjustmentTotal;

        return {
            calculatedItems: calculatedItemsWithNumbers.map(item => {
                const itemQty = item.qty ?? 1;
                const itemAmount = item.price * itemQty;
                let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
                 if (item.subItems.length === 0) { // Only calculate for single items here, sub-item totals are already in mainItemCgst etc.
                     if (isIntraState) {
                        cgstAmount = itemAmount * (item.cgstRate / 100);
                        sgstAmount = itemAmount * (item.sgstRate / 100);
                    } else {
                        igstAmount = itemAmount * (item.igstRate / 100);
                    }
                 }
                return {
                    ...item,
                    itemAmount: formatIndianNumber(itemAmount, 0),
                    cgstAmount: formatIndianNumber(cgstAmount, 0),
                    sgstAmount: formatIndianNumber(sgstAmount, 0),
                    igstAmount: formatIndianNumber(igstAmount, 0),
                    totalAmount: formatIndianNumber(item.totalAmount, 0), // Already sum of sub-items total for groups, or item total for single item
                    mainItemCgst: formatIndianNumber(item.mainItemCgst, 0), // Sum of sub-item CGST
                    mainItemSgst: formatIndianNumber(item.mainItemSgst, 0), // Sum of sub-item SGST
                    mainItemIgst: formatIndianNumber(item.mainItemIgst, 0), // Sum of sub-item IGST
                    calculatedSubItems: item.calculatedSubItems.map(si => ({
                        ...si,
                        itemAmount: formatIndianNumber(si.itemAmount, 0),
                        cgstAmount: formatIndianNumber(si.cgstAmount, 0),
                        sgstAmount: formatIndianNumber(si.sgstAmount, 0),
                        igstAmount: formatIndianNumber(si.igstAmount, 0),
                        totalAmount: formatIndianNumber(si.totalAmount, 0),
                    }))
                }
            }),
            subtotal: formatIndianNumber(subtotal, 0),
            taxableAmount: formatIndianNumber(taxableAmount, 0),
            totalCgst: formatIndianNumber(finalTotalCgst, 0),
            totalSgst: formatIndianNumber(finalTotalSgst, 0),
            totalIgst: formatIndianNumber(finalTotalIgst, 0),
            totalTax: formatIndianNumber(totalTax, 0),
            grandTotal: formatIndianNumber(grandTotal, 0),
            amountDue: formatIndianNumber(amountDue, 0),
            amountDueRounded: Math.round(amountDue),
        };
    }, [items, isIntraState, preTaxItems, postTaxItems]);

    const handlePrint = () => {
        window.print();
    };
    
    const handleExportPdf = () => {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            showNotification('PDF generation library not loaded. Please refresh and try again.', 'error');
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;
        let y = margin;

        // --- HEADER ---
        doc.setFontSize(20).setFont('helvetica', 'bold');
        doc.text('GOODPSYCHE', margin, y);

        doc.setFontSize(22).setFont('helvetica', 'bold');
        doc.text(invoiceTitle, pageWidth - margin, margin, { align: 'right' });
        doc.setFontSize(10).setFont('helvetica', 'normal');
        doc.text(invoiceSubtitle, pageWidth - margin, margin + 5, { align: 'right' });

        y += 8;
        doc.setFontSize(9).setFont('helvetica', 'normal');
        const companyAddress = 'Basement M-29, Vinoba Puri, Near Round Park Near Parking, Lajpat Nagar New Delhi South East Delhi, 110024';
        const addressLines = doc.splitTextToSize(companyAddress, 100);
        doc.text(addressLines, margin, y);
        y += addressLines.length * 4 + 1;
        doc.text('GSTIN: 07AAWFG0897P1ZA', margin, y);
        
        y += 10;
        doc.setLineWidth(0.5).line(margin, y, pageWidth - margin, y); // separator line
        y += 10;
        
        // --- PARTY & INVOICE DETAILS ---
        const leftBlockWidth = (pageWidth / 2) - margin - 5;
        const rightBlockX = pageWidth / 2 + 5;
        let leftY = y;
        let rightY = y;
        
        // Left Side: Party Details
        doc.setFontSize(10).setFont('helvetica', 'bold').text('Billed to:', margin, leftY);
        leftY += 5;
        doc.setFont('helvetica', 'normal');
        const billedToLines = doc.splitTextToSize(`${billedTo.name}\n${billedTo.address}\nGSTIN: ${billedTo.gstin}`, leftBlockWidth);
        doc.text(billedToLines, margin, leftY);
        leftY += billedToLines.length * 4.5 + 5;

        doc.setFont('helvetica', 'bold').text('Shipped to:', margin, leftY);
        leftY += 5;
        doc.setFont('helvetica', 'normal');
        const shippedToLines = doc.splitTextToSize(`${shippedTo.name}\n${shippedTo.address}\nGSTIN: ${shippedTo.gstin}`, leftBlockWidth);
        doc.text(shippedToLines, margin, leftY);
        
        // Right Side: Invoice Details
        const rightLabelX = rightBlockX;
        const rightValueX = pageWidth - margin;
        doc.setFont('helvetica', 'bold').text('Invoice No.:', rightLabelX, rightY);
        doc.setFont('helvetica', 'normal').text(invoiceDetails.invoiceNo, rightValueX, rightY, { align: 'right' });
        rightY += 7;
        doc.setFont('helvetica', 'bold').text('Dated:', rightLabelX, rightY);
        doc.setFont('helvetica', 'normal').text(invoiceDetails.dated, rightValueX, rightY, { align: 'right' });
        rightY += 7;
        doc.setFont('helvetica', 'bold').text('Place of Supply:', rightLabelX, rightY);
        doc.setFont('helvetica', 'normal').text(invoiceDetails.placeOfSupply, rightValueX, rightY, { align: 'right' });
        rightY += 7;
        doc.setFont('helvetica', 'bold').text('Reverse Charge:', rightLabelX, rightY);
        doc.setFont('helvetica', 'normal').text('N', rightValueX, rightY, { align: 'right' });

        y = Math.max(leftY, rightY) + 15;

        // --- ITEMS TABLE ---
        const tableHead = isIntraState
            ? [['S.N.', 'DESCRIPTION OF GOODS/SERVICES', 'HSN', 'Qty', 'Unit', 'Price', 'Amount', 'Tax %', 'CGST Amt', 'SGST Amt', 'Total']]
            : [['S.N.', 'DESCRIPTION OF GOODS/SERVICES', 'HSN', 'Qty', 'Unit', 'Price', 'Amount', 'IGST %', 'IGST Amt', 'Total']];
        
        const tableBody: any[] = [];
        calculations.calculatedItems.forEach((item, index) => {
            if (item.subItems.length > 0) {
                // Main Item Header Row (bold, no background, no totals)
                let mainItemContent = item.name;
                if (item.description) {
                    mainItemContent += `\n${item.description}`;
                }

                tableBody.push([
                    { content: index + 1, styles: { fontStyle: 'bold', fillColor: [255, 255, 255] } }, // S.N.
                    { content: mainItemContent, colSpan: isIntraState ? 10 : 9, styles: { fontStyle: 'bold', halign: 'left', fillColor: [255, 255, 255] } }, // DESCRIPTION to TOTAL
                ]);


                item.calculatedSubItems.forEach(subItem => {
                    let description = subItem.name;
                    if (subItem.description) {
                        description += `\n${subItem.description}`;
                    }
                    if (isIntraState) {
                         tableBody.push(['', description, subItem.hsn, subItem.qty ?? '', subItem.unit, formatIndianNumber(subItem.price, 0), subItem.itemAmount, subItem.cgstRate, subItem.cgstAmount, subItem.sgstAmount, subItem.totalAmount]);
                    } else {
                         tableBody.push(['', description, subItem.hsn, subItem.qty ?? '', subItem.unit, formatIndianNumber(subItem.price, 0), subItem.itemAmount, subItem.igstRate, subItem.igstAmount, subItem.totalAmount]);
                    }
                });
                
                // Sub-item Group Total Row (after sub-items)
                const groupTotalRowStyle = { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: 50 }; // No background for group total
                const groupTotalContent = `Group Total for ${item.name}`;

                // Add empty row for spacing
                tableBody.push([
                    { content: '', colSpan: isIntraState ? 11 : 10, styles: { fillColor: [255, 255, 255], minCellHeight: 3 } }
                ]);

                if (isIntraState) {
                    tableBody.push([
                        { content: '', styles: groupTotalRowStyle }, // S.N.
                        { content: groupTotalContent, colSpan: 6, styles: { ...groupTotalRowStyle, halign: 'right' } }, // DESCRIPTION to AMOUNT
                        { content: '', styles: groupTotalRowStyle }, // Tax % (empty)
                        { content: item.mainItemCgst, styles: { ...groupTotalRowStyle, halign: 'right' } }, // CGST Amt
                        { content: item.mainItemSgst, styles: { ...groupTotalRowStyle, halign: 'right' } }, // SGST Amt
                        { content: item.totalAmount, styles: { ...groupTotalRowStyle, halign: 'right' } }, // Total
                    ]);
                } else { // Inter-state
                    tableBody.push([
                        { content: '', styles: groupTotalRowStyle }, // S.N.
                        { content: groupTotalContent, colSpan: 5, styles: { ...groupTotalRowStyle, halign: 'right' } }, // DESCRIPTION to AMOUNT
                        { content: '', styles: groupTotalRowStyle }, // IGST % (empty)
                        { content: item.mainItemIgst, styles: { ...groupTotalRowStyle, halign: 'right' } }, // IGST Amt
                        { content: item.totalAmount, styles: { ...groupTotalRowStyle, halign: 'right' } }, // Total
                    ]);
                }


            } else {
                let mainItemContent = item.name;
                if (item.description) {
                    mainItemContent += `\n${item.description}`;
                }
                 if (isIntraState) {
                    tableBody.push([index + 1, mainItemContent, item.hsn, item.qty ?? '', item.unit, formatIndianNumber(item.price, 0), item.itemAmount, item.cgstRate, item.cgstAmount, item.sgstAmount, item.totalAmount]);
                 } else {
                    tableBody.push([index + 1, mainItemContent, item.hsn, item.qty ?? '', item.unit, formatIndianNumber(item.price, 0), item.itemAmount, item.igstRate, item.igstAmount, item.totalAmount]);
                 }
            }
        });
        
        (doc as any).autoTable({
            head: tableHead, body: tableBody, startY: y, theme: 'grid',
            headStyles: { fillColor: [230, 230, 230], textColor: 20, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 1.5, valign: 'top' },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 'auto' },
                3: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' },
                7: { halign: 'right' },
                8: { halign: 'right' },
                9: { halign: 'right' },
                10: { halign: 'right' },
            },
        });

        y = (doc as any).autoTable.previous.finalY + 10;
        const startY = y;
        let leftFinalY = startY;
        let rightFinalY = startY;

        // --- TOTALS (RIGHT) ---
        const totalsX = pageWidth * 0.6;
        doc.setFontSize(10).setFont('helvetica', 'normal');
        doc.text('Subtotal:', totalsX, rightFinalY);
        doc.text(`₹ ${calculations.subtotal}`, pageWidth - margin, rightFinalY, { align: 'right' });
        rightFinalY += 7;

        preTaxItems.forEach(item => {
            doc.text(`${item.name}:`, totalsX, rightFinalY);
            const amountText = `${item.operation === 'subtract' ? '-' : ''} ₹ ${formatIndianNumber(item.amount, 0)}`;
            doc.text(amountText, pageWidth - margin, rightFinalY, { align: 'right' });
            rightFinalY += 7;
        });

        doc.setFont('helvetica', 'bold');
        doc.text('Taxable Amount:', totalsX, rightFinalY);
        doc.text(`₹ ${calculations.taxableAmount}`, pageWidth - margin, rightFinalY, { align: 'right' });
        rightFinalY += 7;
        doc.setFont('helvetica', 'normal');

        if (isIntraState) {
            doc.text('CGST Amount:', totalsX, rightFinalY);
            doc.text(`₹ ${calculations.totalCgst}`, pageWidth - margin, rightFinalY, { align: 'right' });
            rightFinalY += 7;
            doc.text('SGST Amount:', totalsX, rightFinalY);
            doc.text(`₹ ${calculations.totalSgst}`, pageWidth - margin, rightFinalY, { align: 'right' });
            rightFinalY += 7;
        } else {
            doc.text('IGST Amount:', totalsX, rightFinalY);
            doc.text(`₹ ${calculations.totalIgst}`, pageWidth - margin, rightFinalY, { align: 'right' });
            rightFinalY += 7;
        }

        doc.setLineWidth(0.2).line(totalsX - 5, rightFinalY - 2, pageWidth - margin, rightFinalY - 2);
        doc.setFontSize(11).setFont('helvetica', 'bold');
        doc.text('Grand Total:', totalsX, rightFinalY);
        doc.text(`₹ ${calculations.grandTotal}`, pageWidth - margin, rightFinalY, { align: 'right' });
        rightFinalY += 7;
        doc.setFontSize(10).setFont('helvetica', 'normal');
        
        postTaxItems.forEach(item => {
            doc.text(`${item.name}:`, totalsX, rightFinalY);
            const amountText = `${item.operation === 'subtract' ? '-' : ''} ₹ ${formatIndianNumber(item.amount, 0)}`;
            doc.text(amountText, pageWidth - margin, rightFinalY, { align: 'right' });
            rightFinalY += 7;
        });

        doc.setFontSize(12).setFont('helvetica', 'bold');
        doc.text('Amount Due:', totalsX, rightFinalY);
        doc.text(`₹ ${calculations.amountDue}`, pageWidth - margin, rightFinalY, { align: 'right' });
        
        // --- BANK, TERMS & AMOUNT IN WORDS (LEFT) ---
        const leftBlockPdfWidth = pageWidth * 0.58 - margin;
        
        // Bank Details
        doc.setFontSize(9).setFont('helvetica', 'bold').text('Bank Details', margin, leftFinalY);
        leftFinalY += 5;
        doc.setFontSize(8).setFont('helvetica', 'normal');
        const bankDetails = `Account Name: GoodPhysche\nAccount No: 083105501016\nIFSC : ICICI0000831\nBANK: ICICI Bank\nBranch: Laxmi Nagar\nUPI ID: goodpsyche.ibz@icici`;
        const bankDetailsLines = doc.splitTextToSize(bankDetails, leftBlockPdfWidth);
        doc.text(bankDetailsLines, margin, leftFinalY);
        leftFinalY += bankDetailsLines.length * 4 + 5;

        // Terms & Conditions
        doc.setFontSize(9).setFont('helvetica', 'bold').text('Terms & Conditions', margin, leftFinalY);
        leftFinalY += 5;
        doc.setFontSize(8).setFont('helvetica', 'normal');
        const termsLines = doc.splitTextToSize(terms, leftBlockPdfWidth);
        doc.text(termsLines, margin, leftFinalY);
        leftFinalY += termsLines.length * 4 + 5;
        
        // Amount in Words
        doc.setFontSize(10).setFont('helvetica', 'normal');
        const amountInWords = `Rupees ${numberToWords(calculations.amountDueRounded)}`;
        const wrappedAmount = doc.splitTextToSize(amountInWords, leftBlockPdfWidth);
        doc.text('Amount in Words:', margin, leftFinalY);
        doc.setFont('helvetica', 'bold').text(wrappedAmount, margin, leftFinalY + 5);
        leftFinalY += wrappedAmount.length * 5;
        
        y = Math.max(leftFinalY, rightFinalY) + 15;
        
        // --- FOOTER ---
        if (y > pageHeight - 50) {
            doc.addPage();
            y = margin;
        }
        
        doc.setLineWidth(0.5).line(margin, y, pageWidth - margin, y);
        y += 7;
        
        const footerRightX = pageWidth - margin;
        
        doc.setFont('helvetica', 'bold').setFontSize(10).text('For GOODPSYCHE', footerRightX, y + 5, { align: 'right' });
        
        y += 40;
        doc.setLineWidth(0.2).line(footerRightX - 60, y, footerRightX, y);
        y += 5;
        doc.setFont('helvetica', 'bold').setFontSize(10).text('Authorised Signatory', footerRightX, y, { align: 'right' });
        
        // --- SAVE ---
        doc.save(`Invoice-${invoiceDetails.invoiceNo || 'draft'}.pdf`);
        showNotification('PDF exported successfully!', 'success');
    };


    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-8 font-sans">
             {notification && (
                <div 
                  className={`no-print fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white z-60 transition-transform transform ${
                    notification ? 'translate-x-0' : 'translate-x-full'
                  } ${notificationBgClasses[notification.type]}`}
                >
                    {notification.message}
                </div>
            )}
            <div className="max-w-5xl mx-auto bg-white shadow-2xl rounded-lg p-6 sm:p-10 print-container">
                {/* Header */}
                <header className="flex justify-between items-start pb-4 border-b-2 border-gray-200">
                    <div className="text-left">
                        <h1 className="text-2xl font-bold text-gray-800 tracking-wider">GOODPSYCHE</h1>
                        <p className="text-sm text-gray-500 max-w-xs">
                            Basement M-29, Vinoba Puri, Near Round Park Near Parking, Lajpat Nagar New Delhi South East Delhi, 110024
                        </p>
                        <p className="text-sm text-gray-600 mt-2">
                            <span className="font-semibold">GSTIN:</span> 07AAWFG0897P1ZA
                        </p>
                    </div>
                    <div className="text-right">
                        <EditableField
                            value={invoiceTitle}
                            onChange={(e) => setInvoiceTitle(e.target.value)}
                            className="text-3xl font-bold text-gray-800 uppercase text-right w-full"
                        />
                        <EditableField
                            value={invoiceSubtitle}
                            onChange={(e) => setInvoiceSubtitle(e.target.value)}
                            className="text-sm text-gray-500 text-right w-full"
                        />
                    </div>
                </header>

                {/* Invoice Details & Party Details */}
                <section className="grid md:grid-cols-3 gap-6 mt-6 items-start">
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                         <div>
                            <strong className="text-gray-600">Billed to:</strong>
                            <EditableTextarea value={billedTo.name} onChange={(e) => setBilledTo({ ...billedTo, name: capitalizeWords(e.target.value) })} placeholder="Party Name" className="font-bold text-gray-800" />
                            <EditableTextarea value={billedTo.address} onChange={(e) => setBilledTo({ ...billedTo, address: e.target.value })} placeholder="Party Address" className="text-sm text-gray-600" />
                             <div className="flex flex-col mt-1">
                                <div className="flex items-center">
                                    <strong className="text-gray-600 text-sm mr-2 whitespace-nowrap">GSTIN/UIN:</strong>
                                    <input
                                        type="text"
                                        value={billedTo.gstin}
                                        onChange={(e) => handleGstinChange('billedTo', e.target.value)}
                                        className={`bg-transparent p-1 w-full focus:outline-none focus:bg-blue-50/50 rounded-md transition-colors text-sm text-gray-800 uppercase ${gstinErrors.billedTo ? 'border border-red-500' : 'border-b border-transparent'}`}
                                        maxLength={15}
                                    />
                                </div>
                                {gstinErrors.billedTo && <p className="text-red-500 text-xs mt-1 ml-2">{gstinErrors.billedTo}</p>}
                            </div>
                         </div>
                         <div>
                            <strong className="text-gray-600">Shipped to:</strong>
                            <EditableTextarea value={shippedTo.name} onChange={(e) => setShippedTo({ ...shippedTo, name: capitalizeWords(e.target.value) })} placeholder="Party Name" className="font-bold text-gray-800" />
                            <EditableTextarea value={shippedTo.address} onChange={(e) => setShippedTo({ ...shippedTo, address: e.target.value })} placeholder="Party Address" className="text-sm text-gray-600" />
                             <div className="flex flex-col mt-1">
                                <div className="flex items-center">
                                    <strong className="text-gray-600 text-sm mr-2 whitespace-nowrap">GSTIN/UIN:</strong>
                                    <input
                                        type="text"
                                        value={shippedTo.gstin}
                                        onChange={(e) => handleGstinChange('shippedTo', e.target.value)}
                                        className={`bg-transparent p-1 w-full focus:outline-none focus:bg-blue-50/50 rounded-md transition-colors text-sm text-gray-800 uppercase ${gstinErrors.shippedTo ? 'border border-red-500' : 'border-b border-transparent'}`}
                                        maxLength={15}
                                    />
                                </div>
                                {gstinErrors.shippedTo && <p className="text-red-500 text-xs mt-1 ml-2">{gstinErrors.shippedTo}</p>}
                            </div>
                         </div>
                    </div>
                    <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-0.5 text-sm text-gray-700 items-center">
                        <span className="font-semibold whitespace-nowrap">Invoice No.:</span>
                        <EditableField value={invoiceDetails.invoiceNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, invoiceNo: e.target.value})} className="text-right w-full" />
                        
                        <span className="font-semibold whitespace-nowrap">Place of Supply:</span>
                        <EditableField value={invoiceDetails.placeOfSupply} onChange={(e) => setInvoiceDetails({...invoiceDetails, placeOfSupply: e.target.value})} className="text-right w-full" />

                        <span className="font-semibold whitespace-nowrap">Dated:</span>
                        <input type="date" value={invoiceDetails.dated} onChange={(e) => setInvoiceDetails({...invoiceDetails, dated: e.target.value})} className="bg-transparent text-right w-full focus:outline-none focus:bg-blue-50/50 rounded-md p-1"/>
                        
                        <span className="font-semibold whitespace-nowrap">Reverse Charge:</span>
                        <span className="text-right w-full pr-1">N</span>
                    </div>
                </section>

                {/* Items Table */}
                <section className="mt-8">
                    <table className="w-full text-sm text-left text-gray-500 table-fixed">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th className="px-2 py-3 w-[4%] text-center">S.N.</th>
                                <th className="px-2 py-3 w-[32%]">DESCRIPTION OF GOODS/SERVICES</th>
                                <th className="px-1 py-3 w-[8%]">HSN/SAC</th>
                                <th className="px-1 py-3 w-[5%] text-right">Qty</th>
                                <th className="px-1 py-3 w-[6%]">Unit</th>
                                <th className="px-2 py-3 w-[8%] text-right">Price</th>
                                <th className="px-2 py-3 w-[8%] text-right">Amount</th>
                                {isIntraState ? (
                                    <>
                                        <th className="px-1 py-3 w-[6%] text-center">Tax %</th>
                                        <th className="px-1 py-3 w-[7%] text-right">CGST Amt</th>
                                        <th className="px-1 py-3 w-[7%] text-right">SGST Amt</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-1 py-3 w-[8%] text-center">IGST %</th>
                                        <th className="px-1 py-3 w-[9%] text-right">IGST Amt</th>
                                    </>
                                )}
                                <th className="px-2 py-3 w-[9%] text-right">Total</th>
                                <th className="p-1 w-[3%] no-print"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {calculations.calculatedItems.map((item, index) => (
                                <React.Fragment key={item.id}>
                                    {/* RENDER MAIN ITEM ROW (as a simple item or a group header) */}
                                        <tr className={`border-b align-top ${item.subItems.length > 0 ? 'font-bold' : 'hover:bg-gray-50'}`}>
                                            <td className="px-2 py-2 text-center">{index + 1}</td>
                                            <td className="px-2 py-2">
                                                <EditableTextarea
                                                    value={item.name}
                                                    onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                                                    placeholder="Item Name"
                                                    className={`text-gray-800 ${item.subItems.length > 0 ? 'font-bold' : 'font-semibold'}`}
                                                />
                                                {item.description !== null && (
                                                    <EditableTextarea
                                                        value={item.description}
                                                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                                        onBlur={(e) => { if (e.target.value.trim() === '') { handleItemChange(item.id, 'description', null); } }}
                                                        placeholder="(Description)"
                                                        className="text-xs text-gray-500"
                                                    />
                                                )}
                                                <div className="no-print mt-1 pl-1 flex items-center space-x-4">
                                                    {item.description === null && (
                                                        <button onClick={() => handleItemChange(item.id, 'description', '')} className="text-xs text-blue-500 hover:text-blue-700">
                                                            + Add Description
                                                        </button>
                                                    )}
                                                    <button onClick={() => addSubItem(item.id)} className="text-xs text-blue-500 hover:text-blue-700">
                                                        + Add Sub Item
                                                    </button>
                                                </div>
                                            </td>
                                            {item.subItems.length === 0 ? (
                                                <>
                                                    <td className="px-1 py-2">
                                                        <EditableField value={item.hsn} onChange={(e) => handleItemChange(item.id, 'hsn', e.target.value)} className="w-full" />
                                                    </td>
                                                    <td className="px-1 py-2 text-right">
                                                        <EditableNullableNumberField value={item.qty} onChange={(val) => handleItemChange(item.id, 'qty', val)} className="w-full text-right bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" decimalPlaces={0} />
                                                    </td>
                                                    <td className="px-1 py-2">
                                                        <EditableField value={item.unit} onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)} className="w-full" />
                                                    </td>
                                                    <td className="px-2 py-2 text-right">
                                                        <EditableNumberField value={item.price} onChange={(val) => handleItemChange(item.id, 'price', val)} className="w-full text-right bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" decimalPlaces={0} />
                                                    </td>
                                                    <td className="px-2 py-2 text-right font-medium">{item.itemAmount}</td>
                                                    {isIntraState ? (
                                                        <>
                                                            <td className="px-1 py-2 text-center border-l"><EditableNumberField value={item.cgstRate} onChange={(val) => handleItemChange(item.id, 'csgstRate', val)} className="w-full text-right bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" decimalPlaces={0} /></td>
                                                            <td className="px-1 py-2 text-right">{item.cgstAmount}</td>
                                                            <td className="px-1 py-2 text-right">{item.sgstAmount}</td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="px-1 py-2 text-center border-l"><EditableNumberField value={item.igstRate} onChange={(val) => handleItemChange(item.id, 'igstRate', val)} className="w-full text-right bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" decimalPlaces={0} /></td>
                                                            <td className="px-1 py-2 text-right">{item.igstAmount}</td>
                                                        </>
                                                    )}
                                                    <td className="px-2 py-2 text-right font-semibold text-gray-800">{item.totalAmount}</td>
                                                </>
                                            ) : (
                                                <td colSpan={isIntraState ? 8 : 7}></td> // Span empty cells if sub-items exist
                                            )}
                                            <td className="p-1 text-center no-print">
                                                <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100"><TrashIcon className="h-5 w-5" /></button>
                                            </td>
                                        </tr>


                                    {/* RENDER SUB-ITEMS */}
                                    {item.calculatedSubItems.map((subItem) => (
                                        <tr key={subItem.id} className="border-b hover:bg-blue-50/50 align-top">
                                            <td className="px-2 py-2 text-right text-gray-400">↳</td>
                                            <td className="px-2 py-2">
                                                <EditableTextarea value={subItem.name} onChange={(e) => handleSubItemChange(item.id, subItem.id, 'name', e.target.value)} placeholder="Sub Item Name" className="font-medium text-gray-700" />
                                                {subItem.description !== null ? (
                                                    <EditableTextarea value={subItem.description} onChange={(e) => handleSubItemChange(item.id, subItem.id, 'description', e.target.value)} onBlur={(e) => { if (e.target.value.trim() === '') { handleSubItemChange(item.id, subItem.id, 'description', null); } }} placeholder="(Description)" className="text-xs text-gray-500" />
                                                ) : (
                                                    <button onClick={() => handleSubItemChange(item.id, subItem.id, 'description', '')} className="no-print text-xs text-blue-500 hover:text-blue-700 mt-1 pl-1">+ Add Description</button>
                                                )}
                                            </td>
                                            <td className="px-1 py-2"><EditableField value={subItem.hsn} onChange={(e) => handleSubItemChange(item.id, subItem.id, 'hsn', e.target.value)} className="w-full" /></td>
                                            <td className="px-1 py-2 text-right"><EditableNullableNumberField value={subItem.qty} onChange={(val) => handleSubItemChange(item.id, subItem.id, 'qty', val)} className="w-full text-right bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" decimalPlaces={0} /></td>
                                            <td className="px-1 py-2"><EditableField value={subItem.unit} onChange={(e) => handleSubItemChange(item.id, subItem.id, 'unit', e.target.value)} className="w-full" /></td>
                                            <td className="px-2 py-2 text-right"><EditableNumberField value={subItem.price} onChange={(val) => handleSubItemChange(item.id, subItem.id, 'price', val)} className="w-full text-right bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" decimalPlaces={0} /></td>
                                            <td className="px-2 py-2 text-right font-medium">{subItem.itemAmount}</td>
                                            {isIntraState ? (
                                                <>
                                                    <td className="px-1 py-2 text-center border-l"><EditableNumberField value={subItem.cgstRate} onChange={(val) => handleSubItemChange(item.id, subItem.id, 'csgstRate', val)} className="w-full text-right bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" decimalPlaces={0} /></td>
                                                    <td className="px-1 py-2 text-right">{subItem.cgstAmount}</td>
                                                    <td className="px-1 py-2 text-right">{subItem.sgstAmount}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-1 py-2 text-center border-l"><EditableNumberField value={subItem.igstRate} onChange={(val) => handleSubItemChange(item.id, subItem.id, 'igstRate', val)} className="w-full text-right bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" decimalPlaces={0} /></td>
                                                    <td className="px-1 py-2 text-right">{subItem.igstAmount}</td>
                                                </>
                                            )}
                                            <td className="px-2 py-2 text-right font-semibold text-gray-800">{subItem.totalAmount}</td>
                                            <td className="p-1 text-center no-print">
                                                <button onClick={() => removeSubItem(item.id, subItem.id)} className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100"><TrashIcon className="h-4 w-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    <div className="flex justify-start mt-4 no-print">
                        <button onClick={addItem} className="flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800">
                            <PlusCircleIcon className="h-5 w-5 mr-1" />
                            Add Item
                        </button>
                    </div>
                </section>

                {/* Totals, Bank, Terms & Amount in Words */}
                <section className="mt-6 flex flex-col md:flex-row justify-between gap-8">
                    <div className="w-full md:w-7/12 flex flex-col gap-4">
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-2">Bank Details</h4>
                            <div className="text-xs text-gray-600 p-2 border border-gray-200 rounded-md space-y-1">
                                <p><strong className="text-gray-700">Account Name:</strong> GoodPhysche</p>
                                <p><strong className="text-gray-700">Account No:</strong> 083105501016</p>
                                <p><strong className="text-gray-700">IFSC:</strong> ICICI0000831</p>
                                <p><strong className="text-gray-700">BANK:</strong> ICICI Bank</p>
                                <p><strong className="text-gray-700">Branch:</strong> Laxmi Nagar</p>
                                <p><strong className="text-gray-700">UPI ID:</strong> goodpsyche.ibz@icici</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-2">Terms & Conditions</h4>
                            <EditableTextarea
                                value={terms}
                                onChange={(e) => setTerms(e.target.value)}
                                className="text-xs text-gray-500 w-full p-2 border border-gray-200 rounded-md"
                            />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">
                                Amount in Words: <span className="font-semibold text-gray-800">{`Rupees ${numberToWords(calculations.amountDueRounded)}`}</span>
                            </p>
                        </div>
                    </div>
                    <div className="w-full md:w-5/12 text-gray-700 text-sm">
                        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                            {/* Subtotal */}
                            <span className="py-2 border-b">Subtotal</span>
                            <span className="font-semibold py-2 border-b text-right">₹ {calculations.subtotal}</span>
                            
                            {/* Pre-tax items */}
                            {preTaxItems.map(item => (
                                 <React.Fragment key={item.id}>
                                     <div className="flex items-center py-1">
                                         <div className="mr-2 flex rounded-md shadow-sm no-print">
                                            <button
                                                onClick={() => handlePreTaxItemChange(item.id, 'operation', 'add')}
                                                title="Add to total"
                                                className={`px-2 py-0.5 rounded-l-md border border-gray-300 text-sm font-bold focus:outline-none transition-colors ${
                                                    item.operation === 'add' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                            >+</button>
                                            <button
                                                onClick={() => handlePreTaxItemChange(item.id, 'operation', 'subtract')}
                                                title="Subtract from total"
                                                className={`-ml-px px-2 py-0.5 rounded-r-md border border-gray-300 text-sm font-bold focus:outline-none transition-colors ${
                                                    item.operation === 'subtract' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                            >-</button>
                                        </div>
                                         <EditableField value={item.name} onChange={e => handlePreTaxItemChange(item.id, 'name', e.target.value)} className="w-24" />
                                         <button onClick={() => removePreTaxItem(item.id)} className="no-print text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 ml-1">
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                     </div>
                                     <EditableNumberField value={item.amount} onChange={val => handlePreTaxItemChange(item.id, 'amount', Math.abs(val))} className="w-28 text-right bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" decimalPlaces={0}/>
                                 </React.Fragment>
                            ))}
                            <div className="col-span-2 text-left mt-1 no-print">
                                 <button onClick={addPreTaxItem} className="flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800">
                                    <PlusCircleIcon className="h-4 w-4 mr-1" />
                                    Add Pre-Tax Item
                                </button>
                            </div>
                            
                            {/* Taxable Amount */}
                            <span className="font-bold py-2 border-t border-b mt-2">Taxable Amount</span>
                            <span className="font-bold py-2 border-t border-b mt-2 text-right">₹ {calculations.taxableAmount}</span>
                            
                             {isIntraState ? (
                                <>
                                    <span className="py-2 border-b">Total CGST</span>
                                    <span className="font-semibold py-2 border-b text-right">₹ {calculations.totalCgst}</span>
                                    <span className="py-2 border-b">Total SGST</span>
                                    <span className="font-semibold py-2 border-b text-right">₹ {calculations.totalSgst}</span>
                                </>
                            ) : (
                                <>
                                    <span className="py-2 border-b">Total IGST</span>
                                    <span className="font-semibold py-2 border-b text-right">₹ {calculations.totalIgst}</span>
                                </>
                            )}
                            
                            {/* Grand Total */}
                            <div className="col-span-2 flex justify-between py-3 my-2 bg-gray-100 px-4 -mx-2 rounded-md font-bold text-gray-800">
                                <span>Grand Total</span>
                                <span>₹ {calculations.grandTotal}</span>
                            </div>
                            
                            {/* Post-tax items */}
                            {postTaxItems.map(item => (
                                 <React.Fragment key={item.id}>
                                     <div className="flex items-center py-1">
                                         <div className="mr-2 flex rounded-md shadow-sm no-print">
                                            <button
                                                onClick={() => handlePostTaxItemChange(item.id, 'operation', 'add')}
                                                title="Add to total"
                                                className={`px-2 py-0.5 rounded-l-md border border-gray-300 text-sm font-bold focus:outline-none transition-colors ${
                                                    item.operation === 'add' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                            >+</button>
                                            <button
                                                onClick={() => handlePostTaxItemChange(item.id, 'operation', 'subtract')}
                                                title="Subtract from total"
                                                className={`-ml-px px-2 py-0.5 rounded-r-md border border-gray-300 text-sm font-bold focus:outline-none transition-colors ${
                                                    item.operation === 'subtract' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                            >-</button>
                                        </div>
                                         <EditableField value={item.name} onChange={e => handlePostTaxItemChange(item.id, 'name', e.target.value)} className="w-24" />
                                         <button onClick={() => removePostTaxItem(item.id)} className="no-print text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 ml-1">
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                     </div>
                                     <EditableNumberField value={item.amount} onChange={val => handlePostTaxItemChange(item.id, 'amount', Math.abs(val))} className="w-28 text-right bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" decimalPlaces={0}/>
                                 </React.Fragment>
                            ))}
                            <div className="col-span-2 text-left mt-1 no-print">
                                 <button onClick={addPostTaxItem} className="flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800">
                                    <PlusCircleIcon className="h-4 w-4 mr-1" />
                                    Add Post-Tax Item
                                </button>
                            </div>

                            {/* Amount Due */}
                            <div className="col-span-2 flex justify-between py-3 mt-2 bg-blue-100 px-4 -mx-2 rounded-md font-bold text-lg text-blue-800">
                                <span>Amount Due</span>
                                <span>₹ {calculations.amountDue}</span>
                            </div>
                        </div>
                    </div>
                </section>
                
                {/* Footer */}
                <footer className="mt-10 pt-6 border-t-2 border-gray-200 flex justify-end">
                    <div className="text-center w-full max-w-xs">
                         <h4 className="font-semibold text-gray-700">For GOODPSYCHE</h4>
                         <div className="h-24 mt-4">
                            {/* Empty space for signature */}
                         </div>
                         <div className="border-t-2 mt-2 pt-1">
                             <p className="font-semibold text-gray-800">Authorised Signatory</p>
                         </div>
                    </div>
                </footer>
            </div>
             {/* Action Buttons */}
            <div className="max-w-5xl mx-auto mt-6 flex justify-end items-center space-x-3 no-print">
                <button onClick={handleReset} className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <ArrowUturnLeftIcon className="h-5 w-5 mr-2"/> Reset
                </button>
                <button onClick={handlePrint} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                     <PrinterIcon className="h-5 w-5 mr-2"/> Print
                </button>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);