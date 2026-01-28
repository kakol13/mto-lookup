import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  FileUp, 
  User, 
  Calendar, 
  Database,
  X,
  Loader2,
  Copy,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  Users
} from 'lucide-react';

const XLSX_SCRIPT_URL = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';

export default function App() {
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (window.XLSX) return;
    const script = document.createElement('script');
    script.src = XLSX_SCRIPT_URL;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const parseExcelDate = (val) => {
    if (!val || String(val).trim() === "" || String(val).toLowerCase() === "n/a") return "N/A";
    const strVal = String(val).trim();

    if (/^\d{8}$/.test(strVal)) {
      const year = strVal.substring(0, 4);
      const month = strVal.substring(4, 6);
      const day = strVal.substring(6, 8);
      const dateObj = new Date(`${year}-${month}-${day}`);
      return !isNaN(dateObj.getTime()) 
        ? dateObj.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
        : `${month}/${day}/${year}`;
    }

    const serial = parseFloat(val);
    if (!isNaN(serial) && serial > 40000 && serial < 60000) {
      const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
      return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return strVal;
  };

  const formatCurrency = (val) => {
    if (!val) return "0.00";
    const num = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
    return isNaN(num) ? "0.00" : new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return;

    setFileName(file.name);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const dataBuffer = evt.target.result;
        const workbook = window.XLSX.read(dataBuffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawGrid = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });

        const map = { 
          name: 1,  
          acct: 11, 
          due: 4,   
          amt: 5,   
          ovr: 7,   
          bps: 3,   
          upl: 14   
        };

        let startRow = 0;
        for (let i = 0; i < Math.min(rawGrid.length, 30); i++) {
          const row = rawGrid[i];
          const colB = String(row[1] || "").toLowerCase();
          if (colB.includes("name") || colB.includes("member")) {
            startRow = i + 1;
            break;
          }
        }

        const formatted = rawGrid.slice(startRow)
          .filter(r => r[map.name] && String(r[map.name]).trim().length > 2)
          .map((r, i) => ({
            id: i,
            memberName: String(r[map.name] || "").trim().toUpperCase(),
            accountNumber: String(r[map.acct] || "N/A").trim(), 
            dueDate: parseExcelDate(r[map.due]),               
            dueAmount: r[map.amt],                             
            overdue: r[map.ovr],                               
            bps: r[map.bps],                                  
            upline: String(r[map.upl] || "N/A").trim()
          }));
          
        setData(formatted);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filtered = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase().trim();
    return data.filter(i => i.memberName.toLowerCase().includes(term)).slice(0, 50);
  }, [data, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-10 font-sans">
      <div className="bg-blue-600 h-48 w-full absolute top-0 left-0 rounded-b-[40px] shadow-lg" />
      <div className="relative z-10 max-w-md mx-auto px-4 pt-10 space-y-6">
        <header className="text-center text-white pb-2">
          <h1 className="text-3xl font-black tracking-tight uppercase leading-none">Avon Rep Lookup</h1>
          <p className="text-blue-100 text-[10px] font-bold tracking-[0.3em] opacity-80 uppercase mt-2">Search by Name</p>
        </header>

        <div className="bg-white rounded-[32px] shadow-xl p-6 space-y-6">
          {!data.length ? (
            <div className="relative">
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} disabled={isLoading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className="border-2 border-dashed rounded-2xl p-10 text-center space-y-4 bg-blue-50/30 border-blue-200">
                {isLoading ? <Loader2 className="animate-spin text-blue-600 w-10 h-10 mx-auto" /> : <FileUp className="text-blue-600 w-10 h-10 mx-auto" />}
                <p className="font-extrabold text-slate-800">{isLoading ? "Mapping Columns..." : "Upload File"}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-100/50 rounded-2xl p-4">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <Database className="text-blue-600 w-5 h-5 shrink-0" />
                  <p className="text-sm font-bold truncate text-slate-800">{fileName}</p>
                </div>
                <button onClick={() => {setData([]); setSearchTerm('');}} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
          )}

          {data.length > 0 && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search member name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all shadow-inner"
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {searchTerm.length >= 2 && filtered.map((item) => (
            <div key={item.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0 mt-1"><User className="text-blue-600 w-5 h-5" /></div>
                <div className="overflow-hidden flex-1">
                  <h3 className="font-black text-slate-800 uppercase truncate leading-tight mb-1">{item.memberName}</h3>
                  <div className="flex items-center space-x-1">
                    <Users className="w-3 h-3 text-blue-400 shrink-0" />
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate">Upline: <span className="text-blue-600 font-black">{item.upline}</span></p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => {
                  const el = document.createElement('textarea');
                  el.value = item.accountNumber;
                  document.body.appendChild(el);
                  el.select();
                  document.execCommand('copy');
                  document.body.removeChild(el);
                  setCopiedId(item.id);
                  setTimeout(() => setCopiedId(null), 2000);
                }} 
                className="bg-slate-900 rounded-2xl p-4 mb-4 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Account Number</span>
                    <p className="text-xl font-mono font-bold text-white tracking-wider">{item.accountNumber}</p>
                  </div>
                  <div className={`p-2 rounded-xl transition-colors ${copiedId === item.id ? 'bg-green-500' : 'bg-slate-800 text-slate-400'}`}>
                    {copiedId === item.id ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Due Date</span>
                  <div className="flex items-center text-sm font-bold text-slate-700 mt-1"><Calendar className="w-4 h-4 mr-2 text-blue-500" />{item.dueDate}</div>
                </div>
                <div className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100 text-right">
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Amount Due</span>
                  <div className="text-lg font-black text-blue-700 mt-1">₱{formatCurrency(item.dueAmount)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50/50 rounded-2xl p-3 border border-green-100">
                  <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Brochure Sales</span>
                  <div className="flex items-center text-sm font-bold text-green-700 mt-1"><TrendingUp className="w-4 h-4 mr-2" />₱{formatCurrency(item.bps)}</div>
                </div>
                <div className="bg-red-50/50 rounded-2xl p-3 border border-red-100 text-right">
                  <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Overdue</span>
                  <div className="flex items-center justify-end text-sm font-bold text-red-700 mt-1"><ShieldAlert className="w-4 h-4 mr-2" />₱{formatCurrency(item.overdue)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}