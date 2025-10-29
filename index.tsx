import React, { useState, useMemo, useCallback, ChangeEvent, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { PlusCircleIcon, TrashIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, ArrowPathIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/solid';

// --- TYPE DEFINITIONS ---
interface InvoiceItem {
  id: string;
  name: string;
  detailedDescription: string;
  hsn: string;
  qty: number;
  unit: string;
  price: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
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

const formatIndianNumber = (numStr: string | number, decimalPlaces = 2): string => {
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
        className={`bg-transparent p-1 w-full focus:outline-none focus:bg-blue-50/50 rounded-md transition-colors ${className}`}
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
        />
    );
};

interface EditableNumberFieldProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
    decimalPlaces?: number;
}

const EditableNumberField: React.FC<EditableNumberFieldProps> = ({ value, onChange, className = '', decimalPlaces = 2 }) => {
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
        } else if (newString === '' || newString === '.') {
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
            placeOfSupply: '',
        },
        billedTo: { name: '', address: '', gstin: '' },
        shippedTo: { name: '', address: '', gstin: '' },
        items: [{
            id: Date.now().toString(),
            name: '', detailedDescription: '', hsn: '', qty: 1, unit: 'Pcs.', price: 0, cgstRate: 9, sgstRate: 9, igstRate: 18
        }] as InvoiceItem[],
        signature: null as string | null,
        terms: `1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if the payment is not made with in the stipulated time.\n3. Subject to 'Delhi' Jurisdiction only.`,
    });

    const [invoiceDetails, setInvoiceDetails] = useState(getInitialState().invoiceDetails);
    const [billedTo, setBilledTo] = useState(getInitialState().billedTo);
    const [shippedTo, setShippedTo] = useState(getInitialState().shippedTo);
    const [items, setItems] = useState<InvoiceItem[]>(getInitialState().items);
    const [signature, setSignature] = useState<string | null>(getInitialState().signature);
    const [terms, setTerms] = useState(getInitialState().terms);
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


    // --- LOCALSTORAGE HANDLERS ---
    const saveInvoice = useCallback(() => {
        try {
            const invoiceData = {
                invoiceDetails,
                billedTo,
                shippedTo,
                items,
                signature,
                terms,
            };
            localStorage.setItem('invoiceData', JSON.stringify(invoiceData));
            showNotification('Invoice progress saved successfully!');
        } catch (error) {
            console.error("Failed to save invoice:", error);
            showNotification("Error saving invoice. See console for details.", 'error');
        }
    }, [invoiceDetails, billedTo, shippedTo, items, signature, terms]);

    const loadInvoice = useCallback((showAlert = false) => {
        try {
            const savedData = localStorage.getItem('invoiceData');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                setInvoiceDetails(parsedData.invoiceDetails);
                setBilledTo(parsedData.billedTo);
                setShippedTo(parsedData.shippedTo);
                
                const migratedItems = parsedData.items.map((item: any) => {
                    if (item.description !== undefined && item.name === undefined) {
                        item = { ...item, name: item.description, detailedDescription: '', description: undefined };
                    }
                    if (item.detailedDescription !== undefined) {
                        let desc = item.detailedDescription.trim();
                        if (desc) { 
                            if (desc.startsWith('(')) desc = desc.substring(1);
                            if (desc.endsWith(')')) desc = desc.substring(0, desc.length - 1);
                            item.detailedDescription = `(${desc.trim()})`;
                        }
                    } else {
                        item.detailedDescription = '';
                    }
                    return item;
                });
                setItems(migratedItems);

                setSignature(parsedData.signature);
                setTerms(parsedData.terms);
                if (showAlert) {
                    showNotification('Invoice loaded successfully!', 'info');
                }
            } else {
                if (showAlert) {
                    showNotification('No saved invoice data found.', 'info');
                }
            }
        } catch (error) {
            console.error("Failed to load invoice from localStorage:", error);
            if (showAlert) {
                showNotification('Could not load saved invoice. Data might be corrupt.', 'error');
            }
        }
    }, []);

    useEffect(() => {
        loadInvoice();
    }, [loadInvoice]);
    
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
                if (isIntraState) {
                    // Switched to Intra-State (CGST/SGST) from IGST
                    const newRate = item.igstRate / 2;
                    return { ...item, cgstRate: newRate, sgstRate: newRate };
                } else {
                    // Switched to Inter-State (IGST) from CGST/SGST
                    const newRate = item.cgstRate + item.sgstRate;
                    return { ...item, igstRate: newRate };
                }
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
            setSignature(initialState.signature);
            setGstinErrors({ billedTo: '', shippedTo: '' });
            
            try {
                localStorage.removeItem('invoiceData');
                showNotification('Invoice has been reset and all data cleared.', 'info');
            } catch (error) {
                console.error("Failed to clear saved invoice data:", error);
                showNotification("Reset successful, but failed to clear saved data.", 'error');
            }
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

    const handleItemChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
        setItems(prevItems =>
            prevItems.map(item => {
                if (item.id === id) {
                    let processedValue = value;
                    if (field === 'name' && typeof value === 'string') {
                        processedValue = capitalizeFirstLetter(value);
                    }
                    
                    const updatedItem = { ...item, [field]: processedValue };
                    if (field === 'cgstRate') {
                        updatedItem.sgstRate = Number(value);
                    } else if (field === 'sgstRate') {
                        updatedItem.cgstRate = Number(value);
                    }
                    return updatedItem;
                }
                return item;
            })
        );
    };

    const handleItemBlur = (id: string, field: keyof InvoiceItem) => {
        if (field !== 'detailedDescription') return;

        setItems(prevItems =>
            prevItems.map(item => {
                if (item.id === id) {
                    let value = item.detailedDescription.trim();
                    if (value) {
                        if (value.startsWith('(')) {
                            value = value.substring(1);
                        }
                        if (value.endsWith(')')) {
                            value = value.substring(0, value.length - 1);
                        }
                        value = `(${value.trim()})`;
                    }
                    return { ...item, detailedDescription: value };
                }
                return item;
            })
        );
    };

    const addItem = () => {
        const newItem: InvoiceItem = {
            id: Date.now().toString(),
            name: '',
            detailedDescription: '',
            hsn: '',
            qty: 1,
            unit: 'Pcs.',
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

    const handleSignatureUpload = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setSignature(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // --- CALCULATIONS (MEMOIZED) ---
    const calculations = useMemo(() => {
        let taxableAmount = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;
        let totalQty = 0;

        const calculatedItemsWithNumbers = items.map(item => {
            const itemAmount = item.qty * item.price;
            let cgstAmount = 0;
            let sgstAmount = 0;
            let igstAmount = 0;
            
            if (isIntraState) {
                cgstAmount = itemAmount * (item.cgstRate / 100);
                sgstAmount = itemAmount * (item.sgstRate / 100);
            } else {
                igstAmount = itemAmount * (item.igstRate / 100);
            }

            const totalAmount = itemAmount + cgstAmount + sgstAmount + igstAmount;

            taxableAmount += itemAmount;
            totalQty += item.qty;
            totalCgst += cgstAmount;
            totalSgst += sgstAmount;
            totalIgst += igstAmount;

            return {
                ...item,
                itemAmount,
                cgstAmount,
                sgstAmount,
                igstAmount,
                totalAmount,
            };
        });

        const totalTax = isIntraState ? totalCgst + totalSgst : totalIgst;
        const grandTotal = taxableAmount + totalTax;

        return {
            calculatedItems: calculatedItemsWithNumbers.map(item => ({
                ...item,
                cgstAmount: formatIndianNumber(item.cgstAmount),
                sgstAmount: formatIndianNumber(item.sgstAmount),
                igstAmount: formatIndianNumber(item.igstAmount),
                totalAmount: formatIndianNumber(item.totalAmount),
            })),
            totalQty,
            taxableAmount: formatIndianNumber(taxableAmount),
            totalCgst: formatIndianNumber(totalCgst),
            totalSgst: formatIndianNumber(totalSgst),
            totalIgst: formatIndianNumber(totalIgst),
            totalTax: formatIndianNumber(totalTax),
            grandTotal: formatIndianNumber(grandTotal),
            grandTotalRounded: Math.round(grandTotal),
        };
    }, [items, isIntraState]);

    const handlePrint = () => {
        window.print();
    };


    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-8 font-sans">
             {notification && (
                <div 
                  className={`no-print fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white z-50 transition-transform transform ${
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
                            Basement M-29, Vinoba Puri,, Near Round Park Near Parking, Lajpat Nagar New Delhi South East Delhi, 110024
                        </p>
                        <p className="text-sm text-gray-600 mt-2">
                            <span className="font-semibold">GSTIN:</span> 07AAWFG0897P1ZA
                        </p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-3xl font-bold text-gray-800 uppercase">Tax Invoice</h2>
                        <p className="text-sm text-gray-500">Original Copy</p>
                    </div>
                </header>

                {/* Invoice Details & Party Details */}
                <section className="grid md:grid-cols-3 gap-6 mt-6">
                    <div className="md:col-span-2 grid grid-cols-2 gap-6">
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
                    <div className="text-sm text-gray-700 space-y-2">
                        <div className="flex justify-between">
                            <span className="font-semibold">Invoice No.:</span>
                            <EditableField value={invoiceDetails.invoiceNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, invoiceNo: e.target.value})} className="text-right" />
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">Dated:</span>
                             <input type="date" value={invoiceDetails.dated} onChange={(e) => setInvoiceDetails({...invoiceDetails, dated: e.target.value})} className="bg-transparent text-right w-full focus:outline-none focus:bg-blue-50/50 rounded-md p-1"/>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">Place of Supply:</span>
                             <EditableField value={invoiceDetails.placeOfSupply} onChange={(e) => setInvoiceDetails({...invoiceDetails, placeOfSupply: e.target.value})} className="text-right" />
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">Reverse Charge:</span>
                            <span>N</span>
                        </div>
                    </div>
                </section>

                {/* Items Table */}
                <section className="mt-8">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-y">
                                <tr>
                                    <th scope="col" className="px-4 py-3 w-10">S.N.</th>
                                    <th scope="col" className="px-4 py-3 min-w-[200px]">Description of Goods</th>
                                    <th scope="col" className="px-4 py-3">HSN/SAC</th>
                                    <th scope="col" className="px-4 py-3 text-right">Qty</th>
                                    <th scope="col" className="px-4 py-3">Unit</th>
                                    <th scope="col" className="px-4 py-3 text-right">Price</th>
                                    {isIntraState ? (
                                        <>
                                            <th scope="col" className="px-4 py-3 text-center" colSpan={2}>CGST</th>
                                            <th scope="col" className="px-4 py-3 text-center" colSpan={2}>SGST</th>
                                        </>
                                    ) : (
                                        <th scope="col" className="px-4 py-3 text-center" colSpan={4}>IGST</th>
                                    )}
                                    <th scope="col" className="px-4 py-3 text-right">Amount (₹)</th>
                                    <th scope="col" className="px-1 py-3 no-print"></th>
                                </tr>
                                 <tr className="text-xs text-gray-700 bg-gray-100">
                                    <th className="px-4 py-1"></th>
                                    <th className="px-4 py-1"></th>
                                    <th className="px-4 py-1"></th>
                                    <th className="px-4 py-1"></th>
                                    <th className="px-4 py-1"></th>
                                    <th className="px-4 py-1"></th>
                                    {isIntraState ? (
                                        <>
                                            <th className="px-2 py-1 text-center border-l">Rate</th>
                                            <th className="px-2 py-1 text-right border-l">Amount</th>
                                            <th className="px-2 py-1 text-center border-l">Rate</th>
                                            <th className="px-2 py-1 text-right border-l">Amount</th>
                                        </>
                                     ) : (
                                        <>
                                            <th className="px-2 py-1 text-center border-l" colSpan={2}>Rate</th>
                                            <th className="px-2 py-1 text-right border-l" colSpan={2}>Amount</th>
                                        </>
                                     )}
                                    <th className="px-4 py-1"></th>
                                    <th className="px-1 py-1 no-print"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {calculations.calculatedItems.map((item, index) => (
                                    <tr key={item.id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-2">{index + 1}</td>
                                        <td className="px-4 py-2">
                                            <EditableTextarea 
                                                value={item.name} 
                                                onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} 
                                                placeholder="Item Name"
                                                className="font-medium"
                                            />
                                            <EditableTextarea 
                                                value={item.detailedDescription} 
                                                onChange={(e) => handleItemChange(item.id, 'detailedDescription', e.target.value)} 
                                                onBlur={() => handleItemBlur(item.id, 'detailedDescription')}
                                                placeholder="(Detailed description)"
                                                className="text-xs italic w-full text-gray-500"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <EditableField value={item.hsn} onChange={(e) => handleItemChange(item.id, 'hsn', e.target.value)} />
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <EditableNumberField value={item.qty} onChange={(newValue) => handleItemChange(item.id, 'qty', newValue)} className="w-20 text-right bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" decimalPlaces={0} />
                                        </td>
                                        <td className="px-4 py-2">
                                            <EditableField value={item.unit} onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)} />
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <EditableNumberField value={item.price} onChange={(newValue) => handleItemChange(item.id, 'price', newValue)} className="w-24 text-right bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" decimalPlaces={2} />
                                        </td>
                                        
                                        {isIntraState ? (
                                            <>
                                                <td className="px-2 py-2 border-l">
                                                    <input type="number" value={item.cgstRate} onChange={(e) => handleItemChange(item.id, 'cgstRate', parseFloat(e.target.value) || 0)} className="w-14 text-center bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" />%
                                                </td>
                                                <td className="px-2 py-2 text-right border-l tabular-nums">{item.cgstAmount}</td>
                                                <td className="px-2 py-2 border-l">
                                                    <input type="number" value={item.sgstRate} onChange={(e) => handleItemChange(item.id, 'sgstRate', parseFloat(e.target.value) || 0)} className="w-14 text-center bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" />%
                                                </td>
                                                <td className="px-2 py-2 text-right border-l tabular-nums">{item.sgstAmount}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-2 py-2 border-l text-center" colSpan={2}>
                                                    <input type="number" value={item.igstRate} onChange={(e) => handleItemChange(item.id, 'igstRate', parseFloat(e.target.value) || 0)} className="w-14 text-center bg-transparent p-1 focus:outline-none focus:bg-blue-50/50 rounded-md" />%
                                                </td>
                                                <td className="px-2 py-2 text-right border-l tabular-nums" colSpan={2}>{item.igstAmount}</td>
                                            </>
                                        )}
                                        
                                        <td className="px-4 py-2 text-right font-semibold tabular-nums">{item.totalAmount}</td>
                                        <td className="px-1 py-2 no-print">
                                            <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={addItem} className="no-print mt-4 flex items-center text-sm font-medium text-blue-600 hover:text-blue-800">
                        <PlusCircleIcon className="w-5 h-5 mr-1"/>
                        Add Item
                    </button>
                </section>
                
                {/* Grand Total */}
                <section className="mt-4 flex justify-end">
                    <div className="w-full md:w-1/2 lg:w-1/3">
                        <div className="flex justify-between items-center py-2 border-t">
                            <span className="font-semibold text-gray-600">Grand Total Qty:</span>
                            <span className="font-bold text-gray-800 tabular-nums">{formatIndianNumber(calculations.totalQty, 0)} Pcs.</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-t-2 font-bold text-lg text-gray-900 bg-gray-50 -mx-4 px-4">
                            <span>Grand Total:</span>
                            <span className="tabular-nums">₹ {calculations.grandTotal}</span>
                        </div>
                    </div>
                </section>


                {/* Totals Summary */}
                <section className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className={`grid grid-cols-2 ${isIntraState ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 text-center text-sm`}>
                        <div>
                            <p className="text-gray-500 uppercase text-xs font-bold">Tax Rate</p>
                            <p className="text-gray-800 font-medium mt-1">18%</p>
                        </div>
                        <div>
                            <p className="text-gray-500 uppercase text-xs font-bold">Taxable Amt.</p>
                            <p className="text-gray-800 font-medium mt-1 tabular-nums">₹ {calculations.taxableAmount}</p>
                        </div>
                        {isIntraState ? (
                            <>
                                <div>
                                    <p className="text-gray-500 uppercase text-xs font-bold">CGST Amt.</p>
                                    <p className="text-gray-800 font-medium mt-1 tabular-nums">₹ {calculations.totalCgst}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 uppercase text-xs font-bold">SGST Amt.</p>
                                    <p className="text-gray-800 font-medium mt-1 tabular-nums">₹ {calculations.totalSgst}</p>
                                </div>
                            </>
                        ) : (
                            <div>
                                <p className="text-gray-500 uppercase text-xs font-bold">IGST Amt.</p>
                                <p className="text-gray-800 font-medium mt-1 tabular-nums">₹ {calculations.totalIgst}</p>
                            </div>
                        )}
                        <div className="col-span-2 md:col-span-1">
                            <p className="text-gray-500 uppercase text-xs font-bold">Total Tax</p>
                            <p className="text-gray-800 font-medium mt-1 tabular-nums">₹ {calculations.totalTax}</p>
                        </div>
                    </div>
                </section>

                {/* Amount in Words */}
                <section className="mt-6">
                    <p className="text-sm text-gray-800">
                        <span className="font-semibold">Amount in Words:</span> Rupees {numberToWords(calculations.grandTotalRounded)}
                    </p>
                </section>

                {/* Footer */}
                <footer className="mt-8 pt-6 border-t-2 border-gray-200 grid md:grid-cols-2 gap-8 text-sm">
                     <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Terms & Conditions</h4>
                        <div className="text-xs text-gray-500 whitespace-pre-wrap">{terms}</div>
                        <p className="text-xs text-gray-500 mt-2">E.& O.E.</p>
                     </div>
                     <div className="md:text-right flex flex-col justify-between items-end">
                        <div className="text-center">
                            <p className="font-bold text-gray-800">For GOODPSYCHE</p>
                            
                            <div className="mt-12 h-20 w-48 relative no-print">
                                {signature ? (
                                    <img src={signature} alt="Signature" className="h-full w-full object-contain" />
                                ) : (
                                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
                                        <ArrowUpTrayIcon className="w-6 h-6 mb-1"/>
                                        <span>Attach Signature</span>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleSignatureUpload} />
                                    </label>
                                )}
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-400 w-48">
                                <p className="font-semibold text-gray-700">Authorised Signatory</p>
                            </div>
                        </div>
                     </div>
                </footer>
            </div>

            {/* Action Buttons */}
            <div className="no-print fixed bottom-0 right-0 p-6 flex flex-col items-end space-y-4 z-40">
                 <div className="relative group flex justify-center">
                    <button 
                        onClick={handlePrint} 
                        className="bg-green-600 text-white rounded-full p-4 shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-transform hover:scale-105"
                        aria-label="Save as PDF"
                    >
                        <ArrowDownTrayIcon className="h-6 w-6" />
                    </button>
                    <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 w-auto min-w-max px-3 py-1.5 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Save as PDF
                    </span>
                </div>
                 <div className="relative group flex justify-center">
                    <button 
                        onClick={() => loadInvoice(true)}
                        className="bg-yellow-500 text-white rounded-full p-4 shadow-lg hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-transform hover:scale-105"
                        aria-label="Load Invoice"
                    >
                        <ArrowPathIcon className="h-6 w-6" />
                    </button>
                     <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 w-auto min-w-max px-3 py-1.5 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Load Invoice
                    </span>
                </div>
                 <div className="relative group flex justify-center">
                     <button 
                        onClick={handleReset}
                        className="bg-red-600 text-white rounded-full p-4 shadow-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-transform hover:scale-105"
                        aria-label="Reset Invoice"
                    >
                        <ArrowUturnLeftIcon className="h-6 w-6" />
                    </button>
                    <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 w-auto min-w-max px-3 py-1.5 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Reset Invoice
                    </span>
                </div>
            </div>
        </div>
    );
};


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
