import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// --- Icon Components (using inline SVG for simplicity) ---
const CalendarIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>);
const ClockIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
const MenuIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>);
const ChevronLeftIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>);
const ChevronRightIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>);
const SettingsIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>);
const BarChartIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></svg>);
const DownloadIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>);
const TrashIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>);
const XIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>);
const LogOutIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>);
const SunIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> );
const MoonIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> );
const DollarSignIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>);
const ClipboardIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>);
const ClipboardCheckIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 12 2 2 4-4"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>);
const StickyNoteIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>);

// --- UI Components ---
const Card = ({ children, className = '' }) => ( <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm ${className}`}>{children}</div>);
const CardHeader = ({ children, className = '' }) => ( <div className={`p-4 md:p-5 border-b border-gray-200 dark:border-gray-700 ${className}`}>{children}</div>);
const CardContent = ({ children, className = '' }) => ( <div className={`p-4 md:p-5 ${className}`}>{children}</div>);

const UtilizationGauge = ({ percentage, title }) => {
    const pct = isNaN(percentage) ? 0 : percentage;
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (pct / 100) * circumference;
    const colorClass = pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-yellow-500' : 'text-red-500';
    
    const ringColorClass = colorClass.replace('text-', 'stroke-');

    return (
        <Card>
            <CardContent className="flex flex-col items-center justify-center">
                <div className="relative w-32 h-32">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle className="text-gray-200 dark:text-gray-700" strokeWidth="10" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
                        <circle
                            className={`${ringColorClass} transition-all duration-500`}
                            strokeWidth="10"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="45"
                            cx="50"
                            cy="50"
                            transform="rotate(-90 50 50)"
                        />
                        <text x="50" y="55" className={`text-2xl font-bold ${colorClass}`} textAnchor="middle" fill="currentColor">{`${Math.round(pct)}%`}</text>
                    </svg>
                </div>
                <p className="mt-2 text-lg font-semibold text-gray-700 dark:text-gray-300">{title}</p>
            </CardContent>
        </Card>
    );
};

const getSlotClasses = (slotData, isDragging) => {
    let baseClasses = '';
    // Custom color for recurring events takes precedence
    if (slotData.customColor) {
        switch (slotData.customColor) {
            case 'purple': baseClasses = 'bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-900'; break;
            case 'pink': baseClasses = 'bg-pink-100 dark:bg-pink-900/50 border-pink-300 dark:border-pink-700 text-pink-800 dark:text-pink-200 hover:bg-pink-200 dark:hover:bg-pink-900'; break;
            case 'teal': baseClasses = 'bg-teal-100 dark:bg-teal-900/50 border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-900'; break;
            case 'gray': baseClasses = 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'; break;
            case 'red': baseClasses = 'bg-red-100 dark:bg-red-900/50 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900'; break;
            case 'orange': baseClasses = 'bg-orange-100 dark:bg-orange-900/50 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-900'; break;
            default: break;
        }
    }
    // Fallback to status-based colors
    if (!baseClasses) {
        switch (slotData.status) {
            case 'Booked': baseClasses = 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900'; break;
            case 'Completed': baseClasses = 'bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900'; break;
            case 'Cancelled': baseClasses = 'bg-orange-100 dark:bg-orange-900/50 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-900'; break;
            case 'No Show': baseClasses = 'bg-orange-100 dark:bg-orange-900/50 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-900'; break;
            default: baseClasses = 'bg-gray-100 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700';
        }
    }
    return `${baseClasses} ${isDragging ? 'opacity-50' : ''}`;
};

const Slot = ({ slotData, onEdit, onDragStart }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragStart = (e) => {
        setIsDragging(true);
        onDragStart(e, slotData);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    return (
        <div
            className={`relative slot-${slotData.id}`}
            draggable="true"
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div 
                className={`p-2 rounded-lg border text-xs cursor-grab h-full flex flex-col justify-center transition-colors ${getSlotClasses(slotData, isDragging)}`}
                onClick={() => onEdit(slotData)}
                title={slotData.notes || ''}
            >
                {slotData.isBillable === false && <DollarSignIcon className="absolute top-1 right-1 w-3 h-3 text-gray-400 dark:text-gray-500" />}
                {slotData.notes && <StickyNoteIcon className="absolute top-1 left-1 w-3 h-3 text-gray-400 dark:text-gray-500" />}
                <p className="font-semibold">{slotData.time}</p>
                <p className="truncate">{slotData.name || 'Standard'}</p>
                <p className="font-light">{slotData.status}</p>
            </div>
        </div>
    );
};

const BlockedSlot = ({ blockInfo }) => (
    <div className="p-2 rounded-lg h-full flex flex-col justify-center items-center text-center bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400">
        <p className="font-semibold text-xs">{blockInfo.type}</p>
        <p className="text-xs truncate">{blockInfo.description}</p>
    </div>
);

const colorOptions = [
    { name: 'Gray', value: 'gray', class: 'bg-gray-500' },
    { name: 'Purple', value: 'purple', class: 'bg-purple-500' },
    { name: 'Pink', value: 'pink', class: 'bg-pink-500' },
    { name: 'Teal', value: 'teal', class: 'bg-teal-500' },
    { name: 'Red', value: 'red', class: 'bg-red-500' },
    { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
];

const EditSlotModal = ({ isOpen, slot, onSave, onClose }) => {
    const [name, setName] = useState('');
    const [currentStatus, setCurrentStatus] = useState('');
    const [isBillable, setIsBillable] = useState(true);
    const [makeRecurring, setMakeRecurring] = useState(false);
    const [customColor, setCustomColor] = useState(null);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (slot) {
            setName(slot.name || '');
            setCurrentStatus(slot.status || 'Available');
            setIsBillable(slot.isBillable !== false);
            setMakeRecurring(false); // Reset on new slot
            setCustomColor(slot.customColor || null);
            setNotes(slot.notes || '');
        }
    }, [slot]);

    if (!isOpen || !slot) return null;

    const handleSave = () => {
        const recurrenceInfo = makeRecurring ? {
            dayIndex: slot.day,
            time: slot.time,
            name: name,
            status: currentStatus,
            isBillable: isBillable,
            color: customColor
        } : null;

        onSave(slot.id, { name, status: currentStatus, isBillable, notes }, recurrenceInfo);
        onClose();
    };
    
    const statuses = ['Available', 'Booked', 'Completed', 'Cancelled', 'No Show'];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Slot at {slot.time}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><XIcon className="w-6 h-6" /></button>
                </div>
                <div className="space-y-6">
                    <div>
                        <label htmlFor="slotName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Slot Name</label>
                        <input type="text" id="slotName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., F2F Patient, Meeting" className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {statuses.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setCurrentStatus(s)}
                                    className={`px-3 py-2 text-sm rounded-md transition-colors font-medium ${
                                        currentStatus === s
                                            ? 'bg-blue-600 text-white ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                     <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                        <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows="3" className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"></textarea>
                    </div>
                     <div className="space-y-2">
                        <div className="flex items-center">
                            <input id="isBillable" type="checkbox" checked={isBillable} onChange={e => setIsBillable(e.target.checked)} className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor="isBillable" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Count in Utilization</label>
                        </div>
                         <div className="flex items-center">
                            <input id="makeRecurring" type="checkbox" checked={makeRecurring} onChange={e => setMakeRecurring(e.target.checked)} className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor="makeRecurring" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Make this a recurring event</label>
                        </div>
                    </div>
                    {makeRecurring && (
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recurring Color</label>
                             <div className="flex items-center space-x-2">
                                {colorOptions.map(color => (
                                    <button key={color.value} type="button" onClick={() => setCustomColor(color.value)} className={`w-6 h-6 rounded-full ${color.class} ${customColor === color.value ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-blue-500' : ''}`}></button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} type="button" className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                    <button onClick={handleSave} type="button" className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700">Save Changes</button>
                </div>
            </div>
        </div>
    );
};


// --- Helper Functions ---
const getWeekKey = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};
const getDateFromWeekKey = (weekKey) => {
    const [year, week] = weekKey.replace('W','').split('-').map(Number);
    const d = new Date(Date.UTC(year, 0, 4 + (week - 1) * 7));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    return d;
}
const getWeekDays = (date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() === 0 ? 6 : startOfWeek.getDay() - 1));
    return Array.from({ length: 5 }).map((_, i) => {
        const day = new Date(startOfWeek);
        day.setDate(day.getDate() + i);
        return day;
    });
};

// --- Firebase Configuration ---
// IMPORTANT: Replace these placeholder values with your actual Firebase project configuration.
// You can find this in your Firebase project settings.
const firebaseConfig = {
  apiKey: "AIzaSyDrP3R8l5-0Hi6VTn4mr_r5xB1EWP78Spk",
  authDomain: "workload-credit.firebaseapp.com",
  projectId: "workload-credit",
  storageBucket: "workload-credit.firebasestorage.app",
  messagingSenderId: "559035838771",
  appId: "1:559035838771:web:8cccf50011abe2cfe40e46"
};

const appId = firebaseConfig.appId;


// --- Main App Component ---
export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        try {
            if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
                setLoading(false);
                return;
            }
            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);
            setAuth(authInstance);
            setDb(dbInstance);

            const unsubscribe = onAuthStateChanged(authInstance, (user) => {
                setUser(user);
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (e) {
            console.error("Error initializing Firebase", e);
            setLoading(false);
        }
    }, []);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    if (loading) {
        return <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">Loading...</div>;
    }
    
    if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
        return (
            <div className="flex justify-center items-center min-h-screen bg-red-50 text-red-900 p-8">
                <div className="text-center max-w-2xl bg-white p-8 rounded-lg shadow-lg border-2 border-red-300">
                    <h2 className="text-3xl font-bold mb-4">Action Required: Add Firebase Credentials</h2>
                    <p className="mb-6 text-lg">
                        This application cannot connect to the database without your unique project keys. Please follow these steps:
                    </p>
                    <ol className="text-left space-y-3 text-base">
                        <li>
                            <strong>1. Go to the Firebase Console:</strong> 
                            <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium"> console.firebase.google.com</a>
                        </li>
                        <li>
                            <strong>2. Get your credentials:</strong> In your project, go to <strong>Project Settings</strong> (⚙️) &gt; <strong>General</strong>. In the "Your apps" card, find your Web App and click on <strong>Config</strong>.
                        </li>
                        <li>
                            <strong>3. Copy the `firebaseConfig` object.</strong> It will look like `{"{...}"}`.
                        </li>
                        <li>
                            <strong>4. Open `src/App.jsx` in VS Code:</strong> Find the `firebaseConfig` object around line 150.
                        </li>
                        <li>
                            <strong>5. Paste your credentials:</strong> Replace the placeholder values with the ones you copied from Firebase.
                        </li>
                    </ol>
                    <p className="mt-6 text-gray-600">
                        Once you save the file, the application will automatically reload.
                    </p>
                </div>
            </div>
        );
    }

    return user ? <Dashboard auth={auth} db={db} user={user} theme={theme} toggleTheme={toggleTheme} /> : <LoginPage auth={auth} />;
}

function LoginPage({ auth }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);

    const handleAuthAction = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center items-center">
            <div className="max-w-md w-full mx-auto">
                <h2 className="text-3xl font-bold text-center text-blue-600 mb-6">ClinicFlow</h2>
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md">
                    <h3 className="text-xl font-semibold mb-6 text-center text-gray-700 dark:text-gray-200">{isSignUp ? 'Create an Account' : 'Sign In'}</h3>
                    <form onSubmit={handleAuthAction} className="space-y-6">
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" required className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors">{isSignUp ? 'Sign Up' : 'Sign In'}</button>
                    </form>
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        <button onClick={() => setIsSignUp(!isSignUp)} className="text-blue-600 hover:underline ml-1">
                            {isSignUp ? 'Sign In' : 'Sign Up'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}


function Dashboard({ auth, db, user, theme, toggleTheme }) {
    const [page, setPage] = useState('schedule');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [scheduleData, setScheduleData] = useState({});
    const [currentSlots, setCurrentSlots] = useState([]);
    const [settings, setSettings] = useState({ startTime: '09:00', endTime: '17:00', timeSlots: [], timeBlocks: [], recurringEvents: [] });
    const [copiedWeek, setCopiedWeek] = useState(null);

    // Load Settings and Schedule Data from the user-specific path
    useEffect(() => {
        if (!db || !user) return;
        const settingsDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/settings/main`);
        const unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
            const defaultSettings = {
                startTime: '09:00', endTime: '17:00',
                timeSlots: [
                    { id: '1', time: '09:00', name: 'Standard', isBillable: true }, { id: '2', time: '10:00', name: 'Standard', isBillable: true },
                    { id: '3', time: '11:00', name: 'Standard', isBillable: true }, { id: '4', time: '12:00', name: 'Lunch', isBillable: false },
                    { id: '5', time: '13:00', name: 'Standard', isBillable: true }, { id: '6', time: '14:00', name: 'Standard', isBillable: true },
                    { id: '7', time: '15:00', name: 'Standard', isBillable: true }, { id: '8', time: '16:00', name: 'Standard', isBillable: true },
                ],
                timeBlocks: [], recurringEvents: []
            };
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSettings({ ...defaultSettings, ...data });
            } else {
                setDoc(settingsDocRef, defaultSettings);
                setSettings(defaultSettings);
            }
        });

        const scheduleColRef = collection(db, `artifacts/${appId}/users/${user.uid}/schedule`);
        const unsubscribeSchedule = onSnapshot(scheduleColRef, (querySnapshot) => {
            const allData = {};
            querySnapshot.forEach((doc) => { allData[doc.id] = doc.data().slots; });
            setScheduleData(allData);
        });
        return () => { unsubscribeSettings(); unsubscribeSchedule(); };
    }, [db, user]);

    // Generate/Display Slots for the Current Week
    useEffect(() => {
        const weekKey = getWeekKey(currentDate);
        if (scheduleData[weekKey]) {
            setCurrentSlots(scheduleData[weekKey]);
        } else {
            const { timeSlots, recurringEvents } = settings;
             if (!timeSlots || timeSlots.length === 0) { setCurrentSlots([]); return; }
            const newSlots = [];
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
            let idCounter = 0;
            timeSlots.forEach(slotSetting => {
                 days.forEach((day, dayIndex) => {
                    newSlots.push({ id: `${weekKey}-${idCounter++}`, day: dayIndex, time: slotSetting.time, name: slotSetting.name, status: 'Available', isBillable: slotSetting.isBillable !== false });
                });
            });
            if (recurringEvents) {
                recurringEvents.forEach(event => {
                    if (event.dayIndex === 5) { // Daily event
                        for (let day = 0; day < 5; day++) {
                            const slotIndex = newSlots.findIndex(s => s.day === day && s.time === event.time);
                            if (slotIndex !== -1) {
                                newSlots[slotIndex].name = event.name;
                                newSlots[slotIndex].status = event.status;
                                newSlots[slotIndex].isBillable = event.isBillable;
                                newSlots[slotIndex].customColor = event.color;
                            }
                        }
                    } else { // Specific day event
                        const slotIndex = newSlots.findIndex(s => s.day === event.dayIndex && s.time === event.time);
                        if (slotIndex !== -1) {
                            newSlots[slotIndex].name = event.name;
                            newSlots[slotIndex].status = event.status;
                            newSlots[slotIndex].isBillable = event.isBillable;
                            newSlots[slotIndex].customColor = event.color;
                        }
                    }
                });
            }
            setCurrentSlots(newSlots);
        }
    }, [currentDate, scheduleData, settings]);
    
    const handleSlotSave = async (id, newValues, recurrenceInfo) => {
        if (!db || !user) return;
        
        const finalValues = { ...newValues };
        if (recurrenceInfo) {
            finalValues.customColor = recurrenceInfo.color;
        } else {
            const oldSlot = currentSlots.find(s => s.id === id);
            if (oldSlot.customColor) {
                finalValues.customColor = null;
            }
        }

        const weekKey = getWeekKey(currentDate);
        const updatedSlots = currentSlots.map(slot => slot.id === id ? { ...slot, ...finalValues } : slot);
        const scheduleDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/schedule`, weekKey);
        await setDoc(scheduleDocRef, { slots: updatedSlots });

        if (recurrenceInfo) {
            const settingsDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/settings/main`);
            const eventToAdd = { ...recurrenceInfo, id: crypto.randomUUID() };
            
            const existingEvents = settings.recurringEvents || [];
            const filteredEvents = existingEvents.filter(e => !(e.dayIndex === eventToAdd.dayIndex && e.time === eventToAdd.time));

            const updatedEvents = [...filteredEvents, eventToAdd];
            await setDoc(settingsDocRef, { ...settings, recurringEvents: updatedEvents }, { merge: true });
        }
    };
    
    const handlePasteWeek = async () => {
        if (!copiedWeek || !db || !user) return;
        const weekKey = getWeekKey(currentDate);
        
        // Update IDs of copied slots to match the new week
        const newSlotsForWeek = copiedWeek.map((slot, index) => ({
            ...slot,
            id: `${weekKey}-${index}`
        }));

        const scheduleDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/schedule`, weekKey);
        await setDoc(scheduleDocRef, { slots: newSlotsForWeek });
    };

    const handleSettingsSave = async (newSettings) => {
        if (!db || !user) return;
        const settingsDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/settings/main`);
        await setDoc(settingsDocRef, newSettings);
        setPage('schedule');
    };
    
    const NavLink = ({ children, active, onClick }) => (
        <button onClick={onClick} className={`flex items-center w-full p-2 rounded-lg transition-colors ${active ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {children}
        </button>
    );

    const renderPage = () => {
        switch (page) {
            case 'schedule': return <ScheduleView currentDate={currentDate} setCurrentDate={setCurrentDate} currentSlots={currentSlots} onSaveSlot={handleSlotSave} scheduleData={scheduleData} settings={settings} setCopiedWeek={setCopiedWeek} onPasteWeek={handlePasteWeek} copiedWeek={copiedWeek} />;
            case 'reports': return <ReportsView scheduleData={scheduleData} />;
            case 'settings': return <SettingsView currentSettings={settings} onSave={handleSettingsSave} />;
            default: return <ScheduleView />;
        }
    };
    
    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen font-sans">
            <aside className={`fixed top-0 left-0 z-40 w-64 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform md:translate-x-0`}>
                <div className="p-4 border-b dark:border-gray-700"><h2 className="text-2xl font-bold text-blue-600">ClinicFlow</h2></div>
                <nav className="p-4 space-y-2 flex flex-col h-full">
                    <div className="flex-grow">
                        <NavLink active={page === 'schedule'} onClick={() => setPage('schedule')}><CalendarIcon className="w-5 h-5 mr-3"/> Schedule</NavLink>
                        <NavLink active={page === 'reports'} onClick={() => setPage('reports')}><BarChartIcon className="w-5 h-5 mr-3"/> Reports</NavLink>
                        <NavLink active={page === 'settings'} onClick={() => setPage('settings')}><SettingsIcon className="w-5 h-5 mr-3"/> Settings</NavLink>
                    </div>
                    <div className="mt-auto">
                        <NavLink onClick={() => signOut(auth)}><LogOutIcon className="w-5 h-5 mr-3"/> Sign Out</NavLink>
                    </div>
                </nav>
            </aside>
            <div className="md:ml-64 transition-all">
                <header className="sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 z-30">
                    <div className="px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden text-gray-600 dark:text-gray-300"><MenuIcon className="h-6 w-6" /></button>
                            <div className="flex items-center flex-1"><h1 className="text-xl font-semibold ml-4 md:ml-0">{page.charAt(0).toUpperCase() + page.slice(1)}</h1></div>
                            <div className="flex items-center space-x-4">
                                <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                                    {theme === 'light' ? <MoonIcon className="w-5 h-5"/> : <SunIcon className="w-5 h-5"/>}
                                </button>
                                <p className="text-sm hidden sm:block">{user.email}</p>
                                <div className="h-9 w-9 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-semibold">
                                    {user.email ? user.email.charAt(0).toUpperCase() : '?'}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
                <main className="p-4 sm:p-6 lg:p-8">{renderPage()}</main>
            </div>
        </div>
    );
}

// --- Page Components ---

function ScheduleView({ currentDate, setCurrentDate, currentSlots, onSaveSlot, scheduleData, settings, setCopiedWeek, onPasteWeek, copiedWeek }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSlot, setEditingSlot] = useState(null);
    const [draggedSlot, setDraggedSlot] = useState(null);

    const handleEditSlot = (slot) => {
        setEditingSlot(slot);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSlot(null);
    };

    const handleDragStart = (e, slot) => {
        setDraggedSlot(slot);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    const handleDrop = (e, targetSlot) => {
        e.preventDefault();
        if (!draggedSlot || draggedSlot.id === targetSlot.id) return;

        // Create a copy of the dragged slot's data for the new location
        const newSlotData = { ...draggedSlot, id: targetSlot.id, day: targetSlot.day, time: targetSlot.time };
        // Create a default "Available" slot for the old location
        const oldSlotData = { ...targetSlot, id: draggedSlot.id, day: draggedSlot.day, time: draggedSlot.time, name: 'Standard', status: 'Available', isBillable: true, customColor: null, notes: '' };
        
        // Update both slots in one go
        onSaveSlot(newSlotData.id, newSlotData);
        onSaveSlot(oldSlotData.id, oldSlotData);

        setDraggedSlot(null);
    };

    const calculateUtilization = useCallback((slotsToCalculate) => {
        const billableSlots = slotsToCalculate.filter(s => s.isBillable !== false);
        const workingSlots = billableSlots.filter(s => s.status !== 'Available');
        if (workingSlots.length === 0) return 0;
        const utilizedCount = workingSlots.filter(s => s.status === 'Completed' || s.status === 'No Show').length;
        return (utilizedCount / workingSlots.length) * 100;
    }, []);

    const getSlotBlockInfo = useCallback((date, time, timeBlocks) => {
        const checkTime = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
        for (const block of timeBlocks) {
            if (!block.startDate || !block.endDate) continue;
            const startParts = block.startDate.split('-').map(p => parseInt(p, 10));
            const endParts = block.endDate.split('-').map(p => parseInt(p, 10));
            const startTime = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
            const endTime = Date.UTC(endParts[0], endParts[1] - 1, endParts[2]);
            if (checkTime >= startTime && checkTime <= endTime) {
                if (block.allDay) return block;
                const slotTime = parseInt(time.replace(':', ''), 10);
                const blockStartTime = parseInt(block.startTime.replace(':', ''), 10);
                const blockEndTime = parseInt(block.endTime.replace(':', ''), 10);
                if (slotTime >= blockStartTime && slotTime < blockEndTime) return block;
            }
        }
        return null;
    }, []);

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const isCurrentWeek = getWeekKey(today) === getWeekKey(currentDate);
    const todayIndex = today.getDay() - 1;
    const dailySlotsForToday = isCurrentWeek ? currentSlots.filter(s => s.day === todayIndex) : [];
    const dailyUtilization = calculateUtilization(dailySlotsForToday);

    const weeklyUtilization = calculateUtilization(currentSlots);

    const monthlySlots = Object.keys(scheduleData).filter(key => getDateFromWeekKey(key).getMonth() === currentMonth && getDateFromWeekKey(key).getFullYear() === currentYear).flatMap(key => scheduleData[key]);
    const monthlyUtilization = calculateUtilization(monthlySlots);

    const ytdSlots = Object.keys(scheduleData).filter(key => getDateFromWeekKey(key).getFullYear() === currentYear).flatMap(key => scheduleData[key]);
    const ytdUtilization = calculateUtilization(ytdSlots);

    const changeWeek = (direction) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 7 * direction);
        setCurrentDate(newDate);
    };

    const weekDays = getWeekDays(currentDate);
    const weekFormat = `${weekDays[0].toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - ${weekDays[4].toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}`;
    const times = settings.timeSlots ? [...settings.timeSlots].sort((a, b) => a.time.localeCompare(b.time)) : [];
    
    const [timeIndicatorPosition, setTimeIndicatorPosition] = useState(null);
    useEffect(() => {
        const updateIndicator = () => {
            if(!isCurrentWeek) { setTimeIndicatorPosition(null); return; }
            const now = new Date();
            const start = new Date(`1970-01-01T${settings.startTime}:00`);
            const end = new Date(`1970-01-01T${settings.endTime}:00`);
            const totalMinutes = (end - start) / 60000;
            const elapsedMinutes = (now - start) / 60000;
            const position = (elapsedMinutes / totalMinutes) * 100;
            if (position >= 0 && position <= 100) { setTimeIndicatorPosition(position); } else { setTimeIndicatorPosition(null); }
        };
        updateIndicator();
        const interval = setInterval(updateIndicator, 60000);
        return () => clearInterval(interval);
    }, [currentDate, settings, isCurrentWeek]);

    return (
        <>
            <EditSlotModal isOpen={isModalOpen} slot={editingSlot} onSave={onSaveSlot} onClose={handleCloseModal} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <UtilizationGauge percentage={dailyUtilization} title="Daily" />
                <UtilizationGauge percentage={weeklyUtilization} title="Weekly" />
                <UtilizationGauge percentage={monthlyUtilization} title="Monthly" />
                <UtilizationGauge percentage={ytdUtilization} title="YTD" />
            </div>
            <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">Weekly View</h3>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => setCopiedWeek(currentSlots)} className="text-sm font-medium px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600">Copy Week</button>
                        {copiedWeek && <button onClick={onPasteWeek} className="text-sm font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700">Paste Week</button>}
                        <button onClick={() => setCurrentDate(new Date())} className="text-sm font-medium px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600">Today</button>
                        <button onClick={() => changeWeek(-1)} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeftIcon className="w-5 h-5" /></button>
                        <span className="text-sm font-medium text-center w-48">{weekFormat}</span>
                        <button onClick={() => changeWeek(1)} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRightIcon className="w-5 h-5" /></button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-6 gap-2">
                        <div className="flex items-center justify-center font-semibold text-sm text-gray-500 dark:text-gray-400"><ClockIcon className="w-4 h-4 mr-1"/> Time</div>
                        {weekDays.map((day, dayIndex) => (
                            <div key={day.toISOString()} className="text-center font-semibold text-sm text-gray-500 dark:text-gray-400 relative">
                                {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                <span className="block text-xs font-normal">{day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                {dayIndex === todayIndex && timeIndicatorPosition !== null && (
                                    <div className="absolute left-0 right-0 h-0.5 bg-red-500" style={{ top: `${timeIndicatorPosition}%` }}>
                                        <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full"></div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {times.map(slotSetting => (
                            <React.Fragment key={slotSetting.id}>
                                <div className="flex flex-col items-center justify-center font-semibold text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg h-16 p-1 text-center">
                                    <span>{slotSetting.time}</span>
                                    <span className="text-xs font-normal truncate w-full">{slotSetting.name}</span>
                                </div>
                                {weekDays.map((day, dayIndex) => {
                                    const blockInfo = getSlotBlockInfo(day, slotSetting.time, settings.timeBlocks || []);
                                    const slot = currentSlots.find(s => s.day === dayIndex && s.time === slotSetting.time);
                                    return (
                                        <div key={`${dayIndex}-${slotSetting.time}`} onDragOver={handleDragOver} onDrop={(e) => slot && handleDrop(e, slot)}>
                                            {blockInfo ? <BlockedSlot blockInfo={blockInfo} /> : (slot ? <Slot slotData={slot} onEdit={handleEditSlot} onDragStart={handleDragStart} /> : <div className="p-2 h-full"></div>)}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </>
    );
}

function ReportsView({ scheduleData }) {
    const allSlots = Object.values(scheduleData).flat();
    const billableSlots = allSlots.filter(s => s.isBillable !== false);
    const workingSlots = billableSlots.filter(s => s.status !== 'Available');
    const totalWorkingSlots = workingSlots.length;
    
    const statusCounts = workingSlots.reduce((acc, slot) => { acc[slot.status] = (acc[slot.status] || 0) + 1; return acc; }, {});
    const pieData = [
        { label: 'Completed', value: statusCounts['Completed'] || 0, color: '#22c55e' },
        { label: 'No Show', value: statusCounts['No Show'] || 0, color: '#f97316' }, // Orange
        { label: 'Cancelled', value: statusCounts['Cancelled'] || 0, color: '#f97316' }, // Orange
        { label: 'Booked', value: statusCounts['Booked'] || 0, color: '#3b82f6' },
    ];
    const weeklyTrends = Object.keys(scheduleData).sort().map(weekKey => {
        const slots = scheduleData[weekKey];
        const billable = slots.filter(s => s.isBillable !== false);
        const working = billable.filter(s => s.status !== 'Available');
        const utilized = working.filter(s => s.status === 'Completed' || s.status === 'No Show').length;
        const utilization = working.length > 0 ? (utilized / working.length) * 100 : 0;
        return { week: weekKey.replace(/\d{4}-W/, ''), utilization: Math.round(utilization) };
    });
    const exportToCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,Date,Day,Time,Name,Status,Billable\r\n";
        Object.keys(scheduleData).sort().forEach(weekKey => {
            const weekDate = getDateFromWeekKey(weekKey);
            const weekDays = getWeekDays(weekDate);
            scheduleData[weekKey].forEach(slot => {
                const date = weekDays[slot.day].toLocaleDateString();
                const dayOfWeek = weekDays[slot.day].toLocaleDateString('en-US', { weekday: 'long' });
                const slotName = slot.name || 'Standard';
                const isBillable = slot.isBillable !== false;
                csvContent += `${date},${dayOfWeek},${slot.time},"${slotName.replace(/"/g, '""')}",${slot.status},${isBillable}\r\n`;
            });
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "clinic_schedule_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1">
                    <CardHeader><h3 className="text-lg font-semibold">Status Breakdown</h3></CardHeader>
                    <CardContent>
                        <svg viewBox="0 0 200 200">{(() => { const total = pieData.reduce((sum, item) => sum + item.value, 0); if(total === 0) return <text x="100" y="100" textAnchor="middle" className="fill-current text-gray-500 dark:text-gray-400">No Data</text>; let cumulative = 0; return pieData.map(item => { const percentage = item.value / total; const startAngle = (cumulative / total) * 360; const endAngle = ((cumulative + item.value) / total) * 360; cumulative += item.value; const largeArc = percentage > 0.5 ? 1 : 0; const x1 = 100 + 90 * Math.cos(Math.PI * startAngle / 180); const y1 = 100 + 90 * Math.sin(Math.PI * startAngle / 180); const x2 = 100 + 90 * Math.cos(Math.PI * endAngle / 180); const y2 = 100 + 90 * Math.sin(Math.PI * endAngle / 180); return <path key={item.label} d={`M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={item.color} />; }); })()}</svg>
                        <div className="mt-4 space-y-2">{pieData.map(item => {
                            const percentage = totalWorkingSlots > 0 ? ((item.value / totalWorkingSlots) * 100).toFixed(0) : 0;
                            return (
                                <div key={item.label} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center">
                                        <span className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: item.color}}></span>
                                        {item.label}
                                    </div>
                                    <span>{item.value} ({percentage}%)</span>
                                </div>
                            )
                        })}</div>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                    <CardHeader><h3 className="text-lg font-semibold">Weekly Utilization Trend</h3></CardHeader>
                    <CardContent><svg viewBox="0 0 500 200">{(() => { if(weeklyTrends.length < 2) return <text x="250" y="100" textAnchor="middle" className="fill-current text-gray-500 dark:text-gray-400">Not enough data for trend</text>; const maxUtil = 100; const points = weeklyTrends.map((d, i) => { const x = (i / (weeklyTrends.length - 1)) * 480 + 10; const y = 190 - (d.utilization / maxUtil) * 180; return `${x},${y}`; }).join(' '); return ( <> <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={points} /> {weeklyTrends.map((d, i) => { const x = (i / (weeklyTrends.length - 1)) * 480 + 10; const y = 190 - (d.utilization / maxUtil) * 180; return <circle key={i} cx={x} cy={y} r="3" fill="#3b82f6" />; })} </> ); })()}</svg></CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader className="flex items-center justify-between"><h3 className="text-lg font-semibold">Data Export</h3><button onClick={exportToCSV} className="flex items-center text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"><DownloadIcon className="w-4 h-4 mr-2" />Export All Data to CSV</button></CardHeader>
                <CardContent><p className="text-sm text-gray-600 dark:text-gray-400">Download a complete log of all your appointments. This file can be opened in Excel, Google Sheets, or other spreadsheet software for detailed analysis.</p></CardContent>
            </Card>
        </div>
    );
}

function SettingsView({ currentSettings, onSave }) {
    const [settings, setSettingsState] = useState(currentSettings);
    const [newBlock, setNewBlock] = useState({ startDate: '', endDate: '', type: 'Vacation', description: '', allDay: true, startTime: '09:00', endTime: '17:00' });
    const [blockError, setBlockError] = useState('');
    const [newRecurringEvent, setNewRecurringEvent] = useState({ dayIndex: 5, time: '09:00', name: '', isBillable: false, color: 'gray' });

    useEffect(() => {
        const settingsWithIds = { ...currentSettings };
        if (currentSettings.timeSlots && currentSettings.timeSlots.some(slot => !slot.id)) {
            settingsWithIds.timeSlots = currentSettings.timeSlots.map(slot => ({ ...slot, id: slot.id || crypto.randomUUID() }));
        }
        setSettingsState(settingsWithIds);
    }, [currentSettings]);

    const handleSave = (e) => {
        e.preventDefault();
        onSave(settings);
    };
    
    const handleAddBlock = () => {
        if (!newBlock.startDate || !newBlock.endDate) { setBlockError("Please select a start and end date for the block."); return; }
        if (newBlock.endDate < newBlock.startDate) { setBlockError("The block's end date cannot be before the start date."); return; }
        setBlockError('');
        const blockToAdd = { ...newBlock, id: crypto.randomUUID() };
        const updatedBlocks = [...(settings.timeBlocks || []), blockToAdd];
        setSettingsState({ ...settings, timeBlocks: updatedBlocks });
        setNewBlock({ startDate: '', endDate: '', type: 'Vacation', description: '', allDay: true, startTime: '09:00', endTime: '17:00' });
    };
    
    const handleDeleteBlock = (id) => {
        const updatedBlocks = settings.timeBlocks.filter(b => b.id !== id);
        setSettingsState({ ...settings, timeBlocks: updatedBlocks });
    };

    const handleSlotChange = (id, field, value) => {
        const updatedSlots = settings.timeSlots.map(slot => 
            slot.id === id ? { ...slot, [field]: value } : slot
        );
        setSettingsState({ ...settings, timeSlots: updatedSlots });
    };

    const handleAddSlot = () => {
        const newSlot = { id: crypto.randomUUID(), time: '17:00', name: 'New Slot', isBillable: true };
        const updatedSlots = [...(settings.timeSlots || []), newSlot];
        setSettingsState({ ...settings, timeSlots: updatedSlots });
    };

    const handleDeleteSlot = (id) => {
        const updatedSlots = settings.timeSlots.filter(slot => slot.id !== id);
        setSettingsState({ ...settings, timeSlots: updatedSlots });
    };
    
    const handleAddRecurringEvent = () => {
        const eventToAdd = { ...newRecurringEvent, id: crypto.randomUUID(), status: 'Booked' };
        const updatedEvents = [...(settings.recurringEvents || []), eventToAdd];
        setSettingsState({ ...settings, recurringEvents: updatedEvents });
        setNewRecurringEvent({ dayIndex: 5, time: '09:00', name: '', isBillable: false, color: 'gray' });
    };

    const handleDeleteRecurringEvent = (id) => {
        const updatedEvents = settings.recurringEvents.filter(e => e.id !== id);
        setSettingsState({ ...settings, recurringEvents: updatedEvents });
    };
    
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Daily'];

    return (
        <form onSubmit={handleSave} className="space-y-8">
            <Card>
                <CardHeader><h3 className="text-lg font-semibold">Working Hours</h3></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label htmlFor="startTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Working Hours Start</label><input type="time" id="startTime" value={settings.startTime} onChange={e => setSettingsState({...settings, startTime: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                    <div><label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Working Hours End</label><input type="time" id="endTime" value={settings.endTime} onChange={e => setSettingsState({...settings, endTime: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><h3 className="text-lg font-semibold">Appointment Time Slot Templates</h3></CardHeader>
                <CardContent className="space-y-3">
                    {settings.timeSlots && settings.timeSlots.sort((a,b) => a.time.localeCompare(b.time)).map((slot) => (
                        <div key={slot.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <input type="time" value={slot.time} onChange={e => handleSlotChange(slot.id, 'time', e.target.value)} className="block w-32 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm sm:text-sm" />
                            <input type="text" placeholder="Slot Name (e.g., Follow-up)" value={slot.name} onChange={e => handleSlotChange(slot.id, 'name', e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm sm:text-sm" />
                            <div className="flex items-center pl-4">
                                <input id={`billable-${slot.id}`} type="checkbox" checked={slot.isBillable !== false} onChange={e => handleSlotChange(slot.id, 'isBillable', e.target.checked)} className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" />
                                <label htmlFor={`billable-${slot.id}`} className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Billable</label>
                            </div>
                            <button type="button" onClick={() => handleDeleteSlot(slot.id)} className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    ))}
                    <button type="button" onClick={handleAddSlot} className="w-full mt-2 px-4 py-2 text-sm font-medium rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">Add New Slot Template</button>
                </CardContent>
            </Card>

             <Card>
                <CardHeader><h3 className="text-lg font-semibold">Recurring Events</h3></CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {settings.recurringEvents && settings.recurringEvents.map(event => (
                            <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div className="flex items-center">
                                    <span className={`w-4 h-4 rounded-full mr-3 ${colorOptions.find(c => c.value === event.color)?.class || 'bg-gray-500'}`}></span>
                                    <div>
                                        <p className="font-semibold text-sm">{dayLabels[event.dayIndex]} at {event.time} - {event.name}</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">{event.isBillable ? "Counts towards utilization" : "Does not count towards utilization"}</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => handleDeleteRecurringEvent(event.id)} className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        ))}
                    </div>
                </CardContent>
                 <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-4">
                     <h4 className="text-md font-semibold">Add New Recurring Event</h4>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select value={newRecurringEvent.dayIndex} onChange={e => setNewRecurringEvent({...newRecurringEvent, dayIndex: parseInt(e.target.value)})} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm sm:text-sm">
                            <option value="5">Daily</option>
                            <option value="0">Monday</option>
                            <option value="1">Tuesday</option>
                            <option value="2">Wednesday</option>
                            <option value="3">Thursday</option>
                            <option value="4">Friday</option>
                        </select>
                        <input type="time" value={newRecurringEvent.time} onChange={e => setNewRecurringEvent({...newRecurringEvent, time: e.target.value})} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm sm:text-sm" />
                        <input type="text" placeholder="Event Name (e.g., Meeting)" value={newRecurringEvent.name} onChange={e => setNewRecurringEvent({...newRecurringEvent, name: e.target.value})} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm sm:text-sm" />
                     </div>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input id="recurringBillable" type="checkbox" checked={newRecurringEvent.isBillable} onChange={e => setNewRecurringEvent({...newRecurringEvent, isBillable: e.target.checked})} className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor="recurringBillable" className="ml-2 block text-sm">Count in Utilization</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm">Color:</span>
                            {colorOptions.map(color => (
                                <button key={color.value} type="button" onClick={() => setNewRecurringEvent({...newRecurringEvent, color: color.value})} className={`w-6 h-6 rounded-full ${color.class} ${newRecurringEvent.color === color.value ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-blue-500' : ''}`}></button>
                            ))}
                        </div>
                     </div>
                     <button type="button" onClick={handleAddRecurringEvent} className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">Add Recurring Event</button>
                 </div>
            </Card>
            
            <Card>
                <CardHeader><h3 className="text-lg font-semibold">Manage Time Blocks (Vacations, Clinics)</h3></CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {settings.timeBlocks && settings.timeBlocks.map(block => (
                            <div key={block.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div>
                                    <p className="font-semibold text-sm">{block.type}: <span className="font-normal">{block.description}</span></p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">{block.startDate} to {block.endDate} {block.allDay ? '(All Day)' : `from ${block.startTime} to ${block.endTime}`}</p>
                                </div>
                                <button type="button" onClick={() => handleDeleteBlock(block.id)} className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        ))}
                        {(!settings.timeBlocks || settings.timeBlocks.length === 0) && <p className="text-sm text-gray-500 dark:text-gray-400">No time blocks scheduled.</p>}
                    </div>
                </CardContent>
                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-4">
                    <h4 className="text-md font-semibold">Add New Block</h4>
                    {blockError && <p className="text-sm text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-2 rounded-md">{blockError}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="Description (e.g., 'Annual Leave')" value={newBlock.description} onChange={e => setNewBlock({...newBlock, description: e.target.value})} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm sm:text-sm" />
                        <select value={newBlock.type} onChange={e => setNewBlock({...newBlock, type: e.target.value})} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm sm:text-sm">
                            <option>Vacation</option><option>Blocked Clinic</option><option>Personal</option>
                        </select>
                        <div><label className="text-xs text-gray-500 dark:text-gray-400">Start Date</label><input type="date" value={newBlock.startDate} onChange={e => setNewBlock({...newBlock, startDate: e.target.value})} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm sm:text-sm" /></div>
                        <div><label className="text-xs text-gray-500 dark:text-gray-400">End Date</label><input type="date" value={newBlock.endDate} onChange={e => setNewBlock({...newBlock, endDate: e.target.value})} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm sm:text-sm" /></div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center"><input id="allDay" type="checkbox" checked={newBlock.allDay} onChange={e => setNewBlock({...newBlock, allDay: e.target.checked})} className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" /><label htmlFor="allDay" className="ml-2 block text-sm">All Day</label></div>
                        {!newBlock.allDay && (
                            <div className="flex items-center gap-2">
                                <input type="time" value={newBlock.startTime} onChange={e => setNewBlock({...newBlock, startTime: e.target.value})} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm sm:text-sm" />
                                <span>to</span>
                                <input type="time" value={newBlock.endTime} onChange={e => setNewBlock({...newBlock, endTime: e.target.value})} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm sm:text-sm" />
                            </div>
                        )}
                    </div>
                     <button type="button" onClick={handleAddBlock} className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">Add Time Block</button>
                </div>
            </Card>

            <div className="mt-8 text-right">
                <button type="submit" className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm">Save All Settings</button>
            </div>
        </form>
    );
}
