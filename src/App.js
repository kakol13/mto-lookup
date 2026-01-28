<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rep Search App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    </style>
</head>
<body class="bg-slate-50">
    <div id="root"></div>

    <script type="text/babel">
        const { useState, useMemo, useEffect } = React;

        const XLSX_SCRIPT_URL = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
        const FIREBASE_APP_URL = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js';
        const FIREBASE_AUTH_URL = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js';
        const FIREBASE_FIRESTORE_URL = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js';

        const Icons = {
            Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
            Lock: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
            X: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
            User: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
            Copy: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
            Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
            FileUp: () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg>,
            Bug: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.31 0-6-2.69-6-6v-1h12v1c0 3.31-2.69 6-6 6Z"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
        };

        function App() {
            const [user, setUser] = useState(null);
            const [data, setData] = useState([]);
            const [lastUpdated, setLastUpdated] = useState(null);
            const [searchTerm, setSearchTerm] = useState('');
            const [isLoading, setIsLoading] = useState(true);
            const [isUploading, setIsUploading] = useState(false);
            const [uploadStatus, setUploadStatus] = useState(null);
            const [copiedId, setCopiedId] = useState(null);
            const [isAdmin, setIsAdmin] = useState(false);
            const [showPinModal, setShowPinModal] = useState(false);
            const [pinInput, setPinInput] = useState('');
            const [db, setDb] = useState(null);
            const [debugRows, setDebugRows] = useState(null);
            const [showDebug, setShowDebug] = useState(false);

            const CORRECT_PIN = "5256";
            const appId = 'mto-lookup-app';
            const M = { name: 1, acct: 11, due: 4, amt: 5, ovr: 7, bps: 3, upl: 14 };

            const loadScript = (url) => {
                return new Promise((resolve) => {
                    if (document.querySelector(`script[src="${url}"]`)) return resolve();
                    const script = document.createElement('script');
                    script.src = url; script.async = true; script.onload = resolve;
                    document.head.appendChild(script);
                });
            };

            const formatAsMMDDYYYY = (val) => {
                if (!val || val === "") return "N/A";
                const strVal = String(val).trim();
                if (/^\d{8}$/.test(strVal)) {
                    const y = strVal.substring(0, 4);
                    const m = strVal.substring(4, 6);
                    const d = strVal.substring(6, 8);
                    return `${m}/${d}/${y}`;
                }
                if (val instanceof Date) {
                    const month = String(val.getMonth() + 1).padStart(2, '0');
                    const day = String(val.getDate()).padStart(2, '0');
                    return `${month}/${day}/${val.getFullYear()}`;
                }
                if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(strVal)) return strVal;
                return strVal;
            };

            useEffect(() => {
                const init = async () => {
                    await loadScript(FIREBASE_APP_URL);
                    await Promise.all([loadScript(XLSX_SCRIPT_URL), loadScript(FIREBASE_AUTH_URL), loadScript(FIREBASE_FIRESTORE_URL)]);
                    const config = {
                        apiKey: "AIzaSyDVZglQZN-UgovrJXk8inucP0Fr13BifUM",
                        authDomain: "mto-search.firebaseapp.com",
                        projectId: "mto-search",
                        storageBucket: "mto-search.firebasestorage.app",
                        messagingSenderId: "809363447934",
                        appId: "1:809363447934:web:1b3aa6ced07097d8c6f82f"
                    };
                    if (!window.firebase.apps.length) window.firebase.initializeApp(config);
                    const fDb = window.firebase.firestore();
                    const fAuth = window.firebase.auth();
                    setDb(fDb);
                    fAuth.onAuthStateChanged(u => { setUser(u); setIsLoading(false); });
                    try { await fAuth.signInAnonymously(); } catch (e) { setIsLoading(false); }
                };
                init();
            }, []);

            useEffect(() => {
                if (!db) return;
                const unsubscribe = db.doc(`artifacts/${appId}/public/data/reports/latest`).onSnapshot(doc => {
                    if (doc.exists) {
                        const r = doc.data();
                        setData(r.items || []);
                        setLastUpdated(r.updatedAt?.toDate().toLocaleString());
                    }
                }, (error) => {
                    console.error("Firestore error:", error);
                });
                return () => unsubscribe();
            }, [db, user]);

            const handleFileUpload = (e) => {
                const file = e.target.files[0];
                if (!file || !window.XLSX || !db) return;
                setIsUploading(true);
                setUploadStatus(null);
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    try {
                        const dataArr = new Uint8Array(evt.target.result);
                        const wb = window.XLSX.read(dataArr, { type: 'array', cellDates: false });
                        const sheet = wb.Sheets[wb.SheetNames[0]];
                        const raw = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
                        setDebugRows(raw.slice(0, 15));
                        const formatted = raw
                            .filter(r => r[M.name] && String(r[M.name]).trim().length > 2 && String(r[M.name]).toLowerCase() !== "name")
                            .map((r, i) => ({
                                id: i,
                                name: String(r[M.name]).trim().toUpperCase(),
                                acct: String(r[M.acct] || "N/A").trim(),
                                nextDate: formatAsMMDDYYYY(r[M.due]),
                                amt: parseFloat(String(r[M.amt]).replace(/[^0-9.-]+/g, "")) || 0,
                                ovr: parseFloat(String(r[M.ovr]).replace(/[^0-9.-]+/g, "")) || 0,
                                bps: parseFloat(String(r[M.bps]).replace(/[^0-9.-]+/g, "")) || 0,
                                upl: String(r[M.upl] || "N/A").trim()
                            }));
                        if (user) {
                            await db.doc(`artifacts/${appId}/public/data/reports/latest`).set({
                                items: formatted,
                                updatedAt: new Date(),
                                uploaderId: user.uid
                            });
                            setUploadStatus('success');
                        }
                    } catch (err) {
                        console.error(err);
                        setUploadStatus('error');
                    } finally {
                        setIsUploading(false);
                    }
                };
                reader.readAsArrayBuffer(file);
            };

            const filtered = useMemo(() => {
                const t = searchTerm.toLowerCase();
                return t.length < 2 ? [] : data.filter(d => d.name.toLowerCase().includes(t)).slice(0, 25);
            }, [data, searchTerm]);

            if (isLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-black italic tracking-widest uppercase">Syncing Data...</div>;

            return (
                <div className="min-h-screen pb-20">
                    <div className="bg-indigo-700 h-56 w-full rounded-b-[40px] shadow-2xl absolute top-0" />
                    <div className="relative z-10 max-w-md mx-auto px-4 pt-10 space-y-6">
                        <header className="flex justify-between items-start text-white">
                            <div>
                                <h1 className="text-2xl font-black uppercase italic tracking-tighter leading-none">Rep Search</h1>
                                <p className="text-[10px] font-bold opacity-70 uppercase mt-2 tracking-widest">Updated: {lastUpdated || "Never"}</p>
                            </div>
                            <button onClick={() => isAdmin ? setIsAdmin(false) : setShowPinModal(true)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-colors">
                                {isAdmin ? <Icons.X /> : <Icons.Lock />}
                            </button>
                        </header>
                        {showPinModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                                <div className="bg-white rounded-[32px] p-8 w-full max-w-xs shadow-2xl">
                                    <form onSubmit={(e) => { e.preventDefault(); if(pinInput === CORRECT_PIN) {setIsAdmin(true); setShowPinModal(false);} else {setPinInput('');} }}>
                                        <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN" className="w-full text-center text-2xl font-black p-4 bg-slate-50 rounded-2xl mb-4 outline-none border-2 focus:border-indigo-500" />
                                        <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-indigo-100">Login</button>
                                        <button type="button" onClick={() => setShowPinModal(false)} className="w-full mt-2 py-2 text-slate-400 font-bold uppercase text-[10px]">Cancel</button>
                                    </form>
                                </div>
                            </div>
                        )}
                        {isAdmin && (
                            <div className="bg-white rounded-[32px] p-6 shadow-2xl border-4 border-indigo-500 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xs font-black uppercase text-indigo-600">Admin Control Panel</h2>
                                    {debugRows && (
                                        <button onClick={() => setShowDebug(!showDebug)} className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-colors ${showDebug ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            <Icons.Bug /> <span>{showDebug ? 'Close' : 'Inspect Col 4'}</span>
                                        </button>
                                    )}
                                </div>
                                {showDebug && debugRows && (
                                    <div className="bg-slate-900 rounded-2xl p-4 overflow-x-auto hide-scrollbar border-2 border-amber-500/30">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr>
                                                    {debugRows[0].map((_, i) => (
                                                        <th key={i} className={`text-[8px] font-black p-1 border-b border-slate-800 ${i === M.due ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500'}`}>
                                                            {i === M.due ? 'DUE (4)' : `IDX ${i}`}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="text-[9px] font-mono text-slate-300">
                                                {debugRows.map((row, ri) => (
                                                    <tr key={ri}>
                                                        {row.map((cell, ci) => (
                                                            <td key={ci} className={`p-1 border-b border-slate-800/50 whitespace-nowrap ${ci === M.due ? 'bg-amber-400/10 text-amber-200' : ''}`}>
                                                                {cell === "" ? "-" : String(cell).substring(0, 15)}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <div className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${uploadStatus === 'success' ? 'bg-green-50 border-green-200' : 'bg-indigo-50 border-indigo-200'}`}>
                                    <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    {isUploading ? <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /> : 
                                     uploadStatus === 'success' ? <div className="text-green-500 flex justify-center"><Icons.Check /></div> :
                                     <div className="text-indigo-500 flex justify-center"><Icons.FileUp /></div>}
                                    <p className="mt-2 text-[10px] font-black uppercase text-slate-500">
                                        {isUploading ? "Uploading Data..." : uploadStatus === 'success' ? "Update Successful!" : "Drop New Master List"}
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="bg-white rounded-[24px] shadow-xl p-4">
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><Icons.Search /></div>
                                <input type="text" placeholder="Start typing name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 rounded-xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            {filtered.map(item => (
                                <div key={item.id} className="bg-white rounded-[32px] p-6 shadow-md border border-slate-100">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100"><Icons.User /></div>
                                        <div>
                                            <h3 className="font-black text-slate-800 uppercase text-sm leading-none">{item.name}</h3>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Upline: <span className="text-indigo-600">{item.upl}</span></p>
                                        </div>
                                    </div>
                                    <div onClick={() => { 
                                        const text = item.acct;
                                        const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
                                        setCopiedId(item.id); setTimeout(()=>setCopiedId(null), 1000); 
                                    }} className="bg-slate-900 rounded-2xl p-4 flex justify-between items-center cursor-pointer active:scale-95 transition-transform group">
                                        <div>
                                            <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Account Number</p>
                                            <p className="text-xl font-black italic tracking-widest text-white">{item.acct}</p>
                                        </div>
                                        <div className={copiedId === item.id ? "text-green-400" : "text-slate-600 group-hover:text-slate-400"}>
                                            {copiedId === item.id ? <Icons.Check /> : <Icons.Copy />}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-4">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <p className="text-[8px] font-black text-slate-400 uppercase">Due Date</p>
                                            <p className="text-[11px] font-bold text-slate-700">{item.nextDate}</p>
                                        </div>
                                        <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-right">
                                            <p className="text-[8px] font-black text-indigo-400 uppercase">Due Amount</p>
                                            <p className="text-[11px] font-black text-indigo-700">₱{item.amt.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                            <p className="text-[8px] font-black text-emerald-500 uppercase">Sales (BPS)</p>
                                            <p className="text-[11px] font-black text-emerald-700">₱{item.bps.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-right">
                                            <p className="text-[8px] font-black text-red-400 uppercase">Overdue</p>
                                            <p className="text-[11px] font-black text-red-600">₱{item.ovr.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>
</html>